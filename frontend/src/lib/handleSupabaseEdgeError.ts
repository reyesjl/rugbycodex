/**
 * @deprecated This error handler is deprecated. Use `handleEdgeFunctionError` from 
 * `@/lib/handleEdgeFunctionError` instead, which follows Supabase's official error 
 * handling best practices with proper instanceof checks for FunctionsHttpError, 
 * FunctionsRelayError, and FunctionsFetchError.
 * 
 * This file is kept temporarily for backward compatibility and will be removed in a future release.
 * All services have been migrated to the new handler as of 2026-01-23.
 */

function parseJson(text: string | null | undefined) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface NormalizedError extends Error {
  code?: string;
  status?: number;
}

export async function handleSupabaseEdgeError(
  error: any,
  fallbackMessage = "Unexpected error communicating with server."
): Promise<NormalizedError> {
  let parsed: any = null;

  // Try multiple paths to find the error body
  if (error?.context) {
    if (typeof error.context === "string") {
      parsed = parseJson(error.context);
    } else if (typeof error.context?.text === "function") {
      try {
        const bodyText = await error.context.clone().text();
        parsed = parseJson(bodyText);
      } catch {}
    } else if (typeof error.context?.body === "string") {
      parsed = parseJson(error.context.body);
    } else if (typeof error.context?.body === "object" && error.context.body !== null) {
      // Body might already be parsed
      parsed = error.context.body;
    }
  }

  if (!parsed && error?.context?.response?.body) {
    parsed = parseJson(error?.context?.response?.body);
  }

  // Extract message from parsed error structure
  const message =
    parsed?.error?.message ||
    parsed?.message ||
    error?.message ||
    fallbackMessage;

  // Create normalized error with better typing
  const normalized = new Error(message) as NormalizedError;

  // Attach code and status if available
  normalized.code =
    parsed?.error?.code ||
    parsed?.code ||
    error?.code ||
    undefined;

  normalized.status =
    error?.status ||
    parsed?.status ||
    error?.context?.status ||
    error?.context?.statusCode ||
    undefined;

  return normalized;
}
