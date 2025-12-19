import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
Deno.serve(async (req)=>{
  try {
    const { org_id, file_name, media_id, contentType } = await req.json();
    if (!org_id || !media_id || !file_name) {
      return new Response(JSON.stringify({
        error: "Missing required fields"
      }), {
        status: 400
      });
    }
    const region = "us-east-1";
    const endpoint = "https://s3.us-east-1.wasabisys.com";
    const bucket = "rugbycodex";
    const accessKeyId = Deno.env.get("WASABI_KEY");
    const secretAccessKey = Deno.env.get("WASABI_SECRET");
    const s3 = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    // Build the directory structure: YYYY/MM
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    // Build the final key
    // orgs/<org_id>/media/YYYY/MM/<media_id>-<file_name>
    const key = `orgs/${org_id}/media/${year}/${month}/${media_id}-${file_name}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType ?? "application/octet-stream"
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 600
    });
    return new Response(JSON.stringify({
      uploadUrl,
      key
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: `${err}`
    }), {
      status: 500
    });
  }
});
