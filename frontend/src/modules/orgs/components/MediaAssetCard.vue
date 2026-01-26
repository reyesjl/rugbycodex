<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { UploadState } from '@/modules/media/types/UploadStatus';
import { formatDaysAgo } from '@/lib/date';
import { getMediaAssetStatusDisplay } from '@/lib/status';
import { formatHoursMinutes } from '@/lib/duration';

const props = defineProps<{
  asset: OrgMediaAsset;
  narrationCount: number;
  canManage?: boolean;
  uploadMetrics?: {
    state: UploadState;
    progress: number;
    uploadSpeedBps?: number;
  };
}>();

const emit = defineEmits(['open', 'review', 'delete', 'reattach', 'edit']);

const statusDisplay = computed(() => getMediaAssetStatusDisplay(props.asset.status));

const isInteractive = computed(() => props.asset.status === 'ready' && props.asset.streaming_ready);

const isActivelyUploading = computed(() => props.uploadMetrics?.state === 'uploading');

const STORAGE_BASE_URL = 'https://cdn.rugbycodex.com';

const thumbnailUrl = computed(() => {
  if (!props.asset.thumbnail_path) return null;
  return `${STORAGE_BASE_URL}/${props.asset.thumbnail_path}`;
});

const showThumbnail = computed(() => !!thumbnailUrl.value);

const isStreamingProcessing = computed(
  () => props.asset.status === 'ready' && !props.asset.streaming_ready
);

const isAbandoned = computed(() => {
  // If actively uploading, not abandoned
  if (props.uploadMetrics?.state === 'uploading') return false;
  // Check both database status and upload state
  return props.asset.status === 'interrupted' || props.uploadMetrics?.state === 'abandoned';
});

const overlayIconName = computed(() => {
  if (isAbandoned.value) return 'carbon:warning-alt';
  const status = props.asset.status;
  if (status === 'processing') return 'carbon:data-regular';
  if (status === 'ready' && !props.asset.streaming_ready) return 'carbon:data-regular';
  if (status === 'ready') return 'carbon:play-filled-alt';
  if (status === 'uploading') return 'ei:spinner';
  if (status === 'uploaded') return 'ei:spinner';
  return statusDisplay.value.icon ?? 'ei:spinner';
});

const overlayIconClass = computed(() => {
  if (isAbandoned.value) return 'text-yellow-500/70';
  const status = props.asset.status;
  if (status === 'ready' && props.asset.streaming_ready) return 'text-white/30';
  if (status === 'processing' || (status === 'ready' && !props.asset.streaming_ready)) {
    return 'text-white/40 animate-spin';
  }
  if (status === 'uploading' || status === 'uploaded') return 'text-white/40 animate-spin';
  return 'text-white/40';
});

const contextProgressStyle = computed(() => {
  const progress = Math.min(props.narrationCount / 5, 1);
  return { width: `${Math.round(progress * 100)}%` };
});

const contextFillClass = computed(() => {
  const count = props.narrationCount;
  if (count <= 0) return 'bg-transparent';
  if (count >= 10) return 'bg-emerald-300/40';
  return 'bg-amber-300/40';
});

const narrationCountLabel = computed(() => {
  const count = props.narrationCount;
  return count === 1 ? '1 narration' : `${count} narrations`;
});

const showUploadProgress = computed(
  () => props.asset.status === 'uploading' && props.uploadMetrics?.state === 'uploading'
);

const uploadProgressStyle = computed(() => {
  const progress = props.uploadMetrics?.progress ?? 0;
  return { width: `${Math.min(100, Math.max(0, progress))}%` };
});

const uploadSpeedLabel = computed(() => {
  const bps = props.uploadMetrics?.uploadSpeedBps;
  if (!bps || !Number.isFinite(bps) || bps <= 0) return '';
  const mbps = (bps * 8) / (1024 * 1024);
  return `${mbps.toFixed(1)} Mbps`;
});

const menuOpen = ref(false);

const canManage = computed(() => Boolean(props.canManage));

function closeMenu() {
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function handleEdit() {
  if (!canManage.value) return;
  closeMenu();
  emit('edit', props.asset.id);
}

function handleReview() {
  if (!canManage.value) return;
  if (!isInteractive.value) return;
  closeMenu();
  emit('review', props.asset.id);
}

function handleDelete() {
  if (!canManage.value) return;
  closeMenu();
  emit('delete', props.asset.id);
}

function handleReattach() {
  closeMenu();
  emit('reattach', props.asset.id);
}

function handleCardClick() {
  closeMenu();
  if (isAbandoned.value) {
    handleReattach();
    return;
  }
  if (isInteractive.value) {
    emit('open', props.asset.id);
  }
}

function clipTitle(fileName: string) {
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[\-_]+/g, ' ').trim() || 'Untitled clip';
}
</script>

<template>
  <article
    class="group overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 transition"
    :class="
      isInteractive || isAbandoned || isActivelyUploading
        ? 'hover:cursor-pointer hover:bg-white/10 hover:ring-white/20'
        : 'opacity-60'
    "
    @click="handleCardClick"
  >
    <div class="p-3">
      <!-- Thumbnail placeholder -->
      <div class="relative overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
        <div class="relative w-full pb-[56.25%]">
          <img
            v-if="thumbnailUrl"
            class="absolute inset-0 h-full w-full object-cover"
            :class="isStreamingProcessing ? 'opacity-60' : ''"
            :src="thumbnailUrl"
            :alt="clipTitle(asset.file_name)"
            loading="lazy"
          />

          <div
            v-if="!showThumbnail || isStreamingProcessing"
            class="absolute inset-0 flex items-center justify-center"
          >
            <Icon :icon="overlayIconName" class="h-10 w-10" :class="overlayIconClass" />
          </div>
        </div>

        <div
          class="absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
        >
          {{ formatHoursMinutes(asset.duration_seconds) }}
        </div>
      </div>

      <!-- Context coverage indicator (thin bar) OR upload progress -->
      <div v-if="showUploadProgress" class="mt-2 h-1 w-full rounded bg-white/10">
        <div class="h-full rounded bg-green-500/70" :style="uploadProgressStyle" />
      </div>
      <div v-else class="mt-2 h-1 w-full rounded bg-white/10">
        <div class="h-full rounded" :class="contextFillClass" :style="contextProgressStyle" />
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
          {{ narrationCountLabel }} • {{ formatDaysAgo(asset.created_at) ?? 'Unknown date' }}
        </div>

        <!-- Status -->
        <div class="flex items-center justify-between gap-2">
          <div class="inline-flex items-center gap-1 text-xs min-w-0">
            <Icon
              v-if="statusDisplay.icon"
              :icon="statusDisplay.icon!"
              class="h-3.5 w-3.5"
              :class="statusDisplay.iconClass"
            />
            <span class="truncate" :class="statusDisplay.textClass || 'text-white/40'">
              <template v-if="isAbandoned">
                <span class="text-yellow-500/80">Upload interrupted. Click to retry.</span>
              </template>
              <template v-else>
                {{ isStreamingProcessing ? 'Processing' : statusDisplay.label }}
                <span v-if="showUploadProgress"> • {{ uploadMetrics!.progress }}%</span>
                <span v-if="showUploadProgress && uploadSpeedLabel"> • {{ uploadSpeedLabel }}</span>
              </template>
            </span>
          </div>

          <div class="relative">
            <button
              v-if="canManage"
              type="button"
              class="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white/80 transition"
              aria-label="More actions"
              @click.stop="toggleMenu"
            >
              <Icon icon="carbon:overflow-menu-vertical" class="h-4 w-4" />
            </button>

            <div
              v-if="menuOpen && canManage"
              class="absolute right-0 bottom-full mb-2 min-w-28 rounded-md border border-white/20 bg-black text-white shadow-none"
              @click.stop
            >
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-xs hover:bg-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="!isInteractive"
                @click="handleReview"
              >
                Review
              </button>
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-xs hover:bg-white/10 transition"
                @click="handleEdit"
              >
                Edit
              </button>
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-white/10 transition"
                @click="handleDelete"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
