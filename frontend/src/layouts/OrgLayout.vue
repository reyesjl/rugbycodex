<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MainNav from '@/modules/app/components/MainNav.vue';
import OrgSidebar from '@/modules/orgs/components/OrgSidebar.vue';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';

const isSidebarOpen = ref(true);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const route = useRoute();
const activeOrgStore = useActiveOrgStore();
const { activeOrg, loading, error } = storeToRefs(activeOrgStore);

const currentSlug = computed(() => {
  const slugParam = route.params.slug;
  if (Array.isArray(slugParam)) {
    return slugParam[0];
  }
  return typeof slugParam === 'string' ? slugParam : undefined;
});

watch(currentSlug, (slug) => {
  activeOrgStore.ensureLoaded(slug);
}, { immediate: true });

const retryLoad = () => {
  activeOrgStore.ensureLoaded(currentSlug.value);
};

const canRenderContent = computed(() => !!activeOrg.value && !loading.value && !error.value);
</script>

<template>
  <div class="min-h-screen bg-black">
    <MainNav @toggle-sidebar="toggleSidebar" />

    
    <OrgSidebar :is-open="isSidebarOpen" @toggle-sidebar="toggleSidebar" />

    <main 
    class="pt-[var(--main-nav-height)]"
    :class="[ isSidebarOpen ? 'pl-64' : 'pl-0', 'transition-all duration-300']">
      <section
        v-if="loading"
        class="flex h-[calc(100vh-var(--main-nav-height))] items-center justify-center text-white/70"
      >
        Loading organization...
      </section>
      <section
        v-else-if="error"
        class="flex h-[calc(100vh-var(--main-nav-height))] flex-col items-center justify-center space-y-4 text-center text-white"
      >
        <p>{{ error }}</p>
        <button
          type="button"
          class="rounded border border-white/40 px-4 py-2 text-sm uppercase tracking-wide hover:bg-white/10"
          @click="retryLoad"
        >
          Retry
        </button>
      </section>
      <section
        v-else-if="!canRenderContent"
        class="flex h-[calc(100vh-var(--main-nav-height))] items-center justify-center text-white/70"
      >
        No organization selected.
      </section>
      <RouterView v-else />
    </main>
  </div>
</template>
