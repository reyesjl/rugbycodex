import { createApp } from 'vue';
import './main.css';
import './style.css';
import App from './App.vue';
import router from './router';
import pinia from '@/stores';
import { useAuthStore } from '@/stores/auth';

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
};

void bootstrap();
