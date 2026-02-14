import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import { getServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { withObservability } from "../_shared/observability.ts";

type CleanupJobRow = {
  id: string;
  bucket: string | null;
  storage_path: string | null;
};

const WASABI_S3_ENDPOINT = Deno.env.get("WASABI_ENDPOINT") ?? "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = Deno.env.get("WASABI_REGION") ?? "us-east-1";
const DEFAULT_BUCKET = Deno.env.get("WASABI_BUCKET_NAME") ?? "rugbycodex";

function buildDeletePrefix(storagePath: string): string | null {
  const cleaned = storagePath.replace(/^\/+/, "").trim();
  if (!cleaned) return null;
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const prefixParts = parts.slice(0, -2);
  if (prefixParts.length === 0) return null;
  const prefix = `${prefixParts.join("/")}/`;
  if (!prefix.startsWith("orgs/")) return null;
  return prefix;
}

async function deletePrefix(
  s3: S3Client,
  bucket: string,
  prefix: string,
): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (response.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => !!key)
      .map((key) => ({ Key: key }));

    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      deleted += objects.length;
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deleted;
}

Deno.serve(withObservability("cleanup-media-assets", async (req: Request) => {
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
    .from("media_cleanup_jobs")
    .select("id, bucket, storage_path")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load media cleanup jobs.", 500);
  }

  const queue = (rows ?? []) as CleanupJobRow[];
  if (queue.length === 0) {
    return jsonResponse({ processed: 0, failed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const row of queue) {
    const storagePath = (row.storage_path ?? "").trim();
    const prefix = buildDeletePrefix(storagePath);
    const bucket = (row.bucket ?? "").trim() || DEFAULT_BUCKET;

    if (!prefix || !bucket) {
      failed += 1;
      await supabaseAdmin
        .from("media_cleanup_jobs")
        .update({
          processed_at: new Date().toISOString(),
          error: "Invalid bucket or storage_path.",
        })
        .eq("id", row.id);
      continue;
    }

    try {
      await deletePrefix(s3, bucket, prefix);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : "Delete failed.";
      await supabaseAdmin
        .from("media_cleanup_jobs")
        .update({
          processed_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", row.id);
      continue;
    }

    await supabaseAdmin
      .from("media_cleanup_jobs")
      .update({
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", row.id);
    processed += 1;
  }

  return jsonResponse({ processed, failed });
}));
