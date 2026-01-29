import { createApp } from 'vue';
import './main.css';
import './style.css';
import App from './App.vue';
import router from './router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useCookieConsent } from './composables/useCookieConsent';
import { setAxiomContext } from '@/lib/axiom';
import { logError, logInfo } from '@/lib/logger';

const app = createApp(App);

// Vue global error handler
app.config.errorHandler = (err, instance, info) => {
  logError(
    'Vue error caught',
    err,
    {
      component_name: instance?.$options?.name || 'Unknown',
      error_info: info,
    }
  );
};

app.use(pinia);
app.use(router);

const bootstrap = async () => {
  // Set global Axiom context
  setAxiomContext({
    app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
    user_agent: navigator.userAgent,
  });

  const authStore = useAuthStore(pinia);
  if (!authStore.hydrated && !authStore.initializing) {
    try {
      await authStore.initialize();
    } catch (error) {
      console.warn('[auth] Failed to initialize session during app bootstrap.', error);
      logError('Failed to initialize auth session', error);
    }
  }

  await router.isReady();
  app.mount('#app');

  logInfo('Application started', {
    url: window.location.href,
    referrer: document.referrer,
  });

  // Global error handlers
  window.addEventListener('error', (event) => {
    logError(
      'Unhandled JavaScript error',
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    logError(
      'Unhandled promise rejection',
      reason,
      {
        promise: String(event.promise),
      }
    );
  });

  // Check cookie consent status
  const { consent, hasDecided } = useCookieConsent();
  if (hasDecided.value && consent.value === 'accepted') {
    // Initialize services that require cookie consent here
    console.log('Cookie consent accepted. Initializing analytics...');
    // TODO : initializeAnalytics();
  }
};

void bootstrap();
