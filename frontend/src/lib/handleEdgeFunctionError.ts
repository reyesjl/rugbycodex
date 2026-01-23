/**
 * Error handling utilities for Supabase Edge Functions.
 * Follows official Supabase best practices for error handling.
 * 
 * @see https://supabase.com/docs/guides/functions/error-handling
 */

import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

/**
 * Normalized error interface with code and status.
 */
export interface NormalizedError extends Error {
  code?: string;
  status?: number;
  isHttpError?: boolean;
  isRelayError?: boolean;
  isFetchError?: boolean;
}

/**
 * Handles errors from Supabase Edge Function invocations using official error types.
 * 
 * Supabase Edge Functions can throw three types of errors:
 * - FunctionsHttpError: Function executed but returned an error (4xx/5xx)
 * - FunctionsRelayError: Network issue between client and Supabase
 * - FunctionsFetchError: Function couldn't be reached at all
 * 
 * @param error - The error object from supabase.functions.invoke()
 * @param fallbackMessage - Default message if no error message is available
 * @returns Normalized error object with code, status, and error type flags
 * 
 * @example
 * ```typescript
 * const { data, error } = await supabase.functions.invoke('my-function', {...});
 * if (error) {
 *   const normalized = await handleEdgeFunctionError(error);
 *   console.log(normalized.message, normalized.code, normalized.status);
 * }
 * ```
 */
export async function handleEdgeFunctionError(
  error: unknown,
  fallbackMessage = "Unexpected error communicating with server."
): Promise<NormalizedError> {
  // Handle FunctionsHttpError - function executed but returned error
  if (error instanceof FunctionsHttpError) {
    let errorBody: any = null;
    
    try {
      errorBody = await error.context.json();
    } catch {
      // If JSON parsing fails, try text
      try {
        const text = await error.context.text();
        errorBody = { message: text };
      } catch {
        // Leave as null if both fail
      }
    }

    const message =
      errorBody?.error?.message ||
      errorBody?.message ||
      error.message ||
      fallbackMessage;

    const normalized = new Error(message) as NormalizedError;
    normalized.code = errorBody?.error?.code || errorBody?.code;
    normalized.status = error.context.status;
    normalized.isHttpError = true;
    normalized.isRelayError = false;
    normalized.isFetchError = false;

    return normalized;
  }

  // Handle FunctionsRelayError - network issue between client and Supabase
  if (error instanceof FunctionsRelayError) {
    const normalized = new Error(
      error.message || "Network error communicating with Supabase."
    ) as NormalizedError;
    normalized.code = "RELAY_ERROR";
    normalized.isHttpError = false;
    normalized.isRelayError = true;
    normalized.isFetchError = false;

    return normalized;
  }

  // Handle FunctionsFetchError - function couldn't be reached
  if (error instanceof FunctionsFetchError) {
    const normalized = new Error(
      error.message || "Could not reach the edge function."
    ) as NormalizedError;
    normalized.code = "FETCH_ERROR";
    normalized.isHttpError = false;
    normalized.isRelayError = false;
    normalized.isFetchError = true;

    return normalized;
  }

  // Handle generic errors
  const message =
    error instanceof Error ? error.message : fallbackMessage;

  const normalized = new Error(message) as NormalizedError;
  normalized.code = "UNKNOWN_ERROR";
  normalized.isHttpError = false;
  normalized.isRelayError = false;
  normalized.isFetchError = false;

  return normalized;
}

/**
 * Checks if an error is retryable based on Supabase error types.
 * 
 * Retryable errors:
 * - FunctionsFetchError (network/connection issues)
 * - FunctionsRelayError (Supabase relay issues)
 * - FunctionsHttpError with status 503 (service unavailable)
 * 
 * Non-retryable errors:
 * - FunctionsHttpError with 4xx status (client errors)
 * - FunctionsHttpError with 500 status (server errors that won't resolve)
 * 
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof FunctionsFetchError) {
    return true;
  }

  if (error instanceof FunctionsRelayError) {
    return true;
  }

  if (error instanceof FunctionsHttpError) {
    return error.context.status === 503;
  }

  return false;
}

/**
 * Checks if an error is a "not found" error (404).
 * 
 * @param error - The error to check
 * @returns true if the error is a 404
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof FunctionsHttpError) {
    return error.context.status === 404;
  }
  return false;
}

/**
 * Gets the HTTP status code from an error, if available.
 * 
 * @param error - The error to extract status from
 * @returns HTTP status code or null if not available
 */
export function getErrorStatus(error: unknown): number | null {
  if (error instanceof FunctionsHttpError) {
    return error.context.status;
  }
  return null;
}
