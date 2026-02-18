import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { withObservability } from "../_shared/observability.ts";

const ROLE_VALUES = new Set(["union", "team", "coach", "player"]);
const URGENCY_VALUES = new Set(["exploring", "3_months", "asap"]);
const PAYMENT_VALUES = new Set(["yes", "maybe", "not_now"]);

type WaitlistPayload = {
  email: string;
  first_name?: string | null;
  organization_name?: string | null;
  role: string;
  primary_problem: string;
  urgency: string;
  early_access_payment: string;
};

function getMailgunConfig() {
  const apiKey = Deno.env.get("MAILGUN_API_KEY");
  const domain = Deno.env.get("MAILGUN_DOMAIN");
  const fromEmail = Deno.env.get("MAILGUN_FROM_EMAIL");
  const internalEmail = Deno.env.get("WAITLIST_INTERNAL_EMAIL");

  if (!apiKey || !domain || !fromEmail || !internalEmail) {
    throw new Error("Missing required Mailgun env vars: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL, WAITLIST_INTERNAL_EMAIL.");
  }

  return { apiKey, domain, fromEmail, internalEmail };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizePayload(body: unknown): WaitlistPayload | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const first_name = typeof payload.first_name === "string" ? payload.first_name.trim() : "";
  const organization_name = typeof payload.organization_name === "string" ? payload.organization_name.trim() : "";
  const role = typeof payload.role === "string" ? payload.role : "";
  const primary_problem = typeof payload.primary_problem === "string" ? payload.primary_problem.trim() : "";
  const urgency = typeof payload.urgency === "string" ? payload.urgency : "";
  const early_access_payment = typeof payload.early_access_payment === "string" ? payload.early_access_payment : "";

  if (!email || !role || !primary_problem || !urgency || !early_access_payment) return null;
  if (!isValidEmail(email)) return null;
  if (!ROLE_VALUES.has(role) || !URGENCY_VALUES.has(urgency) || !PAYMENT_VALUES.has(early_access_payment)) return null;

  return {
    email,
    first_name: first_name || null,
    organization_name: organization_name || null,
    role,
    primary_problem,
    urgency,
    early_access_payment,
  };
}

async function sendMailgunEmail(params: {
  apiKey: string;
  domain: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
}) {
  const endpoint = `https://api.mailgun.net/v3/${params.domain}/messages`;
  const body = new URLSearchParams({
    from: params.fromEmail,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${params.apiKey}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Mailgun request failed (${response.status}): ${details}`);
  }
}

Deno.serve(withObservability("waitlist-confirmation", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST requests are allowed.", 405);
  }

  let payload: WaitlistPayload | null = null;
  try {
    payload = normalizePayload(await req.json());
  } catch {
    return errorResponse("INVALID_REQUEST_BODY", "Request body must be valid JSON.", 400);
  }

  if (!payload) {
    return errorResponse("MISSING_REQUIRED_FIELDS", "Invalid or missing waitlist fields.", 400);
  }

  let config: ReturnType<typeof getMailgunConfig>;
  try {
    config = getMailgunConfig();
  } catch (configError) {
    const message = configError instanceof Error ? configError.message : "Missing Mailgun configuration.";
    return errorResponse("CONFIG_ERROR", message, 500);
  }

  const friendlyName = payload.first_name?.trim() ? payload.first_name.trim() : "there";
  const organizationPart = payload.organization_name ? `${payload.organization_name.trim()}` : "";

  const confirmationText = [
    `Hi ${friendlyName},`,
    "",
    "////////////////////////////////////////////////////////////",
    "RUGBYCODEX WAITLISTED",
    "////////////////////////////////////////////////////////////",
    "",
    "Status: Registered",
    "Tier: Early Partner",
    `Node ID: ${organizationPart}`,
    "",
    "You are now in the RugbyCodex pilot queue.",
    "",
    "We are activating a limited number of teams during this phase.",
    "Each onboarding cycle allows us to integrate directly with real",
    "match analysis workflows and refine the system in live conditions.",
    "",
    "Access priority is determined by:",
    "• Team readiness",
    "• Analytical intensity",
    "• Deployment urgency",
    "",
    "When a pilot slot unlocks, this node will be notified.",
    "",
    "Thank you for entering the system early.",
    "",
    "— RugbyCodex // Performance Intelligence Layer",
  ].join("\n");

  const internalText = [
    "New Rugbycodex waitlist submission",
    "",
    `email: ${payload.email}`,
    `first_name: ${payload.first_name ?? ""}`,
    `organization_name: ${payload.organization_name ?? ""}`,
    `role: ${payload.role}`,
    `primary_problem: ${payload.primary_problem}`,
    `urgency: ${payload.urgency}`,
    `early_access_payment: ${payload.early_access_payment}`,
  ].join("\n");

  try {
    await Promise.all([
      sendMailgunEmail({
        apiKey: config.apiKey,
        domain: config.domain,
        fromEmail: config.fromEmail,
        to: payload.email,
        subject: "You're on the Waitlist",
        text: confirmationText,
      }),
      sendMailgunEmail({
        apiKey: config.apiKey,
        domain: config.domain,
        fromEmail: config.fromEmail,
        to: config.internalEmail,
        subject: "New waitlist submission",
        text: internalText,
      }),
    ]);
  } catch (mailError) {
    const message = mailError instanceof Error ? mailError.message : "Failed to send waitlist emails.";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 502);
  }

  return jsonResponse({ success: true }, 200);
}));
