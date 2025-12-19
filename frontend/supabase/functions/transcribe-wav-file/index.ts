import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};
serve(async (req)=>{
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
        headers: corsHeaders
      });
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return new Response(JSON.stringify({
        error: "No file provided"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([
      arrayBuffer
    ], {
      type: file.type
    });
    // Call OpenAI Whisper API
    const form = new FormData();
    form.append("file", blob, file.name);
    form.append("model", "whisper-1");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`
      },
      body: form
    });
    const data = await response.json();
    return new Response(JSON.stringify({
      transcription: data.text
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
