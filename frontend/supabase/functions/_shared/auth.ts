// supabase/functions/_shared/auth.ts
import { createClient } from 'npm:@supabase/supabase-js@2.47.10';

export interface AuthContext {
  userId: string | null;
  isAdmin: boolean;
}

function getClientBoundToRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}

/**
 * getAuthContext
 * - Verifies the access token via auth.getUser()
 * - Extracts user_role only from the verified session payload
 * - Returns { userId, isAdmin }
 */
export async function getAuthContext(req: Request): Promise<AuthContext> {
  const supabase = getClientBoundToRequest(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { userId: null, isAdmin: false };
  }

  const userId = data.user.id ?? null;

  // Supabase-js does not expose raw claims directly, but for verified sessions,
  // Supabase maps custom claims to user.user_metadata if configured. Since your claim
  // is top-level in the JWT (user_role), we must read it from the verified token context.
  // To avoid trusting unverified token decoding, we fetch the access token from the header
  // and re-decode ONLY for this specific verified context.
  // This is safe because getUser() succeeded (token verified by Supabase).
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let isAdmin = false;
  if (token) {
    try {
      const [, payloadB64] = token.split('.');
      if (payloadB64) {
        const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        // Use only the claim user_role from the verified token, not any metadata.
        isAdmin = payload?.user_role === 'admin';
      }
    } catch {
      // Fall through: if decoding fails, treat as non-admin
      isAdmin = false;
    }
  }

  return { userId, isAdmin };
}