import { createApp } from 'vue';
import './main.css';
import './style.css';
import App from './App.vue';
import router from './router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useCookieConsent } from './composables/useCookieConsent';

const app = createApp(App);

app.use(pinia);
app.use(router);

const bootstrap = async () => {
  const authStore = useAuthStore(pinia);
  if (!authStore.hydrated && !authStore.initializing) {
    try {
      await authStore.initialize();
    } catch (error) {
      console.warn('[auth] Failed to initialize session during app bootstrap.', error);
    }
  }

  await router.isReady();
  app.mount('#app');

  window.addEventListener('error', (event) => {
    console.log(JSON.stringify({
      severity: 'error',
      event_type: 'metric',
      metric_name: 'frontend_js_errors_total',
      metric_value: 1,
      tags: { error_type: event?.error?.name ?? 'Error' },
    }));
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    console.log(JSON.stringify({
      severity: 'error',
      event_type: 'metric',
      metric_name: 'frontend_js_errors_total',
      metric_value: 1,
      tags: { error_type: reason?.name ?? 'UnhandledRejection' },
    }));
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
