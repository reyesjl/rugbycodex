import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

const WASABI_S3_ENDPOINT = "https://s3.us-east-1.wasabisys.com";
const WASABI_REGION = "us-east-1";
const DEFAULT_BUCKET = "rugbycodex";
const CDN_BASE_URL = "https://cdn.rugbycodex.com";
const DEFAULT_VOICE_ID = "rNzVNTrvSffyxdrTbLKv";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

type SegmentInsightRow = {
  id: string;
  coach_script: string | null;
  coach_audio_url?: string | null;
  coach_audio_generated_at?: string | null;
};

type SegmentRow = {
  id: string;
  media_asset_id: string;
};

type AssetRow = {
  id: string;
  org_id: string;
  bucket: string | null;
  base_org_storage_path: string | null;
};

function buildCoachAudioPath(orgId: string, mediaSegmentId: string): string {
  return `orgs/${orgId}/insights/segments/${mediaSegmentId}/coach.mp3`;
}

async function generateCoachAudio(params: { text: string; voiceId: string; apiKey: string }) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": params.apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: DEFAULT_MODEL_ID,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ElevenLabs request failed (${response.status}): ${text || response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function resolveVoiceId(apiKey: string): Promise<string> {
  const envVoice = Deno.env.get("ELEVENLABS_VOICE_ID") ?? "";
  if (envVoice) return envVoice;
  if (DEFAULT_VOICE_ID) return DEFAULT_VOICE_ID;

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ElevenLabs voices request failed (${response.status}): ${text || response.statusText}`);
  }

  const data = (await response.json()) as { voices?: Array<{ voice_id?: string; category?: string }> };
  const voices = Array.isArray(data?.voices) ? data.voices : [];
  const nonLibrary = voices.find((voice) => String(voice?.category ?? "").toLowerCase() !== "library");
  const selected = nonLibrary ?? voices[0];
  const voiceId = String(selected?.voice_id ?? "").trim();
  if (!voiceId) {
    throw new Error("No available ElevenLabs voice found.");
  }
  return voiceId;
}

Deno.serve(withObservability("generate-coach-audio", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    const { userId } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid JSON body", 400);
    }

    const mediaSegmentId = String(body?.media_segment_id ?? body?.mediaSegmentId ?? "").trim();
    if (!mediaSegmentId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "media_segment_id is required", 400);
    }
    const forceRefresh = Boolean(body?.force_refresh ?? body?.forceRefresh);

    const supabase = getClientBoundToRequest(req);
    const serviceRoleClient = getServiceRoleClient();

    const { data: segment, error: segmentError } = await supabase
      .from("media_asset_segments")
      .select("id, media_asset_id")
      .eq("id", mediaSegmentId)
      .maybeSingle();

    if (segmentError) {
      console.error("generate_coach_audio segment error", segmentError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load media segment", 500);
    }
    if (!segment) {
      return errorResponse("NOT_FOUND", "Media segment not found", 404);
    }

    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, bucket, base_org_storage_path")
      .eq("id", (segment as SegmentRow).media_asset_id)
      .maybeSingle();

    if (assetError) {
      console.error("generate_coach_audio media_assets error", assetError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load media asset", 500);
    }
    if (!asset) {
      return errorResponse("NOT_FOUND", "Media asset not found", 404);
    }

    const orgId = String((asset as AssetRow).org_id ?? "").trim();
    if (!orgId) {
      return errorResponse("UNEXPECTED_SERVER_ERROR", "Media asset missing org_id", 500);
    }

    try {
      const { role, source } = await getUserRoleFromRequest(req, { supabase, orgId });
      requireOrgRoleSource(source);
      requireRole(role, "member");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    const { data: insight, error: insightError } = await supabase
      .from("segment_insights")
      .select("id, coach_script, coach_audio_url, coach_audio_generated_at")
      .eq("media_segment_id", mediaSegmentId)
      .eq("is_active", true)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (insightError) {
      console.error("generate_coach_audio segment_insights error", insightError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load segment insight", 500);
    }

    if (!insight) {
      return errorResponse("NOT_FOUND", "Segment insight not found", 404);
    }

    const insightRow = insight as SegmentInsightRow;
    const coachScript = String(insightRow.coach_script ?? "").trim();
    if (!coachScript) {
      return errorResponse("INVALID_REQUEST", "Segment insight is missing coach_script", 400);
    }

    const storagePath = buildCoachAudioPath(orgId, mediaSegmentId);
    const cdnUrl = `${CDN_BASE_URL}/${storagePath}`;

    if (insightRow.coach_audio_url && !forceRefresh) {
      const normalizedUrl = insightRow.coach_audio_url.startsWith(CDN_BASE_URL)
        ? insightRow.coach_audio_url
        : cdnUrl;
      if (normalizedUrl !== insightRow.coach_audio_url) {
        await serviceRoleClient
          .from("segment_insights")
          .update({ coach_audio_url: normalizedUrl })
          .eq("id", insightRow.id);
      }
      return jsonResponse({
        coach_audio_url: normalizedUrl,
        coach_audio_generated_at: insightRow.coach_audio_generated_at ?? null,
      });
    }

    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
    if (!elevenLabsKey) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "ELEVENLABS_API_KEY is not configured", 500);
    }

    const voiceId = await resolveVoiceId(elevenLabsKey);
    const audioBytes = await generateCoachAudio({ text: coachScript, voiceId, apiKey: elevenLabsKey });

    const accessKeyId = Deno.env.get("WASABI_UPLOADER_KEY") ?? "";
    const secretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET") ?? "";
    if (!accessKeyId || !secretAccessKey) {
      return errorResponse("WASABI_CREDENTIALS_MISSING", "Uploader credentials not configured", 500);
    }

    const bucket = String((asset as AssetRow).bucket ?? DEFAULT_BUCKET);
    const uploaderS3 = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_S3_ENDPOINT,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    try {
      await uploaderS3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: storagePath,
        Body: audioBytes,
        ContentType: "audio/mpeg",
      }));
    } catch (err) {
      console.error("generate_coach_audio upload error", err);
      return errorResponse("WASABI_UPLOAD_FAILED", "Failed to upload coach audio", 500);
    }

    const coachAudioUrl = cdnUrl;
    const generatedAt = new Date().toISOString();

    const { error: updateError } = await serviceRoleClient
      .from("segment_insights")
      .update({
        coach_audio_url: coachAudioUrl,
        coach_audio_generated_at: generatedAt,
      })
      .eq("id", insightRow.id);

    if (updateError) {
      console.error("generate_coach_audio update error", updateError);
      return errorResponse("DB_QUERY_FAILED", "Failed to save coach audio", 500);
    }

    return jsonResponse({
      coach_audio_url: coachAudioUrl,
      coach_audio_generated_at: generatedAt,
    });
  } catch (err) {
    console.error("generate_coach_audio unexpected error", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));
