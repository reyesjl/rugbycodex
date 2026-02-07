<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { AdminNarrationListItem } from '@/modules/narrations/types/AdminNarrationListItem';
import type { NarrationSourceType } from '@/modules/narrations/types/Narration';
import EditNarrationModal from '@/modules/admin/components/EditNarrationModal.vue';
import NarrationDetailsModal from '@/modules/admin/components/NarrationDetailsModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

// Filter state
const showCount = ref<20 | 50 | 100>(20);
const sourceTypeFilter = ref<NarrationSourceType | 'all'>('all');
const searchQuery = ref('');
const debouncedSearch = ref('');

// Pagination
const currentPage = ref(1);

// Data
const narrations = ref<AdminNarrationListItem[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

// Modal states
const editingNarration = ref<AdminNarrationListItem | null>(null);
const viewingNarration = ref<AdminNarrationListItem | null>(null);
const deletingNarration = ref<AdminNarrationListItem | null>(null);

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    debouncedSearch.value = newValue;
  }, 500);
});

// Reset to page 1 when filters change
watch([debouncedSearch, sourceTypeFilter, showCount], () => {
  currentPage.value = 1;
});

// Load data when filters change
watch([debouncedSearch, sourceTypeFilter], () => {
  loadNarrations();
});

// Computed
const filteredNarrations = computed(() => {
  return narrations.value;
});

const paginatedNarrations = computed(() => {
  const start = (currentPage.value - 1) * showCount.value;
  const end = start + showCount.value;
  return filteredNarrations.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredNarrations.value.length / showCount.value);
});

const hasNarrations = computed(() => narrations.value.length > 0);

// Actions
async function loadNarrations() {
  loading.value = true;
  error.value = null;

  try {
    const filters = {
      searchQuery: debouncedSearch.value || undefined,
      sourceType: sourceTypeFilter.value === 'all' ? null : sourceTypeFilter.value,
    };

    narrations.value = await narrationService.listAllNarrations(filters);
    totalCount.value = narrations.value.length;
  } catch (err) {
    console.error('Failed to load narrations:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load narrations';
  } finally {
    loading.value = false;
  }
}

async function loadTotalCount() {
  try {
    const allNarrations = await narrationService.listAllNarrations();
    totalCount.value = allNarrations.length;
  } catch (err) {
    console.error('Failed to load total count:', err);
  }
}

function handleViewDetails(narration: AdminNarrationListItem) {
  viewingNarration.value = narration;
}

function handleEdit(narration: AdminNarrationListItem) {
  editingNarration.value = narration;
}

function handleDelete(narration: AdminNarrationListItem) {
  deletingNarration.value = narration;
}

async function handleEditSubmit(transcriptRaw: string) {
  if (!editingNarration.value) return;

  try {
    await narrationService.adminUpdateNarration(editingNarration.value.id, {
      transcriptRaw,
    });

    // Update local state
    const index = narrations.value.findIndex(n => n.id === editingNarration.value!.id);
    if (index !== -1 && narrations.value[index]) {
      narrations.value[index].transcript_raw = transcriptRaw;
    }

    editingNarration.value = null;
  } catch (err) {
    console.error('Failed to update narration:', err);
    alert(err instanceof Error ? err.message : 'Failed to update narration');
  }
}

async function handleDeleteConfirm() {
  if (!deletingNarration.value) return;

  try {
    await narrationService.adminDeleteNarration(deletingNarration.value.id);

    // Remove from local state
    narrations.value = narrations.value.filter(n => n.id !== deletingNarration.value!.id);
    totalCount.value = narrations.value.length;

    deletingNarration.value = null;
  } catch (err) {
    console.error('Failed to delete narration:', err);
    alert(err instanceof Error ? err.message : 'Failed to delete narration');
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date);
}

function getSourceBadgeColor(sourceType: string): string {
  switch (sourceType) {
    case 'coach': return 'bg-blue-500/20 text-blue-400';
    case 'staff': return 'bg-purple-500/20 text-purple-400';
    case 'member': return 'bg-emerald-500/20 text-emerald-400';
    default: return 'bg-white/10 text-white/60';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

onMounted(() => {
  loadNarrations();
  loadTotalCount();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="border-b border-white/10 bg-black p-6">
      <h1 class="text-3xl text-white">
        Narrations <span class="text-white/40">({{ totalCount.toLocaleString() }})</span>
      </h1>
    </header>

    <!-- Filter Bar -->
    <div class="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/50 p-4">
      <!-- Show count -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-white/60">Show</span>
        <button
          v-for="count in [20, 50, 100] as const"
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

      <!-- Source Type Filter -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="sourceTypeFilter = 'all'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            sourceTypeFilter === 'all'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          All
        </button>
        <button
          @click="sourceTypeFilter = 'coach'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            sourceTypeFilter === 'coach'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Coach
        </button>
        <button
          @click="sourceTypeFilter = 'staff'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            sourceTypeFilter === 'staff'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Staff
        </button>
        <button
          @click="sourceTypeFilter = 'member'"
          :class="[
            'rounded px-3 py-1.5 text-sm transition',
            sourceTypeFilter === 'member'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          ]"
        >
          Member
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
          placeholder="Search transcripts or authors..."
          class="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden bg-black p-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-white/60">Loading narrations...</div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex items-center justify-center py-12">
        <div class="text-rose-400">{{ error }}</div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasNarrations" class="flex flex-col items-center justify-center py-12">
        <Icon icon="ph:microphone-slash" class="h-16 w-16 text-white/20 mb-4" />
        <p class="text-white/60">No narrations found</p>
      </div>

      <!-- Narrations List -->
      <div v-else class="space-y-3">
        <div
          v-for="narration in paginatedNarrations"
          :key="narration.id"
          class="group relative rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10 overflow-visible"
        >
          <div class="flex items-start gap-4">
            <!-- Avatar -->
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
              <Icon icon="ph:microphone" class="h-5 w-5 text-white/60" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <!-- Author and Badge -->
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-white">{{ narration.author_name || 'Unknown' }}</span>
                <span class="text-sm text-white/40">@{{ narration.author_username || 'N/A' }}</span>
                <span 
                  class="px-2 py-0.5 text-xs font-medium rounded capitalize"
                  :class="getSourceBadgeColor(narration.source_type)"
                >
                  {{ narration.source_type }}
                </span>
              </div>

              <!-- Organization and Media -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60 mb-2">
                <span class="flex items-center gap-1">
                  <Icon icon="ph:users-three" class="h-3.5 w-3.5" />
                  {{ narration.org_name || 'N/A' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon icon="ph:video" class="h-3.5 w-3.5" />
                  {{ narration.media_asset_title || 'Untitled' }}
                </span>
                <span class="text-white/40">{{ formatDate(narration.created_at) }}</span>
              </div>

              <!-- Transcript Preview -->
              <p class="text-sm text-white/70">
                {{ truncateText(narration.transcript_raw, 200) }}
              </p>
            </div>

            <!-- Actions Menu -->
            <Menu as="div" class="relative flex-shrink-0">
              <MenuButton class="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white">
                <Icon icon="ph:dots-three-vertical-bold" class="h-5 w-5" />
              </MenuButton>
              <MenuItems class="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-white/20 bg-black py-1 shadow-xl focus:outline-none">
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleViewDetails(narration)"
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
                    @click="handleEdit(narration)"
                    :class="[
                      'flex w-full items-center gap-2 px-4 py-2 text-sm',
                      active ? 'bg-white/10 text-white' : 'text-white/80'
                    ]"
                  >
                    <Icon icon="ph:pencil" class="h-4 w-4" />
                    Edit Transcript
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    @click="handleDelete(narration)"
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
      <div v-if="hasNarrations && totalPages > 1" class="mt-6 flex items-center justify-between">
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
    <EditNarrationModal
      v-if="editingNarration"
      :narration="editingNarration"
      @close="editingNarration = null"
      @submit="handleEditSubmit"
    />

    <NarrationDetailsModal
      v-if="viewingNarration"
      :narration="viewingNarration"
      @close="viewingNarration = null"
    />

    <ConfirmDeleteModal
      v-if="deletingNarration"
      :show="true"
      :item-name="deletingNarration.author_name || 'Unknown'"
      :popup-title="`Delete narration by ${deletingNarration.author_name || 'Unknown'}?`"
      @close="deletingNarration = null"
      @cancel="deletingNarration = null"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>
