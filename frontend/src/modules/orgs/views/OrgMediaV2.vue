<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useOrgMediaStore } from '@/modules/media/stores/useOrgMediaStore';
import { formatDaysAgo } from '@/lib/date';
import { getMediaAssetStatusDisplay } from '@/lib/status';
import { formatHoursMinutes } from '@/lib/duration';

const activeOrgStore = useActiveOrganizationStore();
const mediaStore = useOrgMediaStore();

const { active, resolving: orgResolving } = storeToRefs(activeOrgStore);
const { assets, status, error, isLoading } = storeToRefs(mediaStore);

const activeOrgId = computed(() => active.value?.organization?.id ?? null);

function clipTitle(fileName: string) {
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[\-_]+/g, ' ').trim() || 'Untitled clip';
}

function statusDisplay(status: string) {
  return getMediaAssetStatusDisplay(status);
}

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
          <article
            v-for="asset in assets"
            :key="asset.id"
            class="group overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/20"
          >
            <div class="p-3">
              <!-- Thumbnail placeholder -->
              <div class="relative overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
                <div class="relative w-full pb-[56.25%]">
                  <div class="absolute inset-0 flex items-center justify-center">
                    <Icon icon="carbon:play-filled" class="h-10 w-10 text-white/30" />
                  </div>
                </div>

                <div
                  class="absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
                >
                  {{ formatHoursMinutes(asset.duration_seconds) }}
                </div>
              </div>

              <!-- Metadata -->
              <div class="mt-3 space-y-1">
                <div class="truncate text-sm font-semibold text-white">
                  {{ clipTitle(asset.file_name) }}
                </div>
                <div class="text-xs font-medium capitalize tracking-wide text-white/50">
                  {{ asset.kind }}
                </div>
                <div class="text-xs text-white/50">
                  {{ formatDaysAgo(asset.created_at) ?? 'Unknown date' }}
                </div>

                <!-- Status -->
                <div class="inline-flex items-center gap-1 text-xs text-white/40">
                  <Icon
                    v-if="statusDisplay(asset.status).icon"
                    :icon="statusDisplay(asset.status).icon!"
                    class="h-3.5 w-3.5"
                    :class="statusDisplay(asset.status).iconClass"
                  />
                  <span>{{ statusDisplay(asset.status).label }}</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>