// supabase/functions/_shared/errors.ts
import { jsonResponse } from "./cors.ts";

/**
 * Standardized error codes for edge functions.
 * Following Supabase best practices for error handling.
 * @see https://supabase.com/docs/guides/functions/error-handling
 */
export type ErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_TOKEN"
  | "ORG_ID_REQUIRED"
  | "FORBIDDEN"
  | "JOIN_CODE_REQUIRED"
  | "JOIN_CODE_EMPTY"
  | "JOIN_CODE_INVALID"
  | "JOIN_CODE_EXPIRED"
  | "MEMBERSHIP_LOOKUP_FAILED"
  | "ORG_LOOKUP_FAILED"
  | "JOIN_FAILED"
  | "PRIMARY_ORG_UPDATE_FAILED"
  | "NARRATION_ID_REQUIRED"
  | "NARRATION_NOT_FOUND"
  | "NARRATION_LOOKUP_FAILED"
  | "NO_TRANSCRIPT"
  | "OPENAI_API_KEY_MISSING"
  | "OPENAI_EMBEDDING_FAILED"
  | "EMBEDDING_DIMENSION_MISMATCH"
  | "EMBEDDING_UPDATE_FAILED"
  | "BACKFILL_SELECT_FAILED"
  | "WASABI_CREDENTIALS_MISSING"
  | "WASABI_STS_FAILED"
  | "WASABI_UPLOAD_FAILED"
  | "MEDIA_ASSET_CREATE_FAILED"
  | "MISSING_REQUIRED_FIELDS"
  | "INVALID_BUCKET"
  | "INVALID_FILE_SIZE"
  | "STORAGE_QUOTA_EXCEEDED"
  | "DB_QUERY_FAILED"
  | "UNEXPECTED_SERVER_ERROR";

/**
 * Creates a standardized error response following Supabase best practices.
 * 
 * Returns a JSON response with structure:
 * ```json
 * {
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable error message"
 *   }
 * }
 * ```
 * 
 * Best practices:
 * - Use appropriate HTTP status codes (400, 401, 403, 404, 500)
 * - Always log errors with console.error() before returning
 * - Include helpful error messages for debugging
 * 
 * @param code - Typed error code from ErrorCode enum
 * @param message - Human-readable error message
 * @param status - HTTP status code (default: 400)
 * @param logError - Whether to log the error (default: true)
 * @returns Response object with proper headers and error structure
 * 
 * @see https://supabase.com/docs/guides/functions/error-handling
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
  logError: boolean = true,
) {
  if (logError) {
    console.error(`[${code}] ${message}`);
  }
  
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    status,
  );
}
