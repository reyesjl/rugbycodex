<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useOrgMediaStore } from '@/modules/media/stores/useOrgMediaStore';
import { useUploadStore } from '@/modules/media/stores/useUploadStore';
import { useOrgMediaWithCoverage } from '@/modules/media/composables/useOrgMediaWithCoverage';
import { mediaService } from '@/modules/media/services/mediaService';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';
import ProcessingVideosList from '@/modules/orgs/components/ProcessingVideosList.vue';
import AddMediaAssetModal from '@/modules/orgs/components/AddMediaAssetModal.vue';
import EditMediaAssetModal from '@/modules/orgs/components/EditMediaAssetModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import { toast } from '@/lib/toast';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

defineProps<{ slug?: string | string[] }>();

const activeOrgStore = useActiveOrganizationStore();
const mediaStore = useOrgMediaStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const { orgContext, resolving: orgResolving } = storeToRefs(activeOrgStore);
const { assets: storeAssets, error: storeError, isLoading: storeLoading } = storeToRefs(mediaStore);
const { isAdmin } = storeToRefs(authStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

// Use new composable for coverage data
const {
  assets: readyAssetsWithCoverage,
  filteredAssets,
  loading: coverageLoading,
  error: coverageError,
  isEmpty,
  isFilteredEmpty,
  selectedKind,
  loadAssets,
  getCoverageDisplay,
  formatDuration,
  formatRelativeDate,
  getNarrationProgress,
} = useOrgMediaWithCoverage(activeOrgId.value);

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

const uploadStore = useUploadStore();

const hasInFlightUploads = computed(() => uploadStore.activeUploads.length > 0);

const searchQuery = ref('');

function normalizeSearchText(value: string | null | undefined) {
  if (!value) return '';
  return formatMediaAssetNameForDisplay(value).toLowerCase();
}

// Processing assets from store (not ready yet, shown in processing list)
const processingAssets = computed(() => {
  return storeAssets.value.filter(asset => {
    return !asset.streaming_ready || asset.processing_stage !== 'complete';
  });
});

// Filter ready assets by search query
const searchFilteredAssets = computed(() => {
  if (!searchQuery.value.trim()) {
    return filteredAssets.value;
  }
  
  const query = normalizeSearchText(searchQuery.value);
  return filteredAssets.value.filter(asset => 
    normalizeSearchText(asset.fileName).includes(query) ||
    normalizeSearchText(asset.kind).includes(query)
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
  
  // Members: Open in Feed mode (swipeable segments)
  // Staff: Open in Timeline view (default)
  if (canManage.value) {
    // Staff can view in timeline
    void router.push({
      name: 'OrgMediaAssetReview',
      params: {
        slug,
        mediaAssetId: assetId,
      },
    });
  } else {
    // Members view in feed mode
    void router.push({
      name: 'OrgFeedView',
      params: { slug },
      query: {
        source: 'match',
        mediaAssetId: assetId,
      },
    });
  }
}

function viewInReview(assetId: string) {
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

function viewInFeed(assetId: string) {
  const slug = route.params.slug;
  if (!slug) return;
  
  void router.push({
    name: 'OrgFeedView',
    params: { slug },
    query: {
      source: 'match',
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

  const asset = storeAssets.value.find(a => a.id === assetId);
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
  await loadAssets(); // Reload coverage data
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

  const asset = storeAssets.value.find(a => a.id === assetId);
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
  const asset = storeAssets.value.find(a => a.id === assetId);
  if (!asset) return;

  const existingJob = uploadStore.uploadsReadonly.find(u => u.mediaId === assetId);

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
      const existingJob = uploadStore.uploadsReadonly.find(u => u.mediaId === assetToReattach.value!.assetId);
      if (existingJob) {
        uploadStore.reattachFile(existingJob.id, file);
      }
    } else {
      // No job exists - get new credentials but cleanup duplicate
      const tempJob = await uploadStore.startUpload(file, 'rugbycodex');
      
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
      
      uploadStore.enqueue(resumedJob);
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
    const uploadJob = uploadStore.uploadsReadonly.find(u => u.mediaId === assetToDelete.value!.id);
    if (uploadJob) {
      uploadStore.remove(uploadJob.id);
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
    const job = await uploadStore.startUpload(payload.file, 'rugbycodex');

    const { error: updateError } = await mediaService.updateMediaAsset(job.id, {
      kind: payload.kind,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    toast({
      variant: 'success',
      message: 'Upload started.',
      durationMs: 2500,
    });

    await handleUploadStarted();
    closeAddMedia();
  } catch (err) {
    // Extract user-friendly error message
    let errorMessage = 'Failed to start upload.';
    
    if (err instanceof Error) {
      errorMessage = err.message;
      
      // Make storage quota errors more user-friendly
      if (errorMessage.includes('Storage quota exceeded')) {
        const match = errorMessage.match(/limit (\d+) MB, used (\d+) MB/);
        if (match?.[1] && match?.[2]) {
          const limit = parseInt(match[1], 10);
          const used = parseInt(match[2], 10);
          const limitGB = (limit / 1024).toFixed(2);
          const usedGB = (used / 1024).toFixed(2);
          errorMessage = `Storage quota exceeded. Your organization is using ${usedGB} GB of ${limitGB} GB. Please delete some media or contact support to increase your storage limit.`;
        }
      }
    }
    
    toast({
      variant: 'error',
      message: errorMessage,
      durationMs: 5000,
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

async function cleanupOrphanedUploads() {
  if (!activeOrgId.value) return;

  try {
    const orphanedAssets = storeAssets.value.filter(asset => {
      if (asset.status !== 'uploading') return false;
      
      const hasActiveUpload = uploadStore.uploadsReadonly.some(
        job => job.mediaId === asset.id
      );
      
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
  await mediaStore.loadForActiveOrg(); // Load all assets (for processing list)
  await loadAssets(); // Load ready assets with coverage
  await cleanupOrphanedUploads();
});

watch(activeOrgId, (orgId, prevOrgId) => {
  if (orgId && orgId !== prevOrgId) {
    void mediaStore.loadForActiveOrg();
    void loadAssets();
  }
});
</script>

<template>
  <div class="min-h-screen text-white pb-20">
    <!-- Header - contained -->
    <div class="container-lg py-6">
      <div class="flex items-center justify-between gap-6 mb-6">
        <h1 class="text-4xl font-light tracking-tight text-white">Footage</h1>
        <button
          v-if="canManage"
          type="button"
          class="flex gap-1.5 items-center px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-xs text-white font-medium transition disabled:opacity-50 cursor-pointer"
          :disabled="orgResolving || !orgContext"
          @click="openAddMedia"
        >
          <Icon icon="carbon:upload" width="14" height="14" />
          Upload
        </button>
      </div>

      <!-- Search bar and filters -->
      <div v-if="!coverageLoading && readyAssetsWithCoverage.length > 0" class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6">
        <!-- Search -->
        <div class="relative w-full sm:max-w-md sm:flex-1">
          <Icon icon="carbon:search" class="absolute left-0 top-1/2 -translate-y-1/2 text-white/30" width="20" height="20" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search footage..."
            class="w-full pl-8 pr-4 py-3 bg-transparent border-0 border-b border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition text-base"
          />
        </div>

        <!-- Kind filter toggle -->
        <div class="flex items-center gap-3 text-sm">
          <button
            type="button"
            @click="selectedKind = 'all'"
            class="transition"
            :class="selectedKind === 'all' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            All
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'match'"
            class="transition"
            :class="selectedKind === 'match' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Match
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'training'"
            class="transition"
            :class="selectedKind === 'training' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Training
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'clinic'"
            class="transition"
            :class="selectedKind === 'clinic' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Clinic
          </button>
        </div>
      </div>

      <!-- Upload notification -->
      <div
        v-if="hasInFlightUploads"
        class="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-300 mb-6"
        aria-label="Upload status"
      >
        <div class="text-sm font-medium">
          Upload in progress. Please do not navigate away from this page.
        </div>
      </div>

      <!-- Processing Videos -->
      <ProcessingVideosList
        v-if="processingAssets.length > 0"
        :processing-assets="processingAssets"
        :can-manage="canManage"
        @delete="openConfirmDelete"
        class="mb-8"
      />
    </div>

    <!-- Loading/Error states - contained -->
    <div class="container-lg">
      <div v-if="orgResolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        Loading organization…
      </div>

      <div v-else-if="!orgContext" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        No active organization.
      </div>

      <div v-else-if="coverageLoading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        <div class="flex items-center justify-center gap-3">
          <LoadingDot />
          <ShimmerText class="text-sm text-white/70" text="Loading footage..." />
        </div>
      </div>

      <div v-else-if="coverageError" class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-4">
        {{ coverageError }}
      </div>

      <!-- Empty state -->
      <div v-else-if="isEmpty" class="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
        <Icon icon="carbon:video" class="text-white/20 mb-6" width="64" height="64" />
        <h2 class="text-xl font-light text-white/80 mb-2">No media yet</h2>
        <p class="text-sm text-white/50 mb-6">Upload your first video to get started</p>
        <button
          v-if="canManage"
          type="button"
          class="flex gap-1.5 items-center px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-xs text-white font-medium transition cursor-pointer"
          @click="openAddMedia"
        >
          <Icon icon="carbon:upload" width="14" height="14" />
          Upload video
        </button>
      </div>

      <!-- Filtered empty state -->
      <div v-else-if="isFilteredEmpty" class="text-center py-12 text-white/50">
        <Icon icon="carbon:search" class="mx-auto mb-3" width="32" height="32" />
        <p v-if="searchQuery">No results found for "{{ searchQuery }}"</p>
        <p v-else>No {{ selectedKind }} footage found.</p>
      </div>

      <!-- Footage list -->
      <div v-else class="space-y-3">
        <div
          v-for="asset in searchFilteredAssets"
          :key="asset.id"
          class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
        >
          <!-- Thumbnail -->
          <div 
            class="w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-black cursor-pointer"
            @click="openAsset(asset.id)"
          >
            <img
              v-if="asset.thumbnailPath"
              :src="`https://cdn.rugbycodex.com/${asset.thumbnailPath}`"
              :alt="formatMediaAssetNameForDisplay(asset.fileName)"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-white/20 text-xs"
            >
              <Icon icon="carbon:video" width="24" />
            </div>
          </div>

          <!-- Asset info -->
          <div 
            class="flex-1 min-w-0 flex flex-col justify-between cursor-pointer"
            @click="openAsset(asset.id)"
          >
            <!-- Title -->
            <div>
              <h3 class="font-semibold text-white group-hover:text-white/90 truncate capitalize mb-1">
                {{ formatMediaAssetNameForDisplay(asset.fileName) }}
              </h3>
              
              <!-- Metadata -->
              <div class="flex items-center gap-2 text-xs text-white/50">
                <span>{{ formatRelativeDate(asset.createdAt) }}</span>
                <span class="text-white/30">•</span>
                <span>{{ formatDuration(asset.durationSeconds) }}</span>
                <span class="text-white/30">•</span>
                <span class="capitalize">{{ asset.kind }}</span>
              </div>
            </div>

            <!-- Coverage badge & narration count -->
            <div class="flex items-center gap-3 mt-2">
              <div
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                  getCoverageDisplay(asset.coverageTier).colorClass
                ]"
              >
                <Icon :icon="getCoverageDisplay(asset.coverageTier).icon" width="14" />
                <span>{{ getCoverageDisplay(asset.coverageTier).label }}</span>
              </div>
              
              <div class="text-xs text-white/60">
                <div>{{ getNarrationProgress(asset.narrationCount).main }}</div>
                <div v-if="getNarrationProgress(asset.narrationCount).helper" class="text-white/40 text-[11px]">
                  {{ getNarrationProgress(asset.narrationCount).helper }}
                </div>
              </div>

              <!-- Large gap warning -->
              <div v-if="asset.hasLargeGap" class="flex items-center gap-1 text-xs text-orange-400" title="Contains gaps larger than 8 minutes">
                <Icon icon="carbon:warning" width="14" />
                <span>Large gaps</span>
              </div>
            </div>
          </div>

          <!-- Actions menu -->
          <div class="flex-shrink-0 flex items-start">
            <Menu as="div" class="relative z-10">
              <MenuButton
                class="rounded p-2 text-white/50 hover:bg-white/10 hover:text-white/80 transition"
                aria-label="More actions"
                @click.stop
              >
                <Icon icon="carbon:overflow-menu-vertical" class="h-5 w-5" />
              </MenuButton>

              <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <MenuItems
                  class="absolute right-0 top-full mt-2 min-w-40 origin-top-right rounded-md border border-white/10 bg-black/90 backdrop-blur-md text-white focus:outline-none"
                  @click.stop
                >
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm transition"
                      :class="active ? 'bg-white/10' : ''"
                      @click="viewInReview(asset.id)"
                    >
                      View in Review
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm transition"
                      :class="active ? 'bg-white/10' : ''"
                      @click="viewInFeed(asset.id)"
                    >
                      View in Feed
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canManage" v-slot="{ active }">
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm transition border-t border-white/10"
                      :class="active ? 'bg-white/10' : ''"
                      @click="openEditMedia(asset.id)"
                    >
                      Edit
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canManage" v-slot="{ active }">
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm text-red-300 transition border-t border-white/10"
                      :class="active ? 'bg-white/10' : ''"
                      @click="openConfirmDelete(asset.id)"
                    >
                      Delete
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
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
                accept="video/mp4,.mp4,.m4v,.mov,.avi,.mkv,.webm,.flv"
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
/* Hide scrollbar but keep functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Smooth momentum scrolling on iOS */
.scrollbar-hide {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
</style>

<style scoped>
/* Hide scrollbar but keep functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Smooth momentum scrolling on iOS */
.scrollbar-hide {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
</style>
