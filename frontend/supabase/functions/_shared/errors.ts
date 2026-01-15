// supabase/functions/_shared/errors.ts
import { jsonResponse } from "./cors.ts";

export type ErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "AUTH_REQUIRED"
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
  | "UNEXPECTED_SERVER_ERROR";

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
) {
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
