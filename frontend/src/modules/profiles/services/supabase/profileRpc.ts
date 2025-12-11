import { supabase } from '@/lib/supabaseClient';

export async function isUsernameAvailableRpc(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: username,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
