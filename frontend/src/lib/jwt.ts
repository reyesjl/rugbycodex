import { jwtDecode } from 'jwt-decode';

export interface SupabaseJwtClaims {
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  role?: string;
  sub?: string;
  user_role?: string;
  [key: string]: unknown;
}

export const decodeSupabaseAccessToken = (accessToken?: string) => {
  if (!accessToken) return null;

  try {
    return jwtDecode<SupabaseJwtClaims>(accessToken);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[auth] Failed to decode Supabase access token.', error);
    }
    return null;
  }
};
