import { GetObjectCommand, PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { getClientBoundToRequest } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { getUserRoleFromRequest, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

const WASABI_S3_ENDPOINT = "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = "us-east-1";
const HLS_MANIFEST_KEY = "index.m3u8";
const DEFAULT_PRESIGN_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * HLS playback notes
 * ---------------
 * HLS comes in two playlist shapes:
 * - Media playlist: contains actual media segment URIs (commonly `.ts`)
 * - Master playlist: contains variant playlist URIs (commonly `.m3u8`) plus
 *   `#EXT-X-STREAM-INF` metadata describing bitrate/resolution.
 *
 * Why recursive rewriting is required
 * ----------------------------------
 * A master playlist is a graph root: the player fetches the master, then fetches
 * one of its variants, then fetches the variant's segments. If only the master
 * is presigned (or only the variant is presigned), iOS Safari often fails
 * because the next hop (variant or segments) remains private/unreachable.
 *
 * Therefore, for private object storage we must rewrite the entire graph:
 * - Master playlist points to rewritten variant playlists
 * - Each rewritten variant playlist points to presigned segment URLs
 */

/* =========================================================
 * Helpers
 * ======================================================= */

let activeRequestId: string | undefined;

function logMessage(
  severity: "debug" | "info" | "warn" | "error",
  message: string,
  fields?: Record<string, unknown>,
) {
  logEvent({
    severity,
    event_type: "log",
    message,
    request_id: activeRequestId,
    ...(fields ?? {}),
  });
}

function parseMediaId(reqBody: unknown): string | null {
  if (!reqBody || typeof reqBody !== "object") return null;
  const maybe = (reqBody as Record<string, unknown>).media_id;
  return typeof maybe === "string" && maybe.trim() ? maybe.trim() : null;
}

function parseMode(reqBody: unknown): string | null {
  if (!reqBody || typeof reqBody !== "object") return null;
  const maybe = (reqBody as Record<string, unknown>).mode;
  return typeof maybe === "string" && maybe.trim() ? maybe.trim() : null;
}

async function readBodyAsText(body: unknown): Promise<string> {
  if (!body) return "";

  if (typeof body === "string") return body;

  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ReadableStream) {
    return await new Response(body).text();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await new Response(body as any).text();
  } catch {
    return "";
  }
}

function isSegmentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return false;

  const lower = trimmed.toLowerCase();
  const withoutQuery = lower.split("?")[0]?.split("#")[0] ?? lower;
  return withoutQuery.endsWith(".ts");
}

function isVariantLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return false;

  const lower = trimmed.toLowerCase();
  const withoutQuery = lower.split("?")[0]?.split("#")[0] ?? lower;
  return withoutQuery.endsWith(".m3u8");
}

function normalizeSegmentPath(segmentUri: string): string {
  let s = segmentUri.trim();
  s = s.replace(/^\.(\/)+/, "");
  s = s.replace(/^\/+/, "");

  if (s.includes("%")) {
    try {
      s = decodeURIComponent(s);
    } catch {
      // noop
    }
  }

  return s;
}

/**
 * Strip query string and fragment from a playlist URI.
 * S3 object keys never include these, but HLS playlists sometimes do.
 */
function stripQueryAndFragment(uri: string): string {
  const trimmed = uri.trim();
  const noHash = trimmed.split("#")[0] ?? trimmed;
  return noHash.split("?")[0] ?? noHash;
}

/**
 * Returns true when a URI is already an absolute HTTP(S) URL.
 * We do not attempt to sign or resolve these.
 */
function isHttpUrl(uri: string): boolean {
  const s = uri.trim().toLowerCase();
  return s.startsWith("https://") || s.startsWith("http://");
}

/**
 * Normalize a key path (handles `.` and `..` segments) for S3-style keys.
 * This is important when variant playlists live in subfolders.
 */
function normalizeS3KeyPath(path: string): string {
  const cleaned = path.replace(/^\/+/, "");
  const parts = cleaned.split("/").filter((p) => p.length > 0);
  const out: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }

  return out.join("/");
}

/**
 * Resolve a playlist-relative URI to an S3 object key.
 * - Absolute HLS paths that start with `orgs/` are treated as keys.
 * - Otherwise we resolve relative to the directory of `playlistKey`.
 */
function resolveObjectKeyFromPlaylistUri(opts: {
  uriLine: string;
  playlistKey: string;
}): string | null {
  const raw = opts.uriLine.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return null;
  if (isHttpUrl(raw)) return null;

  const normalized = normalizeSegmentPath(raw);
  const withoutQuery = stripQueryAndFragment(normalized);

  if (withoutQuery.startsWith("orgs/")) {
    return normalizeS3KeyPath(withoutQuery);
  }

  const lastSlash = opts.playlistKey.lastIndexOf("/");
  const playlistDir = lastSlash >= 0 ? opts.playlistKey.slice(0, lastSlash + 1) : "";
  return normalizeS3KeyPath(`${playlistDir}${withoutQuery}`);
}

/**
 * When uploading rewritten variant playlists, keep the same relative path
 * (if possible) under the `.../streaming/presigned/` prefix.
 */
function derivePresignedVariantKey(opts: {
  streamingPrefix: string;
  variantSourceKey: string;
}): string {
  const prefix = `${opts.streamingPrefix}/`;
  let relative = opts.variantSourceKey.startsWith(prefix)
    ? opts.variantSourceKey.slice(prefix.length)
    : opts.variantSourceKey;

  // Ensure we do not accidentally write outside the intended prefix.
  relative = relative.replace(/^\/+/, "");
  return `${opts.streamingPrefix}/presigned/${relative}`;
}

/**
 * Read an object body into text. (Used for HLS playlists fetched from Wasabi.)
 */
async function fetchPlaylistText(opts: {
  readerS3: S3Client;
  bucket: string;
  key: string;
  logFetched?: boolean;
}): Promise<string> {
  const resp = await opts.readerS3.send(
    new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
    }),
  );

  if (opts.logFetched) {
    // Log result of get object
    logMessage("info", "HLS manifest fetched", {
      manifestKey: opts.key,
      contentType: resp.ContentType,
      contentLength: resp.ContentLength,
    });
  }

  return await readBodyAsText(resp.Body);
}

/**
 * Classify an HLS playlist by inspecting its non-comment URI lines.
 */
function classifyPlaylist(lines: string[]): {
  segmentLines: string[];
  variantLines: string[];
  type: "media" | "master" | "unknown";
} {
  const segmentLines = lines.filter(isSegmentLine);
  const variantLines = lines.filter(isVariantLine);
  const type = segmentLines.length > 0 ? "media" : variantLines.length > 0 ? "master" : "unknown";
  return { segmentLines, variantLines, type };
}

/**
 * Rewrite a media playlist (or variant playlist) by turning each `.ts` segment
 * URI line into a presigned Wasabi URL.
 */
async function rewriteMediaPlaylistToPresignedUrls(opts: {
  lines: string[];
  bucket: string;
  ttlSeconds: number;
  playlistKey: string;
  readerS3: S3Client;
  streamingPrefix: string;
  // Preserve existing detailed logs in mode=url
  logSignAttempt?: boolean;
  logSignFailure?: boolean;
}): Promise<string> {
  const rewritten = await Promise.all(
    opts.lines.map(async (line, index) => {
      if (!isSegmentLine(line)) return line;

      const segmentKey = resolveObjectKeyFromPlaylistUri({
        uriLine: line,
        playlistKey: opts.playlistKey,
      });

      if (!segmentKey) return line;

      if (opts.logSignAttempt) {
        logMessage("info", "HLS segment sign attempt", {
          index,
          segmentKey,
        });
      }

      try {
        const signedUrl = await getSignedUrl(
          opts.readerS3,
          new GetObjectCommand({
            Bucket: opts.bucket,
            Key: segmentKey,
          }),
          { expiresIn: opts.ttlSeconds },
        );
        return signedUrl;
      } catch (err: any) {
        if (opts.logSignFailure) {
          logMessage("error", "HLS segment signing FAILED", {
            index,
            segmentKey,
            errorName: err?.name,
            errorCode: err?.Code,
            httpStatus: err?.$metadata?.httpStatusCode,
          });
        }
        throw err;
      }
    }),
  );

  return rewritten.join("\n");
}

/**
 * Rewrite an HLS master playlist by:
 * 1) fetching each variant playlist
 * 2) rewriting each variant's segments to presigned URLs
 * 3) uploading rewritten variants under `.../streaming/presigned/...`
 * 4) rewriting master variant lines to point at presigned variant URLs
 */
async function rewriteMasterPlaylistGraph(opts: {
  rootLines: string[];
  rootKey: string;
  bucket: string;
  ttlSeconds: number;
  streamingPrefix: string;
  readerS3: S3Client;
  uploaderS3: S3Client;
}): Promise<string> {
  const { variantLines } = classifyPlaylist(opts.rootLines);
  const variantUriToSignedUrl = new Map<string, string>();

  // Process variants sequentially for clearer logs and to avoid a thundering herd
  // on large master playlists.
  for (const [index, variantLine] of opts.rootLines.entries()) {
    if (!isVariantLine(variantLine)) continue;

    const variantKey = resolveObjectKeyFromPlaylistUri({
      uriLine: variantLine,
      playlistKey: opts.rootKey,
    });

    if (!variantKey) continue;

    // Keep the existing log message (previously used for signing the original variant).
    logMessage("info", "HLS variant sign attempt", {
      index,
      variantKey,
    });

    let variantText: string;
    try {
      const resp = await opts.readerS3.send(
        new GetObjectCommand({
          Bucket: opts.bucket,
          Key: variantKey,
        }),
      );

      logMessage("info", "HLS manifest fetched", {
        manifestKey: variantKey,
        contentType: resp.ContentType,
        contentLength: resp.ContentLength,
      });

      variantText = await readBodyAsText(resp.Body);
    } catch (err: any) {
      logMessage("error", "Wasabi HLS manifest read failed", {
        name: err?.name,
        code: err?.Code,
        httpStatus: err?.$metadata?.httpStatusCode,
        requestId: err?.$metadata?.requestId,
      });
      throw err;
    }

    const variantLinesSplit = variantText.split(/\r?\n/);
    const diag = classifyPlaylist(variantLinesSplit);
    logMessage("info", "HLS playlist type", {
      segmentCount: diag.segmentLines.length,
      variantCount: diag.variantLines.length,
    });

    // Variants should be media playlists; still, rewrite only `.ts` segment lines.
    const rewrittenVariant = await rewriteMediaPlaylistToPresignedUrls({
      lines: variantLinesSplit,
      bucket: opts.bucket,
      ttlSeconds: opts.ttlSeconds,
      playlistKey: variantKey,
      readerS3: opts.readerS3,
      streamingPrefix: opts.streamingPrefix,
    });

    const presignedVariantKey = derivePresignedVariantKey({
      streamingPrefix: opts.streamingPrefix,
      variantSourceKey: variantKey,
    });

    logMessage("info", "Uploading rewritten HLS manifest", {
      rewrittenManifestKey: presignedVariantKey,
      size: rewrittenVariant.length,
    });

    try {
      await opts.uploaderS3.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: presignedVariantKey,
          Body: rewrittenVariant,
          ContentType: "application/vnd.apple.mpegurl",
        }),
      );

      logMessage("info", "Rewritten HLS manifest upload OK", {
        rewrittenManifestKey: presignedVariantKey,
      });
    } catch (err: any) {
      logMessage("error", "Wasabi presigned playlist write failed", {
        name: err?.name,
        code: err?.Code,
        httpStatus: err?.$metadata?.httpStatusCode,
        requestId: err?.$metadata?.requestId,
      });
      throw err;
    }

    const signedVariantUrl = await getSignedUrl(
      opts.readerS3,
      new GetObjectCommand({
        Bucket: opts.bucket,
        Key: presignedVariantKey,
      }),
      { expiresIn: opts.ttlSeconds },
    );

    variantUriToSignedUrl.set(variantLine, signedVariantUrl);
  }

  // Rewrite master playlist variant URI lines to the presigned variant URLs.
  const rewrittenMasterLines = opts.rootLines.map((line) => {
    if (!isVariantLine(line)) return line;
    return variantUriToSignedUrl.get(line) ?? line;
  });

  // Preserve detection log for both playlist types
  logMessage("info", "HLS playlist type", {
    segmentCount: classifyPlaylist(opts.rootLines).segmentLines.length,
    variantCount: variantLines.length,
  });

  return rewrittenMasterLines.join("\n");
}

/* =========================================================
 * Handler
 * ======================================================= */

Deno.serve(withObservability("get-wasabi-playback-playlist", async (req, ctx) => {
  activeRequestId = ctx.requestId;
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Log execution region (diagnostics)
  const edgeRegion =
    req.headers.get("x-supabase-region") ??
    req.headers.get("x-vercel-region") ??
    "unknown";
  logMessage("info", "edge_region", { edge_region: edgeRegion });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const supabase = getClientBoundToRequest(req);

    const body = await req.json().catch(() => null);
    const mediaId = parseMediaId(body);
    if (!mediaId) {
      return jsonResponse({ error: "Missing required field: media_id" }, 400);
    }

    const mode = parseMode(body);

    // Fetch media asset
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, bucket")
      .eq("id", mediaId)
      .maybeSingle();

    if (assetError || !asset) {
      return jsonResponse({ error: "Media asset not found" }, 404);
    }

    const orgId = String(asset.org_id ?? "");
    const bucket = String(asset.bucket ?? "").trim() || "rugbycodex";

    if (!orgId) {
      return jsonResponse({ error: "Media asset missing org_id" }, 500);
    }

    try {
      const { role } = await getUserRoleFromRequest(req, { supabase, orgId });
      requireRole(role, "viewer");
    } catch {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const streamingPrefix = `orgs/${orgId}/uploads/${mediaId}/streaming`;
    const manifestKey = `${streamingPrefix}/${HLS_MANIFEST_KEY}`;

    // Log the manifest lookup key
    logMessage("info", "HLS manifest lookup", {
      mediaId,
      orgId,
      bucket,
      manifestKey,
      mode,
    });

    const readerAccessKeyId = Deno.env.get("WASABI_READER_KEY");
    const readerSecretAccessKey = Deno.env.get("WASABI_READER_SECRET");
    const uploaderAccessKeyId = Deno.env.get("WASABI_UPLOADER_KEY");
    const uploaderSecretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET");

    if (!readerAccessKeyId || !readerSecretAccessKey) {
      return jsonResponse({ error: "Wasabi reader credentials not configured" }, 500);
    }

    if (!uploaderAccessKeyId || !uploaderSecretAccessKey) {
      return jsonResponse({ error: "Wasabi uploader credentials not configured" }, 500);
    }

    const readerS3 = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_S3_ENDPOINT,
      credentials: {
        accessKeyId: readerAccessKeyId,
        secretAccessKey: readerSecretAccessKey,
      },
    });

    const uploaderS3 = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_S3_ENDPOINT,
      credentials: {
        accessKeyId: uploaderAccessKeyId,
        secretAccessKey: uploaderSecretAccessKey,
      },
    });

    /* =========================================================
     * Mode: url (presigned manifest only)
     * ======================================================= */

    if (mode === "url") {
      const ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS;

      // Fetch the original playlist and rewrite segment/variant lines to presigned URLs.
      // Then upload the rewritten playlist to `.../streaming/presigned/index.m3u8` and return
      // a presigned HTTPS URL to that rewritten playlist.
      let playlistText: string;

      try {
        playlistText = await fetchPlaylistText({
          readerS3,
          bucket,
          key: manifestKey,
          logFetched: true,
        });

        if (!playlistText.trim()) {
          return jsonResponse({ error: "Playlist not found" }, 404);
        }

        // Log basic manifest diagnostics
        const lines = playlistText.split(/\r?\n/);
        const segmentLines = lines.filter(isSegmentLine);
        const variantLines = lines.filter(isVariantLine);

        logMessage("info", "HLS playlist type", {
          segmentCount: segmentLines.length,
          variantCount: variantLines.length,
        });

        logMessage("info", "HLS manifest parsed", {
          manifestKey,
          totalLines: lines.length,
          segmentCount: segmentLines.length,
          sampleSegments: segmentLines.slice(0, 5),
        });
      } catch (err: any) {
        logMessage("error", "Wasabi HLS manifest read failed", {
          name: err?.name,
          code: err?.Code,
          httpStatus: err?.$metadata?.httpStatusCode,
          requestId: err?.$metadata?.requestId,
        });

        if (
          err?.name === "NoSuchKey" ||
          err?.$metadata?.httpStatusCode === 404
        ) {
          return jsonResponse({ error: "Playlist not found" }, 404);
        }

        return jsonResponse(
          { error: "Playlist temporarily unavailable" },
          503,
        );
      }

      const lines = playlistText.split(/\r?\n/);
      const segmentLines = lines.filter(isSegmentLine);
      const variantLines = lines.filter(isVariantLine);

      // Required detection log for both playlist types
      logMessage("info", "HLS playlist type", {
        segmentCount: segmentLines.length,
        variantCount: variantLines.length,
      });

      logMessage("info", "HLS signing summary", {
        mediaId,
        segmentCount: segmentLines.length,
        variantCount: variantLines.length,
        ttlSeconds,
      });

      const rewrittenPlaylist =
        segmentLines.length > 0
          ? await rewriteMediaPlaylistToPresignedUrls({
              lines,
              bucket,
              ttlSeconds,
              playlistKey: manifestKey,
              readerS3,
              streamingPrefix,
              logSignAttempt: true,
              logSignFailure: true,
            })
          : variantLines.length > 0
            ? await rewriteMasterPlaylistGraph({
                rootLines: lines,
                rootKey: manifestKey,
                bucket,
                ttlSeconds,
                streamingPrefix,
                readerS3,
                uploaderS3,
              })
            : playlistText;

      const rewrittenManifestKey = `${streamingPrefix}/presigned/${HLS_MANIFEST_KEY}`;

      // Upload rewritten playlist
      logMessage("info", "Uploading rewritten HLS manifest", {
        rewrittenManifestKey,
        size: rewrittenPlaylist.length,
      });
      try {
        await uploaderS3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: rewrittenManifestKey,
            Body: rewrittenPlaylist,
            ContentType: "application/vnd.apple.mpegurl",
          }),
        );
        // Upload successful
        logMessage("info", "Rewritten HLS manifest upload OK", {
          rewrittenManifestKey,
        });
      } catch (err: any) {
        logMessage("error", "Wasabi presigned playlist write failed", {
          name: err?.name,
          code: err?.Code,
          httpStatus: err?.$metadata?.httpStatusCode,
          requestId: err?.$metadata?.requestId,
        });
        return jsonResponse(
          { error: "Playlist temporarily unavailable" },
          503,
        );
      }

      const presignedPlaylistUrl = await getSignedUrl(
        readerS3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: rewrittenManifestKey,
        }),
        { expiresIn: ttlSeconds },
      );

      // IMPORTANT: Return the presigned URL as *raw text*, not JSON.
      // Presigned S3/Wasabi URLs are signature-sensitive; JSON encoding (via `jsonResponse`/
      // `JSON.stringify`) can change the byte representation (e.g., escaping) and invalidate
      // the signature, causing 403s during HLS playback. This is intentional and must not be
      // refactored back to `jsonResponse()`.
      return new Response(presignedPlaylistUrl, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
        },
      });
    } // end mode=url

    /* =========================================================
     * Fetch playlist
     * ======================================================= */

    let playlistText: string;

    try {
      playlistText = await fetchPlaylistText({
        readerS3,
        bucket,
        key: manifestKey,
      });

      if (!playlistText.trim()) {
        return jsonResponse({ error: "Playlist not found" }, 404);
      }
    } catch (err: any) {
      logMessage("error", "Wasabi HLS manifest read failed", {
        name: err?.name,
        code: err?.Code,
        httpStatus: err?.$metadata?.httpStatusCode,
        requestId: err?.$metadata?.requestId,
      });

      // True "does not exist"
      if (
        err?.name === "NoSuchKey" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return jsonResponse({ error: "Playlist not found" }, 404);
      }

      // Transient / retryable
      return jsonResponse(
        { error: "Playlist temporarily unavailable" },
        503,
      );
    }

    /* =========================================================
     * Rewrite segments (parallel signing)
     * ======================================================= */

    const lines = playlistText.split(/\r?\n/);
    const segmentLines = lines.filter(isSegmentLine);
    const variantLines = lines.filter(isVariantLine);

    logMessage("info", "HLS playlist type", {
      segmentCount: segmentLines.length,
      variantCount: variantLines.length,
    });
    const ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS;

    const rewrittenText =
      segmentLines.length > 0
        ? await rewriteMediaPlaylistToPresignedUrls({
            lines,
            bucket,
            ttlSeconds,
            playlistKey: manifestKey,
            readerS3,
            streamingPrefix,
          })
        : variantLines.length > 0
          ? await rewriteMasterPlaylistGraph({
              rootLines: lines,
              rootKey: manifestKey,
              bucket,
              ttlSeconds,
              streamingPrefix,
              readerS3,
              uploaderS3,
            })
          : playlistText;

    return new Response(rewrittenText, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.mpegurl",
      },
    });
  } catch (err) {
    logMessage("error", "Unhandled playback playlist error", {
      error_message: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
}));

