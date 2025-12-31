function parseJson(text: string | null | undefined) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function handleSupabaseEdgeError(
  error: any,
  fallbackMessage = "Unexpected error communicating with server."
): Promise<Error & { code?: string; status?: number }> {
  let parsed: any = null;

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
    }
  }

  if (!parsed) {
    parsed = parseJson(error?.context?.response?.body);
  }

  const message =
    parsed?.error?.message ||
    parsed?.message ||
    error?.message ||
    fallbackMessage;

  const normalized = new Error(message) as Error & {
    code?: string;
    status?: number;
  };

  normalized.code =
    parsed?.error?.code ||
    parsed?.code ||
    error?.code ||
    null;

  normalized.status =
    error?.status ||
    parsed?.status ||
    error?.context?.status ||
    error?.context?.statusCode;

  return normalized;
}
