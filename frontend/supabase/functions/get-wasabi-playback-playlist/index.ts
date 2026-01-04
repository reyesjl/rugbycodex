import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { isOrgMember } from "../_shared/orgs.ts";

const WASABI_S3_ENDPOINT = "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = "us-east-1";
const HLS_MANIFEST_KEY = "index.m3u8";
const DEFAULT_PRESIGN_TTL_SECONDS = 60 * 10; // 10 minutes

/* =========================================================
 * Helpers
 * ======================================================= */

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
  if (trimmed.toLowerCase().includes(".m3u8")) return false;
  return trimmed.toLowerCase().includes(".ts");
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

/* =========================================================
 * Handler
 * ======================================================= */

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Log execution region (diagnostics)
  const edgeRegion =
    req.headers.get("x-supabase-region") ??
    req.headers.get("x-vercel-region") ??
    "unknown";
  console.log("edge_region:", edgeRegion);

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
    const mediaId = parseMediaId(body);
    if (!mediaId) {
      return jsonResponse({ error: "Missing required field: media_id" }, 400);
    }

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

    if (!isAdmin) {
      const member = await isOrgMember(orgId, userId, supabase);
      if (!member) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    const streamingPrefix = `orgs/${orgId}/uploads/${mediaId}/streaming`;
    const manifestKey = `${streamingPrefix}/${HLS_MANIFEST_KEY}`;

    const accessKeyId =
      Deno.env.get("WASABI_READER_KEY") ??
      Deno.env.get("WASABI_UPLOADER_KEY");

    const secretAccessKey =
      Deno.env.get("WASABI_READER_SECRET") ??
      Deno.env.get("WASABI_UPLOADER_SECRET");

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

    /* =========================================================
     * Fetch playlist
     * ======================================================= */

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
    } catch (err: any) {
      console.error("Wasabi HLS manifest read failed", {
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
    const ttlSeconds = DEFAULT_PRESIGN_TTL_SECONDS;

    const rewritten = await Promise.all(
      lines.map(async (line) => {
        if (!isSegmentLine(line)) return line;

        const segmentUri = normalizeSegmentPath(line);
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

        return signedUrl;
      }),
    );

    return new Response(rewritten.join("\n"), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.apple.mpegurl",
      },
    });
  } catch (err) {
    console.error("Unhandled playback playlist error:", err);
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});

