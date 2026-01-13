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
import EditMediaAssetModal from '@/modules/orgs/components/EditMediaAssetModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import { toast } from '@/lib/toast';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

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
const showEditMedia = ref(false);
const showConfirmDelete = ref(false);
const showReattachModal = ref(false);
const deleteError = ref<string | null>(null);
const isDeleting = ref(false);
const assetToDelete = ref<{ id: string; name: string } | null>(null);
const assetToEdit = ref<OrgMediaAsset | null>(null);
const assetToReattach = ref<{ assetId: string; fileName: string; hasExistingJob: boolean } | null>(null);

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
    name: 'OrgMediaAssetReview',
    params: {
      slug,
      mediaAssetId: assetId,
    },
  });
}

function openReview(assetId: string) {
  const slug = route.params.slug;
  if (!slug) return;
  void router.push({
    name: 'OrgMediaAssetReview',
    params: {
      slug,
      mediaAssetId: assetId,
    },
  });
}

function closeAddMedia() {
  showAddMedia.value = false;
}

function openEditMedia(assetId: string) {
  if (!canManage.value) {
    toast({
      variant: 'error',
      message: 'You do not have permission to edit media.',
      durationMs: 3500,
    });
    return;
  }

  const asset = assets.value.find(a => a.id === assetId);
  if (!asset) return;

  assetToEdit.value = asset;
  showEditMedia.value = true;
}

function closeEditMedia() {
  showEditMedia.value = false;
  assetToEdit.value = null;
}

async function handleUploadStarted() {
  mediaStore.reset();
  await mediaStore.loadForActiveOrg();
}

function openConfirmDelete(assetId: string) {
  if (!canManage.value) {
    toast({
      variant: 'error',
      message: 'You do not have permission to delete media.',
      durationMs: 3500,
    });
    return;
  }

  const asset = assets.value.find(a => a.id === assetId);
  if (!asset) return;

  assetToDelete.value = {
    id: asset.id,
    name: asset.title || 'this asset',
  };
  deleteError.value = null;
  showConfirmDelete.value = true;
}

function closeConfirmDelete() {
  if (isDeleting.value) return;
  showConfirmDelete.value = false;
  deleteError.value = null;
  assetToDelete.value = null;
}

function openReattachModal(assetId: string) {
  const asset = assets.value.find(a => a.id === assetId);
  if (!asset) return;

  const existingJob = uploadManager.uploads.value.find(u => u.mediaId === assetId);

  assetToReattach.value = {
    assetId: asset.id,
    fileName: existingJob?.fileName ?? asset.file_name,
    hasExistingJob: !!existingJob,
  };
  showReattachModal.value = true;
}

function closeReattachModal() {
  showReattachModal.value = false;
  assetToReattach.value = null;
}

async function handleReattachFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file || !assetToReattach.value || !activeOrgId.value) return;

  try {
    if (assetToReattach.value.hasExistingJob) {
      // Job exists in upload manager - reattach file
      const existingJob = uploadManager.uploads.value.find(u => u.mediaId === assetToReattach.value!.assetId);
      if (existingJob) {
        uploadManager.reattachFile(existingJob.id, file);
      }
    } else {
      // No job exists - get new credentials but cleanup duplicate
      const tempJob = await buildUploadJob(file, activeOrgId.value, 'rugbycodex');
      
      // Delete the newly created media_assets row (we only want the original)
      await mediaService.deleteById(tempJob.mediaId);
      
      // Update the original interrupted asset with new upload session
      await mediaService.updateMediaAsset(assetToReattach.value.assetId, {
        storage_path: tempJob.storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        status: 'uploading'
      });

      // Build job using original asset ID and new credentials
      const resumedJob = {
        ...tempJob,
        id: assetToReattach.value.assetId,
        mediaId: assetToReattach.value.assetId,
        fileName: assetToReattach.value.fileName,
      };
      
      uploadManager.enqueue(resumedJob);
    }
    
    closeReattachModal();
    
    toast({
      variant: 'success',
      message: 'Upload resumed.',
      durationMs: 2500,
    });

    await handleUploadStarted();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to resume upload.',
      durationMs: 3500,
    });
  }

  if (target) {
    target.value = '';
  }
}

async function confirmDeleteAsset() {
  if (!assetToDelete.value) return;

  isDeleting.value = true;
  deleteError.value = null;

  try {
    // Remove from upload queue if it exists
    const uploadJob = uploadManager.uploads.value.find(u => u.mediaId === assetToDelete.value!.id);
    if (uploadJob) {
      uploadManager.remove(uploadJob.id);
    }

    await mediaService.deleteById(assetToDelete.value.id);
    
    toast({
      variant: 'success',
      message: 'Media deleted.',
      durationMs: 2500,
    });
    
    mediaStore.reset();
    void mediaStore.loadForActiveOrg();
    showConfirmDelete.value = false;
    assetToDelete.value = null;
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete media.';
  } finally {
    isDeleting.value = false;
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

    await handleUploadStarted();
    closeAddMedia();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to start upload.',
      durationMs: 3500,
    });
  }
}

async function handleEditSubmit(payload: { file_name: string; kind: MediaAssetKind }) {
  if (!assetToEdit.value) return;
  if (!canManage.value) return;

  try {
    const { error: updateError } = await mediaService.updateMediaAsset(assetToEdit.value.id, {
      file_name: payload.file_name,
      kind: payload.kind,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    toast({
      variant: 'success',
      message: 'Media updated successfully.',
      durationMs: 2500,
    });

    mediaStore.reset();
    await mediaStore.loadForActiveOrg();
    closeEditMedia();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to update media.',
      durationMs: 3500,
    });
  }
}

watch(
  () => uploadManager.completedUploads.value,
  async (completed) => {
    if (completed.length === 0) return;

    const jobs = [...completed];

    await Promise.all(
      jobs.map((job) =>
        mediaService.updateMediaAsset(job.id, {
          storage_path: job.storagePath,
          status: 'ready',
        })
      )
    );

    for (const job of jobs) {
      uploadManager.remove(job.id);
    }

    mediaStore.reset();
    void mediaStore.loadForActiveOrg();
  }
);

async function cleanupOrphanedUploads() {
  if (!activeOrgId.value) return;

  try {
    const orphanedAssets = assets.value.filter(asset => {
      if (asset.status !== 'uploading') return false;
      
      // Check if this asset has an active upload session on THIS device
      const hasActiveUpload = uploadManager.uploads.value.some(
        job => job.mediaId === asset.id
      );
      
      // Only mark as orphaned if:
      // 1. No active upload on this device AND
      // 2. Upload started more than 8 hours ago (accounts for large files on slow connections)
      const uploadAge = Date.now() - new Date(asset.created_at).getTime();
      const EIGHT_HOURS = 8 * 60 * 60 * 1000;
      
      return !hasActiveUpload && uploadAge > EIGHT_HOURS;
    });

    for (const asset of orphanedAssets) {
      await mediaService.updateMediaAsset(asset.id, {
        status: 'interrupted'
      });
    }

    if (orphanedAssets.length > 0) {
      mediaStore.reset();
      void mediaStore.loadForActiveOrg();
    }
  } catch (err) {
    console.error('Failed to cleanup orphaned uploads:', err);
  }
}

onMounted(async () => {
  await mediaStore.loadForActiveOrg();
  await cleanupOrphanedUploads();
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

      <div v-else-if="status.state === 'error'" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
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
            @review="openReview"
            @edit="openEditMedia"
            @delete="openConfirmDelete"
            @reattach="openReattachModal"
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

  <EditMediaAssetModal
    v-if="showEditMedia && assetToEdit && canManage"
    :asset="assetToEdit"
    @close="closeEditMedia"
    @submit="handleEditSubmit"
  />

  <ConfirmDeleteModal
    :show="showConfirmDelete"
    :item-name="assetToDelete?.name ?? 'this asset'"
    popup-title="Delete Media"
    :is-deleting="isDeleting"
    :error="deleteError"
    @confirm="confirmDeleteAsset"
    @cancel="closeConfirmDelete"
    @close="closeConfirmDelete"
  />

  <Teleport v-if="showReattachModal && assetToReattach" to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Resume upload"
      @click.self="closeReattachModal"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-md text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2 class="text-lg font-semibold">Resume Upload</h2>
          <p class="text-sm text-gray-400 mt-1">
            Upload was interrupted. Please reselect the file to continue.
          </p>
        </header>

        <div class="p-4 space-y-4">
          <div>
            <div class="text-sm text-white/70 mb-2">File:</div>
            <div class="text-sm font-medium text-white">{{ assetToReattach.fileName }}</div>
          </div>

          <div>
            <label
              class="block w-full text-center px-4 py-3 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <span>Choose file</span>
              <input
                type="file"
                accept="video/mp4,.mp4"
                class="hidden"
                @change="handleReattachFile"
              />
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-2 p-4 border-t border-t-white/20">
          <button
            type="button"
            @click="closeReattachModal"
            class="px-3 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
</style>