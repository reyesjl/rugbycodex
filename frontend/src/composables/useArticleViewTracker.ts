import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/stores/auth';

type TrackArticleViewResponse = {
  views?: number;
  success?: boolean;
};

const hasSupabaseCredentials =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export function useArticleViewTracker(slug: MaybeRefOrGetter<string | undefined>) {
  const views = ref<number | null>(null);
  const pending = ref(false);
  const error = ref<string | null>(null);
  const lastTrackedSlug = ref<string | null>(null);
  const authStore = useAuthStore();

  const track = async (
    overrideSlug?: string,
    options?: {
      force?: boolean;
    },
  ) => {
    const targetSlug = overrideSlug ?? toValue(slug);
    const force = options?.force ?? false;

    if (!targetSlug) {
      return;
    }

    if (!hasSupabaseCredentials) {
      if (import.meta.env.DEV) {
        console.warn(
          '[article-tracker] Missing Supabase credentials. Skipping article view tracking.',
        );
      }
      return;
    }

    if (!force && lastTrackedSlug.value === targetSlug) {
      return;
    }

    pending.value = true;
    error.value = null;

    try {
      if (!authStore.hydrated) {
        try {
          await authStore.initialize();
        } catch (initError) {
          if (import.meta.env.DEV) {
            console.warn('[article-tracker] Auth init failed. Proceeding without user id.', initError);
          }
        }
      }

      const userId = authStore.user?.id ?? null;

      const { data, error: fnError } =
        await supabase.functions.invoke<TrackArticleViewResponse>('track-article-view', {
          body: {
            slug: targetSlug,
            user_id: userId,
          },
        });

      if (fnError) {
        throw fnError;
      }

      if (typeof data?.views === 'number') {
        views.value = data.views;
      }

      if (import.meta.env.DEV) {
        console.log('[article-tracker] Recorded view', {
          slug: targetSlug,
          userId,
          views: views.value,
        });
      }

      lastTrackedSlug.value = targetSlug;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to track article view.';
      error.value = message;
      if (import.meta.env.DEV) {
        console.warn('[article-tracker] Failed to track article view:', err);
      }
    } finally {
      pending.value = false;
    }
  };

  watch(
    () => toValue(slug),
    (nextSlug) => {
      if (nextSlug) {
        void track(nextSlug);
      }
    },
    { immediate: true },
  );

  const reset = () => {
    views.value = null;
    pending.value = false;
    error.value = null;
    lastTrackedSlug.value = null;
  };

  return {
    views,
    pending,
    error,
    track: (overrideSlug?: string, options?: { force?: boolean }) =>
      track(overrideSlug, options),
    reset,
  };
}
