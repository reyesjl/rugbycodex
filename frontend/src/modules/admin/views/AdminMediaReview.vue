<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { mediaService } from '@/modules/media/services/mediaService';
import type { AdminMediaAssetListItem } from '@/modules/media/types/AdminMediaAssetListItem';
import type { MediaAssetStatus } from '@/modules/media/types/MediaAssetStatus';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';
import MediaAssetDetailsModal from '@/modules/admin/components/MediaAssetDetailsModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

// Filter state
const showCount = ref<20 | 50 | 100>(20);
const statusFilter = ref<MediaAssetStatus | 'all'>('all');
const kindFilter = ref<MediaAssetKind | 'all'>('all');
const searchQuery = ref('');
const debouncedSearch = ref('');

// Pagination
const currentPage = ref(1);

// Data
const mediaAssets = ref<AdminMediaAssetListItem[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

// Modal states
const viewingAsset = ref<AdminMediaAssetListItem | null>(null);
const deletingAsset = ref<AdminMediaAssetListItem | null>(null);

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    debouncedSearch.value = newValue;
  }, 500);
});

// Reset to page 1 when filters change
watch([debouncedSearch, statusFilter, kindFilter, showCount], () => {
  currentPage.value = 1;
});

// Load data when filters change
watch([debouncedSearch, statusFilter, kindFilter], () => {
  loadMediaAssets();
});

// Computed
const filteredMediaAssets = computed(() => {
  return mediaAssets.value;
});

const paginatedMediaAssets = computed(() => {
  const start = (currentPage.value - 1) * showCount.value;
  const end = start + showCount.value;
  return filteredMediaAssets.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredMediaAssets.value.length / showCount.value);
});

const hasMediaAssets = computed(() => mediaAssets.value.length > 0);

// Actions
async function loadMediaAssets() {
  loading.value = true;
  error.value = null;

  try {
    const filters = {
      searchQuery: debouncedSearch.value || undefined,
      status: statusFilter.value === 'all' ? null : statusFilter.value,
      kind: kindFilter.value === 'all' ? null : kindFilter.value,
    };

    mediaAssets.value = await mediaService.listAllMediaAssets(filters);
    totalCount.value = mediaAssets.value.length;
  } catch (err) {
    console.error('Failed to load media assets:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load media assets';
  } finally {
    loading.value = false;
  }
}

async function loadTotalCount() {
  try {
    const allAssets = await mediaService.listAllMediaAssets();
    totalCount.value = allAssets.length;
  } catch (err) {
    console.error('Failed to load total count:', err);
  }
}

function handleViewDetails(asset: AdminMediaAssetListItem) {
  viewingAsset.value = asset;
}

function handleDelete(asset: AdminMediaAssetListItem) {
  deletingAsset.value = asset;
}

async function handleDeleteConfirm() {
  if (!deletingAsset.value) return;

  try {
    await mediaService.adminDeleteMediaAsset(deletingAsset.value.id);

    // Remove from local state
    mediaAssets.value = mediaAssets.value.filter(a => a.id !== deletingAsset.value!.id);
    totalCount.value = mediaAssets.value.length;

    deletingAsset.value = null;
  } catch (err) {
    console.error('Failed to delete media asset:', err);
    alert(err instanceof Error ? err.message : 'Failed to delete media asset');
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'ready': return 'bg-green-500/20 text-green-400';
    case 'processing': return 'bg-blue-500/20 text-blue-400';
    case 'uploading': return 'bg-yellow-500/20 text-yellow-400';
    case 'failed': return 'bg-rose-500/20 text-rose-400';
    case 'interrupted': return 'bg-orange-500/20 text-orange-400';
    default: return 'bg-white/10 text-white/60';
  }
}

function getKindBadgeColor(kind: string): string {
  switch (kind) {
    case 'match': return 'bg-purple-500/20 text-purple-400';
    case 'training': return 'bg-emerald-500/20 text-emerald-400';
    case 'clinic': return 'bg-cyan-500/20 text-cyan-400';
    default: return 'bg-white/10 text-white/60';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

onMounted(() => {
  loadMediaAssets();
  loadTotalCount();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="border-b border-white/10 bg-black p-6">
      <h1 class="text-2xl font-bold text-white">
        Media Assets <span class="text-white/40">({{ totalCount.toLocaleString() }})</span>
      </h1>
    </header>

    <!-- Filter Bar -->
    <div class="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/50 p-4">
      <!-- Show count -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-white/60">Show</span>
        <button
          v-for="count in [20, 50, 100]"
          :key="count"
          @click="showCount = count"
          :class="[
            'rounded px-2 py-1 text-sm transition',
            showCount === count
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          {{ count }}
        </button>
      </div>

      <!-- Divider -->
      <div class="h-6 w-px bg-white/10" />

      <!-- Status Filter -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="statusFilter = 'all'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            statusFilter === 'all'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          All
        </button>
        <button
          @click="statusFilter = 'ready'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            statusFilter === 'ready'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Ready
        </button>
        <button
          @click="statusFilter = 'processing'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            statusFilter === 'processing'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Processing
        </button>
        <button
          @click="statusFilter = 'failed'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            statusFilter === 'failed'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Failed
        </button>
      </div>

      <!-- Divider -->
      <div class="h-6 w-px bg-white/10" />

      <!-- Kind Filter -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="kindFilter = 'match'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            kindFilter === 'match'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Match
        </button>
        <button
          @click="kindFilter = 'training'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            kindFilter === 'training'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Training
        </button>
        <button
          @click="kindFilter = 'clinic'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            kindFilter === 'clinic'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Clinic
        </button>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Search -->
      <div class="relative w-full sm:w-64">
        <Icon icon="ph:magnifying-glass" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search files or uploaders..."
          class="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden bg-black p-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-white/60">Loading media assets...</div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex items-center justify-center py-12">
        <div class="text-rose-400">{{ error }}</div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasMediaAssets" class="flex flex-col items-center justify-center py-12">
        <Icon icon="ph:file-video-slash" class="h-16 w-16 text-white/20 mb-4" />
        <p class="text-white/60">No media assets found</p>
      </div>

      <!-- Media Assets List -->
      <div v-else class="space-y-3">
        <div
          v-for="asset in paginatedMediaAssets"
          :key="asset.id"
          class="group relative rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10 overflow-visible cursor-pointer"
          @click="handleViewDetails(asset)"
        >
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
              <Icon icon="ph:file-video" class="h-5 w-5 text-white/60" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <!-- Filename -->
              <div class="font-medium text-white mb-1 break-all">
                {{ truncateText(asset.file_name, 80) }}
              </div>

              <!-- Organization and Uploader -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60 mb-2">
                <span class="flex items-center gap-1">
                  <Icon icon="ph:users-three" class="h-3.5 w-3.5" />
                  {{ asset.org_name || 'N/A' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon icon="ph:user" class="h-3.5 w-3.5" />
                  {{ asset.uploader_name || 'Unknown' }}
                </span>
                <span class="text-white/40">{{ formatDate(asset.created_at) }}</span>
              </div>

              <!-- Badges and Info -->
              <div class="flex flex-wrap items-center gap-2">
                <span 
                  class="px-2 py-0.5 text-xs font-medium rounded capitalize"
                  :class="getStatusBadgeColor(asset.status)"
                >
                  {{ asset.status }}
                </span>
                <span 
                  class="px-2 py-0.5 text-xs font-medium rounded capitalize"
                  :class="getKindBadgeColor(asset.kind)"
                >
                  {{ asset.kind }}
                </span>
                <span class="text-xs text-white/60">
                  {{ formatDuration(asset.duration_seconds) }}
                </span>
                <span class="text-xs text-white/60">
                  {{ formatFileSize(asset.file_size_bytes) }}
                </span>
                <Icon 
                  v-if="asset.streaming_ready"
                  icon="ph:check-circle"
                  class="h-4 w-4 text-green-400"
                  title="Streaming ready"
                />
              </div>
            </div>

            <!-- Actions Menu -->
            <Menu as="div" class="relative flex-shrink-0">
              <MenuButton 
                class="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                @click.stop
              >
                <Icon icon="ph:dots-three-vertical-bold" class="h-5 w-5" />
              </MenuButton>
              <MenuItems class="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-white/20 bg-black py-1 shadow-xl focus:outline-none">
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleViewDetails(asset)"
                    :class="[
                      'flex w-full items-center gap-2 px-4 py-2 text-sm',
                      active ? 'bg-white/10 text-white' : 'text-white/80'
                    ]"
                  >
                    <Icon icon="ph:eye" class="h-4 w-4" />
                    View Details
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDelete(asset)"
                    :class="[
                      'flex w-full items-center gap-2 px-4 py-2 text-sm',
                      active ? 'bg-rose-500/20 text-rose-400' : 'text-rose-400'
                    ]"
                  >
                    <Icon icon="ph:trash" class="h-4 w-4" />
                    Delete
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="hasMediaAssets && totalPages > 1" class="mt-6 flex items-center justify-between">
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="rounded border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span class="text-sm text-white/60">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="rounded border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Modals -->
    <MediaAssetDetailsModal
      v-if="viewingAsset"
      :media-asset="viewingAsset"
      @close="viewingAsset = null"
    />

    <ConfirmDeleteModal
      v-if="deletingAsset"
      :show="true"
      :item-name="deletingAsset.file_name"
      :popup-title="`Delete ${deletingAsset.file_name}?`"
      @close="deletingAsset = null"
      @cancel="deletingAsset = null"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>
