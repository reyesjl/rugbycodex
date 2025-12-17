import { useAuthStore } from '@/auth/stores/useAuthStore';

export function requireUserId(): string {
  const auth = useAuthStore();
  if (!auth.user) {
    throw new Error('Not authenticated');
  }
  return auth.user.id;
}

export function isPlatformAdmin(): boolean {
  const auth = useAuthStore();
  return Boolean(auth.isAdmin);
}