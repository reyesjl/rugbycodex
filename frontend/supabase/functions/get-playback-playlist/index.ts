import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

const CDN_BASE_URL = "https://cdn.rugbycodex.com";
const HLS_MANIFEST_KEY = "index.m3u8";

/**
 * HLS playback notes
 * ---------------
 * HLS comes in two playlist shapes:
 * - Media playlist: contains actual media segment URIs (commonly `.ts`)
 * - Master playlist: contains variant playlist URIs (commonly `.m3u8`) plus
 *   `#EXT-X-STREAM-INF` metadata describing bitrate/resolution.
 *
 * CDN-based streaming
 * ----------------------------------
 * This function rewrites HLS playlists to point to the Cloudflare CDN.
 * The CDN handles public access to media assets without requiring presigned URLs.
 * - Master playlist points to rewritten variant playlists on CDN
 * - Each rewritten variant playlist points to segment URLs on CDN
 */

/* =========================================================
 * Helpers
 * ======================================================= */

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
 * Resolve a playlist-relative URI to a CDN URL.
 * - Absolute HLS paths that start with `orgs/` are treated as asset paths.
 * - Otherwise we resolve relative to the directory of `playlistKey`.
 */
function resolveCdnUrlFromPlaylistUri(opts: {
  uriLine: string;
  playlistKey: string;
}): string | null {
  const raw = opts.uriLine.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return null;
  if (isHttpUrl(raw)) return null;

  const normalized = normalizeSegmentPath(raw);
  const withoutQuery = stripQueryAndFragment(normalized);

  let assetPath: string;
  if (withoutQuery.startsWith("orgs/")) {
    assetPath = normalizeS3KeyPath(withoutQuery);
  } else {
    const lastSlash = opts.playlistKey.lastIndexOf("/");
    const playlistDir = lastSlash >= 0 ? opts.playlistKey.slice(0, lastSlash + 1) : "";
    assetPath = normalizeS3KeyPath(`${playlistDir}${withoutQuery}`);
  }

  return `${CDN_BASE_URL}/${assetPath}`;
}

/**
 * Rewrite a media playlist (or variant playlist) by turning each `.ts` segment
 * URI line into a CDN URL.
 */
async function rewriteMediaPlaylistToCdnUrls(opts: {
  lines: string[];
  playlistKey: string;
}): Promise<string> {
  const rewritten = opts.lines.map((line) => {
    if (!isSegmentLine(line)) return line;

    const cdnUrl = resolveCdnUrlFromPlaylistUri({
      uriLine: line,
      playlistKey: opts.playlistKey,
    });

    return cdnUrl ?? line;
  });

  return rewritten.join("\n");
}

/**
 * Rewrite an HLS master playlist by:
 * 1) rewriting each variant line to point to the CDN
 */
async function rewriteMasterPlaylistToCdn(opts: {
  rootLines: string[];
  rootKey: string;
}): Promise<string> {
  const rewrittenLines = opts.rootLines.map((line) => {
    if (!isVariantLine(line)) return line;

    const cdnUrl = resolveCdnUrlFromPlaylistUri({
      uriLine: line,
      playlistKey: opts.rootKey,
    });

    return cdnUrl ?? line;
  });

  return rewrittenLines.join("\n");
}

/* =========================================================
 * Handler
 * ======================================================= */

Deno.serve(withObservability("get-playback-playlist", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Log execution region (diagnostics)
  const edgeRegion =
    req.headers.get("x-supabase-region") ??
    req.headers.get("x-vercel-region") ??
    "unknown";
  logEvent({
    severity: "info",
    event_type: "edge_region",
    request_id: ctx.requestId,
    function: "get-playback-playlist",
    edge_region: edgeRegion,
  });

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const supabase = getClientBoundToRequest(req);
    const { userId } = await getAuthContext(req);
    if (!userId) {
      logEvent({
        severity: "warn",
        event_type: "auth_failure",
        request_id: ctx.requestId,
        function: "get-playback-playlist",
        error_code: "AUTH_INVALID_TOKEN",
        error_message: "Unauthorized",
      });
    }

    const body = await req.json().catch(() => null);
    const mediaId = parseMediaId(body);
    if (!mediaId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "Missing required field: media_id", 400);
    }

    const mode = parseMode(body);

    // Fetch media asset
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, base_org_storage_path")
      .eq("id", mediaId)
      .maybeSingle();

    if (assetError || !asset) {
      console.error("Media asset not found:", assetError);
      return errorResponse("NOT_FOUND", "Media asset not found", 404);
    }

    const orgId = String(asset.org_id ?? "");
    const baseOrgStoragePath = String((asset as { base_org_storage_path?: string | null }).base_org_storage_path ?? "");
    const normalizedBase =
      (baseOrgStoragePath.trim() || `orgs/${orgId}/uploads/`).replace(/^\/+/, "");
    const basePrefix = normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`;

    if (!orgId) {
      return errorResponse("UNEXPECTED_SERVER_ERROR", "Media asset missing org_id", 500);
    }

    try {
      const { role } = await getUserRoleFromRequest(req, { supabase, orgId });
      requireRole(role, "viewer");
    } catch (err) {
      logEvent({
        severity: "warn",
        event_type: "permission_denied",
        request_id: ctx.requestId,
        function: "get-playback-playlist",
        org_id: orgId,
        user_id: userId,
        error_code: "AUTH_PERMISSION_DENIED",
        error_message: "User is not authorized for playback",
      });
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    const streamingPrefix = `${basePrefix}${mediaId}/streaming`;
    const manifestKey = `${streamingPrefix}/${HLS_MANIFEST_KEY}`;

    // Log the manifest lookup key
    logEvent({
      severity: "info",
      event_type: "hls_manifest_lookup",
      request_id: ctx.requestId,
      function: "get-playback-playlist",
      media_id: mediaId,
      org_id: orgId,
      manifest_key: manifestKey,
      mode,
    });

    /* =========================================================
     * Mode: url (CDN URL only)
     * ======================================================= */

    if (mode === "url") {
      // Return the CDN URL directly
      const cdnUrl = `${CDN_BASE_URL}/${manifestKey}`;

      logEvent({
        severity: "info",
        event_type: "cdn_url_returned",
        request_id: ctx.requestId,
        function: "get-playback-playlist",
        media_id: mediaId,
        cdn_url: cdnUrl,
      });

      // Return the CDN URL as raw text
      return new Response(cdnUrl, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
        },
      });
    }

    /* =========================================================
     * Fetch and rewrite playlist from CDN
     * ======================================================= */

    const cdnPlaylistUrl = `${CDN_BASE_URL}/${manifestKey}`;
    let playlistText: string;

    try {
      const fetchStart = performance.now();
      const response = await fetch(cdnPlaylistUrl);
      const fetchDuration = Math.round(performance.now() - fetchStart);
      logEvent({
        severity: "info",
        event_type: "metric",
        metric_name: "api_external_call_latency_ms",
        metric_value: fetchDuration,
        tags: { service: "cdn", function: "get-playback-playlist" },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return errorResponse("NOT_FOUND", "Playlist not found", 404);
        }
        throw new Error(`CDN returned ${response.status}`);
      }

      playlistText = await response.text();

      if (!playlistText.trim()) {
        return errorResponse("NOT_FOUND", "Playlist not found", 404);
      }
    } catch (err: any) {
      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: ctx.requestId,
        function: "get-playback-playlist",
        error_code: "CDN_READ_FAILED",
        error_message: err?.message ?? "CDN read failed",
        url: cdnPlaylistUrl,
      });
      logEvent({
        severity: "error",
        event_type: "metric",
        metric_name: "api_external_call_errors_total",
        metric_value: 1,
        tags: { service: "cdn", function: "get-playback-playlist" },
      });

      return errorResponse("UNEXPECTED_SERVER_ERROR", "Playlist temporarily unavailable", 503);
    }

    /* =========================================================
     * Rewrite playlist to CDN URLs
     * ======================================================= */

    const lines = playlistText.split(/\r?\n/);
    const segmentLines = lines.filter(isSegmentLine);
    const variantLines = lines.filter(isVariantLine);

    logEvent({
      severity: "info",
      event_type: "hls_playlist_type",
      request_id: ctx.requestId,
      function: "get-playback-playlist",
      segment_count: segmentLines.length,
      variant_count: variantLines.length,
    });

    const rewrittenText =
      segmentLines.length > 0
        ? await rewriteMediaPlaylistToCdnUrls({
          lines,
          playlistKey: manifestKey,
        })
        : variantLines.length > 0
          ? await rewriteMasterPlaylistToCdn({
            rootLines: lines,
            rootKey: manifestKey,
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
    const message = err instanceof Error ? err.message : "Unexpected server error";
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "get-playback-playlist",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));
