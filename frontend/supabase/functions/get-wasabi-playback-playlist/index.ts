import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { isOrgMember } from "../_shared/orgs.ts";

const WASABI_S3_ENDPOINT = "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = "us-east-1";
const HLS_MANIFEST_KEY = "index.m3u8";

const DEFAULT_PRESIGN_TTL_SECONDS = 60 * 10; // 10 minutes

function parseMediaId(reqBody: unknown): string | null {
  if (!reqBody || typeof reqBody !== "object") return null;
  const maybe = (reqBody as Record<string, unknown>).media_id;
  return typeof maybe === "string" && maybe.trim() ? maybe.trim() : null;
}

async function readBodyAsText(body: unknown): Promise<string> {
  if (!body) return "";

  if (typeof body === "string") return body;

  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  // In Edge/Deno, aws-sdk Body is commonly a ReadableStream.
  if (body instanceof ReadableStream) {
    return await new Response(body).text();
  }

  // Fallback: try to coerce via Response.
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

  // Segment URIs are typically *.ts. Avoid rewriting nested playlists.
  if (trimmed.toLowerCase().includes(".m3u8")) return false;
  return trimmed.toLowerCase().includes(".ts");
}

function normalizeSegmentPath(segmentUri: string): string {
  let s = segmentUri.trim();
  s = s.replace(/^\.(\/)+/, "");
  s = s.replace(/^\/+/, "");

  // If the playlist uses URL encoding, try to decode for S3 key matching.
  if (s.includes("%")) {
    try {
      s = decodeURIComponent(s);
    } catch {
      // keep original
    }
  }

  return s;
}

function getWasabiErrorInfo(err: unknown): { name?: string; status?: number } {
  if (!err || typeof err !== "object") {
    return { name: typeof err === "string" ? err : undefined };
  }

  const maybe = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
    statusCode?: number;
  };

  return {
    name: maybe.name,
    status: maybe.$metadata?.httpStatusCode ?? maybe.statusCode,
  };
}

function isMissingPlaylistError(err: unknown): boolean {
  const info = getWasabiErrorInfo(err);
  if (info.status === 404) return true;
  if (!info.name) return false;
  return ["NoSuchKey", "NotFound", "NotFoundException"].includes(info.name);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const supabase = getClientBoundToRequest(req);
    const { userId, isAdmin } = await getAuthContext(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const media_id = parseMediaId(body);
    if (!media_id) {
      return jsonResponse({ error: "Missing required field: media_id" }, 400);
    }

    // Fetch media asset (must include org + bucket)
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, bucket")
      .eq("id", media_id)
      .maybeSingle();

    if (assetError || !asset) {
      return jsonResponse({ error: "Media asset not found" }, 404);
    }

    const orgId = String(asset.org_id ?? "");
    const bucket = String(asset.bucket ?? "").trim() || "rugbycodex";

    if (!orgId) {
      return jsonResponse({ error: "Media asset is missing org_id" }, 500);
    }

    // Verify org membership unless admin
    if (!isAdmin) {
      const member = await isOrgMember(orgId, userId, supabase);
      if (!member) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    const streamingPrefix = `orgs/${orgId}/uploads/${media_id}/streaming`;
    const manifestKey = `${streamingPrefix}/${HLS_MANIFEST_KEY}`;

    const accessKeyId = Deno.env.get("WASABI_READER_KEY") ?? Deno.env.get("WASABI_UPLOADER_KEY");
    const secretAccessKey = Deno.env.get("WASABI_READER_SECRET") ?? Deno.env.get("WASABI_UPLOADER_SECRET");

    if (!accessKeyId || !secretAccessKey) {
      return jsonResponse({ error: "Wasabi credentials not configured" }, 500);
    }

    const s3 = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_S3_ENDPOINT,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Fetch the original playlist from Wasabi (private)
    let playlistText: string;
    try {
      const resp = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: manifestKey,
        }),
      );

      playlistText = await readBodyAsText(resp.Body);

      if (!playlistText.trim()) {
        return jsonResponse({ error: "Playlist not found" }, 404);
      }
    } catch (err) {
      // NoSuchKey / AccessDenied / etc. should not leak details.
      const { name, status } = getWasabiErrorInfo(err);
      console.error("Error fetching HLS manifest from Wasabi:", { name, status, err });
      if (isMissingPlaylistError(err)) {
        return jsonResponse({ error: "Playlist not found" }, 404);
      }
      return jsonResponse({ error: "Playlist temporarily unavailable" }, 503);
    }

    const ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS;

    const lines = playlistText.split(/\r?\n/);
    const rewritten: string[] = [];

    for (const line of lines) {
      if (!isSegmentLine(line)) {
        rewritten.push(line);
        continue;
      }

      const segmentUri = normalizeSegmentPath(line);

      // Support either relative segment URIs (most common) or absolute key paths.
      const segmentKey = segmentUri.startsWith("orgs/")
        ? segmentUri
        : `${streamingPrefix}/${segmentUri}`;

      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: segmentKey,
        }),
        { expiresIn: ttlSeconds },
      );

      rewritten.push(signedUrl);
    }

    const bodyText = rewritten.join("\n");

    return new Response(bodyText, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.mpegurl",
      },
    });
  } catch (err) {
    console.error("Error in get-wasabi-playback-playlist:", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});
