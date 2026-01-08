import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors, jsonResponse } from '../_shared/cors.ts';
import { getAuthContext } from '../_shared/auth.ts';

serve(async (req) => {
  // Handle preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Authenticate user
    const { userId } = await getAuthContext(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400);
    }

    // Validate file type - only accept WebM
    const fileType = file.type || '';
    const isWebM = fileType.includes('webm') || file.name.endsWith('.webm');

    if (!isWebM) {
      return jsonResponse({ error: "Invalid file type. Only WebM audio files are supported." }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([
      arrayBuffer
    ], {
      type: 'audio/webm'
    });
    // Call OpenAI Whisper API
    const form = new FormData();
    form.append("file", blob, 'audio.webm');
    form.append("model", "whisper-1");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`
      },
      body: form
    });
    const data = await response.json();
    return jsonResponse({ text: data.text });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err.message }, 500);
  }
});
