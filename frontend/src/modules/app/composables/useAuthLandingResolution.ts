import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';

export function useAuthLandingResolution() {
  const router = useRouter();
  const authStore = useAuthStore();
  const userContextStore = useUserContextStore();

  const { isAuthenticated, isAdmin } = storeToRefs(authStore);
  const { isReady, organizations, organizationCount } = storeToRefs(userContextStore);

  const resolving = ref(false);

  const resolveLanding = async () => {
    resolving.value = true;

    // Behavior change: landing is derived from auth + org state only (no flags).
    await authStore.initialize();

    if (!isAuthenticated.value) {
      resolving.value = false;
      return;
    }

    if (!isReady.value) {
      await userContextStore.load();
    }

    if (isAdmin.value) {
      // Admins always land on the org admin surface.
      await router.replace({ name: 'AdminOrgs' });
      resolving.value = false;
      return;
    }

    const count = organizationCount.value;

    if (count === 0) {
      // No orgs means onboarding.
      await router.replace({ name: 'Onboarding' });
      resolving.value = false;
      return;
    }

    if (count === 1) {
      // Exactly one org: send directly to its overview.
      const slug = organizations.value[0]?.organization?.slug;
      if (slug) {
        await router.replace({ name: 'OrgOverview', params: { slug } });
        resolving.value = false;
        return;
      }
    }

    // Multiple orgs (or missing slug) fall back to the org switcher.
    await router.replace({ name: 'MyRugby' });
    resolving.value = false;
  };

  return {
    resolving,
    resolveLanding,
  };
}
