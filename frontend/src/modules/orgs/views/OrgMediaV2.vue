<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, watch } from 'vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useOrgMediaStore } from '@/modules/media/stores/useOrgMediaStore';
import MediaAssetCard from '@/modules/orgs/components/MediaAssetCard.vue';

const activeOrgStore = useActiveOrganizationStore();
const mediaStore = useOrgMediaStore();

const { active, resolving: orgResolving } = storeToRefs(activeOrgStore);
const { assets, status, error, isLoading } = storeToRefs(mediaStore);

const activeOrgId = computed(() => active.value?.organization?.id ?? null);

onMounted(() => {
  void mediaStore.loadForActiveOrg();
});

watch(activeOrgId, (orgId, prevOrgId) => {
  if (orgId && orgId !== prevOrgId) {
    void mediaStore.loadForActiveOrg();
  }
});
</script>

<template>
  <div class="container-lg space-y-4 py-6 text-white pb-20">
    <h1 class="text-white text-3xl">Footage</h1>

    <div v-if="orgResolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!active" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      No active organization.
    </div>

    <div v-else class="space-y-4">
      <div v-if="isLoading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        Loading media…
      </div>

      <div v-else-if="status === 'error'" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        {{ error ?? 'Unable to load media.' }}
      </div>

      <div v-else-if="assets.length === 0" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        No media assets yet.
      </div>

      <div v-else class="space-y-2">
        <div class="text-white/70">{{ assets.length }} asset(s)</div>

        <div
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Organization media assets"
        >
          <MediaAssetCard
            v-for="asset in assets"
            :key="asset.id"
            :asset="asset"
            :narration-count="mediaStore.narrationCountByAssetId(asset.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>