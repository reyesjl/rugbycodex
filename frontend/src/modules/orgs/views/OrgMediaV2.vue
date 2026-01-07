<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useOrgMediaStore } from '@/modules/media/stores/useOrgMediaStore';
import { buildUploadJob, useUploadManager } from '@/modules/media/composables/useUploadManager';
import { mediaService } from '@/modules/media/services/mediaService';
import MediaAssetCard from '@/modules/orgs/components/MediaAssetCard.vue';
import AddMediaAssetModal from '@/modules/orgs/components/AddMediaAssetModal.vue';
import { toast } from '@/lib/toast';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';

defineProps<{ slug?: string | string[] }>();

const activeOrgStore = useActiveOrganizationStore();
const mediaStore = useOrgMediaStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const { orgContext, resolving: orgResolving } = storeToRefs(activeOrgStore);
const { assets, status, error, isLoading } = storeToRefs(mediaStore);
const { isAdmin } = storeToRefs(authStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

const canManage = computed(() => {
  if (isAdmin.value) return true;
  const role = orgContext.value?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const showAddMedia = ref(false);

const uploadManager = useUploadManager();

const hasInFlightUploads = computed(() => uploadManager.activeUploads.value.length > 0);

const uploadMetricsByAssetId = computed(() => {
  return new Map(
    uploadManager.activeUploads.value.map((job) => [
      job.id,
      {
        state: job.state,
        progress: job.progress,
        uploadSpeedBps: job.uploadSpeedBps,
      },
    ])
  );
});

function openAddMedia() {
  if (!activeOrgId.value) return;
  if (!canManage.value) return;
  showAddMedia.value = true;
}

function openAsset(assetId: string) {
  const slug = route.params.slug;
  if (!slug) return;
  void router.push({
    name: 'OrgMediaAsset',
    params: {
      slug,
      mediaId: assetId,
    },
  });
}

function closeAddMedia() {
  showAddMedia.value = false;
}

function handleUploadStarted() {
  mediaStore.reset();
  void mediaStore.loadForActiveOrg();
}

async function handleDeleteAsset(assetId: string) {
  if (!canManage.value) {
    toast({
      variant: 'error',
      message: 'You do not have permission to delete media.',
      durationMs: 3500,
    });
    return;
  }

  try {
    await mediaService.deleteById(assetId);
    toast({
      variant: 'success',
      message: 'Media deleted.',
      durationMs: 2500,
    });
    mediaStore.reset();
    void mediaStore.loadForActiveOrg();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to delete media.',
      durationMs: 3500,
    });
  }
}

async function handleUploadSubmit(payload: { file: globalThis.File; kind: MediaAssetKind }) {
  if (!activeOrgId.value) return;
  if (!canManage.value) return;

  try {
    const job = await buildUploadJob(payload.file, activeOrgId.value, 'rugbycodex');

    const { error: updateError } = await mediaService.updateMediaAsset(job.id, {
      kind: payload.kind,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    uploadManager.enqueue(job);

    toast({
      variant: 'success',
      message: 'Upload started.',
      durationMs: 2500,
    });

    handleUploadStarted();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to start upload.',
      durationMs: 3500,
    });
  } finally {
    closeAddMedia();
  }
}

watch(
  () => uploadManager.completedUploads.value,
  async (completed) => {
    if (completed.length === 0) return;

    // Copy before we mutate the uploadManager list.
    const jobs = [...completed];

    await Promise.all(
      jobs.map((job) =>
        mediaService.updateMediaAsset(job.id, {
          storage_path: job.storage_path,
          status: 'ready',
        })
      )
    );

    for (const job of jobs) {
      uploadManager.remove(job.id);
    }

    // Reload assets after uploads complete
    mediaStore.reset();
    void mediaStore.loadForActiveOrg();
  }
);

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
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-white text-3xl">Footage</h1>
      <button
        v-if="canManage"
        type="button"
        class="flex gap-2 items-center rounded-lg px-2 py-1 border border-green-500 bg-green-500/70 hover:bg-green-700/70 text-xs transition disabled:opacity-50"
        :disabled="orgResolving || !orgContext"
        @click="openAddMedia"
      >
        <Icon icon="carbon:upload" width="15" height="15" />
        Upload
      </button>
    </div>

    <div
      v-if="hasInFlightUploads"
      class="rounded-lg border border-white/10 bg-white/5 p-4 text-white/70"
      aria-label="Upload status"
    >
      <div class="text-sm">
        Upload in progress. Please do not navigate away from this page.
      </div>
    </div>

    <div v-if="orgResolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!orgContext" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
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
            :can-manage="canManage"
            :upload-metrics="uploadMetricsByAssetId.get(asset.id)"
            @open="openAsset"
            @delete="handleDeleteAsset"
          />
        </div>
      </div>
    </div>
  </div>

  <AddMediaAssetModal
    v-if="showAddMedia && activeOrgId && canManage"
    @close="closeAddMedia"
    @submit="handleUploadSubmit"
  />
</template>

<style scoped>
</style>