import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AuthError, Session, Subscription, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { decodeSupabaseAccessToken } from '@/lib/jwt';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';
import { setAxiomContext, clearAxiomContext } from '@/lib/axiom';
import { logInfo } from '@/lib/logger';

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 60;
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
const FRIENDLY_CAPTCHA_ERROR = 'Verification failed. Please complete the security check and try again.';

export const useAuthStore = defineStore('auth', () => {
  const userContextStore = useUserContextStore();
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const initializing = ref(false);
  const hydrated = ref(false);
  const lastError = ref<string | null>(null);

  const isAdmin = ref(false);

  let initPromise: Promise<void> | null = null;
  let subscription: Subscription | null = null;

  const normalizeAuthError = (error: AuthError | null) => {
    if (!error) return null;
    const normalizedMessage = error.message?.toLowerCase() ?? '';
    if (normalizedMessage.includes('captcha protection')) {
      return {
        ...error,
        message: FRIENDLY_CAPTCHA_ERROR,
      } as AuthError;
    }
    return error;
  };

  const setAuthState = (nextSession: Session | null) => {
    session.value = nextSession;
    user.value = nextSession?.user ?? null;

    if (nextSession?.access_token) {
      const claims = decodeSupabaseAccessToken(nextSession.access_token);
      if (claims) {
        isAdmin.value = claims?.user_role === 'admin';
        if (import.meta.env.DEV) {
          console.info('[auth] Supabase JWT claims', claims);
        }

        // Update Axiom context with user info
        setAxiomContext({
          user_id: nextSession.user.id,
          user_email: nextSession.user.email,
          user_role: claims?.user_role || 'user',
          is_admin: claims?.user_role === 'admin',
        });

        logInfo('User authenticated', {
          user_id: nextSession.user.id,
          auth_provider: nextSession.user.app_metadata?.provider,
        });
      }
    } else {
      isAdmin.value = false;
    }
  };

  const clearAuthState = () => {
    setAuthState(null);
    // Clear user context from Axiom
    clearAxiomContext();
    logInfo('User logged out');
  };

  const looksLikeSessionExpiry = (error: AuthError | null) => {
    if (!error) return false;
    const status = (error as AuthError & { status?: number }).status;
    const normalizedMessage = error.message?.toLowerCase() ?? '';

    if (typeof status === 'number') {
      if (status === 401) {
        return true;
      }
      if (status === 400 && normalizedMessage.includes('session')) {
        return true;
      }
    }

    return normalizedMessage.includes('session missing');
  };

  const handleSessionExpiry = async (error: AuthError | null, options?: { skipServerSignOut?: boolean }) => {
    if (!looksLikeSessionExpiry(error)) {
      return false;
    }

    clearAuthState();

    if (!options?.skipServerSignOut) {
      try {
        await supabase.auth.signOut();
      } catch {
        // best effort; ignore follow-up errors
      }
    }

    return true;
  };

  const createSessionExpiredError = () => new Error(SESSION_EXPIRED_MESSAGE);

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
        const handled = await handleSessionExpiry(error);
        if (!handled) {
          lastError.value = error.message;
        }
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

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    console.log(JSON.stringify({
      severity: 'info',
      event_type: 'login_start',
      email,
    }));
    lastError.value = null;
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken
        ? {
            captchaToken,
          }
        : undefined,
    });

    if (result.error) {
      const normalizedError = normalizeAuthError(result.error) ?? result.error;
      lastError.value = normalizedError.message;
      console.log(JSON.stringify({
        severity: 'error',
        event_type: 'login_failure',
        error_code: normalizedError?.status ? `AUTH_${normalizedError.status}` : 'AUTH_FAILED',
        error_message: normalizedError.message,
      }));
      return { data: null, error: normalizedError };
    }

    setAuthState(result.data.session ?? null);
    console.log(JSON.stringify({
      severity: 'info',
      event_type: 'login_success',
      user_id: result.data.session?.user?.id ?? null,
    }));
    return { data: result.data, error: null };
  };

  const resendConfirmationEmail = async (email: string, redirectTo?: string, captchaToken?: string) => {
    lastError.value = null;
    const emailRedirectTo =
      redirectTo ?? (typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm-email` : undefined);

    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: emailRedirectTo
        ? {
            emailRedirectTo,
            captchaToken: captchaToken || undefined,
          }
        : captchaToken
          ? { captchaToken }
          : undefined,
    });

    if (error) {
      lastError.value = error.message;
      return { data: null, error };
    }

    return { data, error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
    redirectTo?: string,
    captchaToken?: string,
  ) => {
    lastError.value = null;
    const emailRedirectTo =
      redirectTo ?? (typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm-email` : undefined);

    const options: {
      data?: Record<string, unknown>;
      emailRedirectTo?: string;
      captchaToken?: string;
    } = {};

    if (metadata) {
      options.data = metadata;
    }

    if (captchaToken) {
      options.captchaToken = captchaToken;
    }

    if (emailRedirectTo) {
      options.emailRedirectTo = emailRedirectTo;
    }

    const result = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (result.error) {
      const normalizedError = normalizeAuthError(result.error) ?? result.error;
      lastError.value = normalizedError.message;
      return { data: null, error: normalizedError };
    }

    setAuthState(result.data.session ?? null);
    return { data: result.data, error: null };
  };

  const signOut = async () => {
    lastError.value = null;
    console.log(JSON.stringify({
      severity: 'info',
      event_type: 'logout',
      user_id: user.value?.id ?? null,
    }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      const handled = await handleSessionExpiry(error, { skipServerSignOut: true });
      if (!handled) {
        lastError.value = error.message;
        return { error };
      }
      lastError.value = null;
      return { error: null };
    }
    clearAuthState();
    
    // Clear user context
    userContextStore.clear();
    
    return { error: null };
  };

  const resetPassword = async (email: string, redirectTo?: string, captchaToken?: string) => {
    lastError.value = null;
    const url =
      redirectTo ??
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: url,
      captchaToken,
    });

    if (error) {
      const normalizedError = normalizeAuthError(error) ?? error;
      lastError.value = normalizedError.message;
      return { error: normalizedError };
    }

    return { error: null };
  };

  const updatePassword = async (password: string) => {
    lastError.value = null;
    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      if (await handleSessionExpiry(error)) {
        const sessionError = createSessionExpiredError();
        lastError.value = sessionError.message;
        return { data: null, error: sessionError };
      }
      lastError.value = error.message;
      return { data: null, error };
    }

    const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError) {
      setAuthState(sessionResult.session ?? null);
    }

    return { data, error: null };
  };

  const isAuthenticated = computed(() => Boolean(user.value));
  const userReadonly = computed(() => user.value);
  const sessionReadonly = computed(() => session.value);
  const isAdminReadonly = computed(() => isAdmin.value);
  const initializingReadonly = computed(() => initializing.value);
  const hydratedReadonly = computed(() => hydrated.value);
  const lastErrorReadonly = computed(() => lastError.value);

  /**
   * Initialize user context after authentication.
   * This loads the user's profile and organization memberships in a single optimized query.
   */
  const initializePostAuthContext = async () => {
    if (!isAuthenticated.value) return;
    
    // Load unified user context (profile + organizations)
    if (!userContextStore.isReady) {
      await userContextStore.load();
    }
  };

  const updateDisplayName = async (name: string) => {
    lastError.value = null;
    const trimmedName = name?.trim() ?? '';

    if (!trimmedName) {
      const validationError = new Error('Display name is required.');
      lastError.value = validationError.message;
      return { data: null, error: validationError };
    }

    if (
      trimmedName.length < DISPLAY_NAME_MIN_LENGTH ||
      trimmedName.length > DISPLAY_NAME_MAX_LENGTH
    ) {
      const validationError = new Error(
        `Display name must be between ${DISPLAY_NAME_MIN_LENGTH} and ${DISPLAY_NAME_MAX_LENGTH} characters.`,
      );
      lastError.value = validationError.message;
      return { data: null, error: validationError };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: trimmedName,
      },
    });

    if (error) {
      if (await handleSessionExpiry(error)) {
        const sessionError = createSessionExpiredError();
        lastError.value = sessionError.message;
        return { data: null, error: sessionError };
      }
      lastError.value = error.message;
      return { data: null, error };
    }

    if (data.user) {
      user.value = data.user;
      if (session.value) {
        session.value = {
          ...session.value,
          user: data.user,
        };
      }
    }

    return { data, error: null };
  };

  return {
    user,
    session,
    isAuthenticated,
    initializing,
    hydrated,
    lastError,
    isAdmin,
    userReadonly,
    sessionReadonly,
    isAdminReadonly,
    initializingReadonly,
    hydratedReadonly,
    lastErrorReadonly,
    initialize,
    signIn,
    resendConfirmationEmail,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateDisplayName,
    initializePostAuthContext,
  };
});
