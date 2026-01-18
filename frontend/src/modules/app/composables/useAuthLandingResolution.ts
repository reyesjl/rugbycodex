import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';

export function useAuthLandingResolution() {
  const router = useRouter();
  const authStore = useAuthStore();
  const myOrgs = useMyOrganizationsStore();

  const { isAuthenticated, isAdmin } = storeToRefs(authStore);
  const { loaded, hasOrganizations } = storeToRefs(myOrgs);

  const resolving = ref(false);

  const resolveLanding = async () => {
    resolving.value = true;

    // Behavior change: landing is derived from auth + org state only (no flags).
    await authStore.initialize();

    if (!isAuthenticated.value) {
      resolving.value = false;
      return;
    }

    if (!loaded.value) {
      await myOrgs.load();
    }

    if (isAdmin.value) {
      await router.replace({ name: 'AdminOrgs' });
      resolving.value = false;
      return;
    }

    if (!hasOrganizations.value) {
      await router.replace({ name: 'Onboarding' });
      resolving.value = false;
      return;
    }

    await router.replace({ name: 'MyRugby' });
    resolving.value = false;
  };

  return {
    resolving,
    resolveLanding,
  };
}
