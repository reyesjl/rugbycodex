<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import MediaProcessingStatusBanner from '@/modules/media/components/MediaProcessingStatusBanner.vue';
import { useMediaProcessingStatus } from '@/modules/media/composables/useMediaProcessingStatus';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { UploadState } from '@/modules/media/types/UploadStatus';
import { formatDaysAgo } from '@/lib/date';
import { getMediaAssetStatusDisplay } from '@/lib/status';
import { formatHoursMinutes } from '@/lib/duration';

const props = defineProps<{
  asset: OrgMediaAsset;
  canManage?: boolean;
  uploadMetrics?: {
    state: UploadState;
    progress: number;
    uploadSpeedBps?: number;
  };
}>();

const emit = defineEmits(['open', 'review', 'delete', 'reattach', 'edit']);

const statusDisplay = computed(() => getMediaAssetStatusDisplay(props.asset.status));

// Use processing status composable
const { processingStatus } = useMediaProcessingStatus(computed(() => props.asset));

// Video is interactive once it's watchable (streaming_ready = true)
const isInteractive = computed(() => processingStatus.value.isWatchable);

const isActivelyUploading = computed(() => props.uploadMetrics?.state === 'uploading');

const STORAGE_BASE_URL = 'https://cdn.rugbycodex.com';

const thumbnailUrl = computed(() => {
  if (!props.asset.thumbnail_path) return null;
  return `${STORAGE_BASE_URL}/${props.asset.thumbnail_path}`;
});

const isReadyToPlay = computed(() => {
  return props.asset.status === 'ready' && props.asset.streaming_ready;
});

const isStreamingProcessing = computed(
  () => props.asset.status === 'ready' && !props.asset.streaming_ready
);

const isAbandoned = computed(() => {
  // If actively uploading, not abandoned
  if (props.uploadMetrics?.state === 'uploading') return false;
  // Check both database status and upload state
  return props.asset.status === 'interrupted' || props.uploadMetrics?.state === 'abandoned';
});

// Show overlay only during blocking processing (transcoding)
const showBlockingOverlay = computed(() => {
  return processingStatus.value.isBlockingProcessing;
});

// Show small badge for background processing (event detection)
const showBackgroundBadge = computed(() => {
  return processingStatus.value.isBackgroundProcessing;
});

const overlayIconName = computed(() => {
  // Don't show icon if we're showing processing overlays/badges
  if (showBlockingOverlay.value || showBackgroundBadge.value) return null;
  
  if (isAbandoned.value) return 'carbon:warning-alt';
  if (isInteractive.value) return 'carbon:play-filled-alt';
  return null;
});

const overlayIconClass = computed(() => {
  if (isAbandoned.value) return 'text-yellow-500/70';
  if (isInteractive.value) return 'text-white/30';
  return 'text-white/40';
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
const menuRef = ref<HTMLElement | null>(null);
const menuButtonRef = ref<HTMLElement | null>(null);

const canManage = computed(() => Boolean(props.canManage));

function closeMenu() {
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function handleClickOutside(event: MouseEvent) {
  if (!menuOpen.value) return;
  const target = event.target as Node | null;
  if (menuButtonRef.value?.contains(target) || menuRef.value?.contains(target)) return;
  closeMenu();
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

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
            :src="thumbnailUrl"
            :alt="clipTitle(asset.file_name)"
            loading="lazy"
          />

          <!-- Blocking Processing Overlay (transcoding) -->
          <MediaProcessingStatusBanner 
            v-if="showBlockingOverlay"
            :status="processingStatus" 
            mode="overlay"
          />

          <!-- Background Processing Badge (event detection) -->
          <div
            v-else-if="showBackgroundBadge"
            class="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-purple-600/30 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20"
          >
            <LoadingDot size="sm" color="#FFFFFF" />
            <span>Analyzing</span>
          </div>

          <!-- Play icon or abandoned warning (when not processing) -->
          <div
            v-if="!showBlockingOverlay && !showBackgroundBadge && overlayIconName"
            class="absolute inset-0 flex items-center justify-center"
          >
            <Icon
              :icon="overlayIconName"
              class="h-10 w-10"
              :class="overlayIconClass"
            />
          </div>
        </div>

        <div
          class="absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
        >
          {{ formatHoursMinutes(asset.duration_seconds) }}
        </div>
      </div>

      <!-- Upload progress -->
      <div v-if="showUploadProgress" class="mt-2 h-1 w-full rounded bg-white/10">
        <div class="h-full rounded bg-blue-500/70" :style="uploadProgressStyle" />
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

        <!-- Actions and Status Row -->
        <div class="flex items-center justify-between gap-2">
          <!-- Status - only show if not ready -->
          <div v-if="!isReadyToPlay || isAbandoned || showUploadProgress" class="inline-flex items-center gap-1 text-xs min-w-0">
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

          <!-- Spacer to push actions to the right when no status -->
          <div v-else class="flex-1"></div>

          <!-- Actions menu -->
          <div class="relative z-20">
            <button
              v-if="canManage"
              ref="menuButtonRef"
              type="button"
              class="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white/80 transition"
              aria-label="More actions"
              @click.stop="toggleMenu"
            >
              <Icon icon="carbon:overflow-menu-vertical" class="h-4 w-4" />
            </button>

            <div
              v-if="menuOpen && canManage"
              ref="menuRef"
              class="absolute right-0 bottom-full mb-2 min-w-28 rounded-md border border-white/10 bg-black/60 backdrop-blur-md text-white z-50"
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
              <!-- Manual event detection trigger (for testing) -->

              <button
                type="button"
                class="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-white/10 transition border-t border-white/10"
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
