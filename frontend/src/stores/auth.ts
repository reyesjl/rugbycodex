import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Session, Subscription, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const initializing = ref(false);
  const hydrated = ref(false);
  const lastError = ref<string | null>(null);

  let initPromise: Promise<void> | null = null;
  let subscription: Subscription | null = null;

  const setAuthState = (nextSession: Session | null) => {
    session.value = nextSession;
    user.value = nextSession?.user ?? null;
  };

  const initialize = async () => {
    if (hydrated.value) return;
    if (initPromise) {
      await initPromise;
      return;
    }

    initPromise = (async () => {
      initializing.value = true;
      lastError.value = null;

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        lastError.value = error.message;
      }

      setAuthState(data?.session ?? null);
      hydrated.value = true;
      initializing.value = false;

      if (!subscription) {
        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          setAuthState(nextSession);
        });
        subscription = listener.subscription;
      }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  };

  const signIn = async (email: string, password: string) => {
    lastError.value = null;
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (result.error) {
      lastError.value = result.error.message;
      return { data: null, error: result.error };
    }

    setAuthState(result.data.session ?? null);
    return { data: result.data, error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) => {
    lastError.value = null;
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (result.error) {
      lastError.value = result.error.message;
      return { data: null, error: result.error };
    }

    setAuthState(result.data.session ?? null);
    return { data: result.data, error: null };
  };

  const signOut = async () => {
    lastError.value = null;
    const { error } = await supabase.auth.signOut();
    if (error) {
      lastError.value = error.message;
      return { error };
    }
    setAuthState(null);
    return { error: null };
  };

  const isAuthenticated = computed(() => Boolean(user.value));

  return {
    user,
    session,
    isAuthenticated,
    initializing,
    hydrated,
    lastError,
    initialize,
    signIn,
    signUp,
    signOut,
  };
});
