import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { DeleteObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { withObservability } from "../_shared/observability.ts";

type QueueRow = {
  id: string;
  coach_audio_url: string;
  storage_bucket: string | null;
  storage_key: string | null;
  attempt_count: number;
};

const WASABI_S3_ENDPOINT = Deno.env.get("WASABI_ENDPOINT") ?? "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = Deno.env.get("WASABI_REGION") ?? "us-east-1";
const DEFAULT_BUCKET = Deno.env.get("WASABI_BUCKET_NAME") ?? "rugbycodex";

function parseWasabiLocation(row: QueueRow): { bucket: string; key: string } | null {
  const bucket = (row.storage_bucket ?? "").trim();
  const key = (row.storage_key ?? "").trim();
  if (key) {
    if (!bucket && !key.includes("/") && (row.coach_audio_url ?? "").includes("/")) {
      // storage_key looks truncated, fall back to URL parsing
    } else {
      return { bucket, key };
    }
  }

  const url = (row.coach_audio_url ?? "").trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.host;
    const path = parsed.pathname.replace(/^\/+/, "");
    if (!path) return null;
    if (host.includes(".s3.")) {
      const hostBucket = host.split(".")[0];
      return { bucket: hostBucket, key: path };
    }
    return { bucket: "", key: path };
  } catch {
    return null;
  }
}

Deno.serve(withObservability("cleanup-coach-audio", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  const accessKeyId = Deno.env.get("WASABI_UPLOADER_KEY") ?? "";
  const secretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET") ?? "";
  if (!accessKeyId || !secretAccessKey) {
    return errorResponse("WASABI_CREDENTIALS_MISSING", "Uploader credentials not configured", 500);
  }

  const supabaseAdmin = getServiceRoleClient();
  const s3 = new S3Client({
    region: WASABI_REGION,
    endpoint: WASABI_S3_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });
  const { data: rows, error } = await supabaseAdmin
    .from("segment_insight_audio_deletions")
    .select("id, coach_audio_url, storage_bucket, storage_key, attempt_count")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load cleanup queue.", 500);
  }

  const queue = (rows ?? []) as QueueRow[];
  if (queue.length === 0) {
    return jsonResponse({ processed: 0, failed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const row of queue) {
    const location = parseWasabiLocation(row);
    if (!location) {
      failed += 1;
      await supabaseAdmin
        .from("segment_insight_audio_deletions")
        .update({
          status: "failed",
          attempt_count: (row.attempt_count ?? 0) + 1,
          last_error: "Missing bucket/key for Wasabi object.",
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    const { bucket, key } = location;
    const resolvedBucket = bucket || DEFAULT_BUCKET;
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: resolvedBucket, Key: key }));
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Delete failed.";
      await supabaseAdmin
        .from("segment_insight_audio_deletions")
        .update({
          status: "failed",
          attempt_count: (row.attempt_count ?? 0) + 1,
          last_error: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    await supabaseAdmin
      .from("segment_insight_audio_deletions")
      .update({
        status: "completed",
        attempt_count: (row.attempt_count ?? 0) + 1,
        last_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    processed += 1;
  }

  return jsonResponse({ processed, failed });
}));
