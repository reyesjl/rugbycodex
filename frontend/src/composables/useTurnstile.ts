import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        },
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

const turnstileTestKey = '1x00000000000000000000AA';

const turnstileSiteKey = import.meta.env.PROD
  ? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
  : import.meta.env.VITE_TURNSTILE_SITE_KEY_DEV ?? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? turnstileTestKey;

const turnstileScriptId = 'cloudflare-turnstile-script';

let turnstileScriptPromise: Promise<void> | null = null;

const appendTurnstileScript = () => {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
  if (existing) {
    return existing;
  }

  const script = document.createElement('script');
  script.id = turnstileScriptId;
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  return script;
};

const ensureTurnstileScript = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve) => {
    const script = appendTurnstileScript();
    if (!script) {
      resolve();
      return;
    }

    if (script.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const onLoad = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    const onError = () => {
      turnstileScriptPromise = null;
      resolve();
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  return turnstileScriptPromise;
};

export const useTurnstile = () => {
  const shouldRenderTurnstile = computed(() => Boolean(turnstileSiteKey));
  const turnstileToken = ref('');
  const turnstileContainer = ref<HTMLElement | null>(null);
  const turnstileWidgetId = ref<string | null>(null);
  const isDarkMode = ref(false);
  const turnstileTheme = computed(() => (isDarkMode.value ? 'dark' : 'light'));
  let darkModeObserver: MutationObserver | null = null;

  const syncDarkMode = () => {
    if (typeof document === 'undefined') return;
    isDarkMode.value = document.documentElement.classList.contains('dark');
  };

  const removeTurnstile = () => {
    if (typeof window === 'undefined') return;
    if (!turnstileWidgetId.value) return;
    window.turnstile?.remove?.(turnstileWidgetId.value);
    turnstileWidgetId.value = null;
    turnstileToken.value = '';
    if (turnstileContainer.value) {
      turnstileContainer.value.innerHTML = '';
    }
  };

  const mountTurnstile = async () => {
    if (!shouldRenderTurnstile.value) return;
    if (typeof window === 'undefined') return;
    await ensureTurnstileScript();
    if (!window.turnstile || !turnstileContainer.value) return;

    removeTurnstile();
    turnstileToken.value = '';
    turnstileContainer.value.innerHTML = '';

    turnstileWidgetId.value = window.turnstile.render(turnstileContainer.value, {
      sitekey: turnstileSiteKey,
      theme: turnstileTheme.value,
      size: 'normal',
      callback: (token: string) => {
        turnstileToken.value = token;
      },
    });
  };

  const initialize = async () => {
    if (!shouldRenderTurnstile.value) return;
    appendTurnstileScript();
    syncDarkMode();
    await nextTick();
    await mountTurnstile();

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      darkModeObserver = new MutationObserver(() => {
        syncDarkMode();
      });
      darkModeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  };

  onMounted(() => {
    void initialize();
  });

  onBeforeUnmount(() => {
    removeTurnstile();
    darkModeObserver?.disconnect();
    darkModeObserver = null;
  });

  watch(turnstileTheme, () => {
    void mountTurnstile();
  });

  return {
    shouldRenderTurnstile,
    turnstileToken,
    turnstileContainer,
  };
};
