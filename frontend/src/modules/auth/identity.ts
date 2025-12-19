import type { User } from '@supabase/supabase-js';
import { useAuthStore } from '@/auth/stores/useAuthStore';

export function requireUserId(): string {
  const authStore = useAuthStore();

  if (!authStore.hydrated || authStore.initializing) {
    throw new Error('Auth is still loading. Please try again.');
  }

  if (!authStore.user) {
    throw new Error('Not authenticated');
  }

  return authStore.user.id;
}

export function requireAuthUser(): User {
  const authStore = useAuthStore();

  if (!authStore.hydrated || authStore.initializing) {
    throw new Error('Auth is still loading. Please try again.');
  }

  if (!authStore.user) {
    throw new Error('Not authenticated');
  }
  
  return authStore.user;
}

export function isPlatformAdmin(): boolean {
  const authStore = useAuthStore();
  return Boolean(authStore.isAdmin);
}