import { createApp } from 'vue';
import './main.css';
import './style.css';
import App from './App.vue';
import router from './router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
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

  // Check cookie consent status
  const { consent, hasDecided } = useCookieConsent();
  if (hasDecided.value && consent.value === 'accepted') {
    // Initialize services that require cookie consent here
    console.log('Cookie consent accepted. Initializing analytics...');
    // TODO : initializeAnalytics();
  }
};

void bootstrap();
