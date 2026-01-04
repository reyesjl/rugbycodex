<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import { formatDaysAgo } from '@/lib/date';
import { getMediaAssetStatusDisplay } from '@/lib/status';
import { formatHoursMinutes } from '@/lib/duration';

const props = defineProps<{
  asset: OrgMediaAsset;
  narrationCount: number;
}>();

const statusDisplay = computed(() => getMediaAssetStatusDisplay(props.asset.status));

const isInteractive = computed(() => props.asset.status === 'ready');

const overlayIconName = computed(() => {
  const status = props.asset.status;
  if (status === 'ready') return 'carbon:play-filled-alt';
  if (status === 'processing' || status === 'uploading') return 'ei:spinner';
  return statusDisplay.value.icon ?? 'ei:spinner';
});

const overlayIconClass = computed(() => {
  const status = props.asset.status;
  if (status === 'ready') return 'text-white/30';
  const shouldSpin = status === 'processing' || status === 'uploading';
  return `text-white/40${shouldSpin ? ' animate-spin' : ''}`;
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
      isInteractive
        ? 'hover:cursor-pointer hover:bg-white/10 hover:ring-white/20'
        : 'pointer-events-none opacity-60'
    "
  >
    <div class="p-3">
      <!-- Thumbnail placeholder -->
      <div class="relative overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
        <div class="relative w-full pb-[56.25%]">
          <div class="absolute inset-0 flex items-center justify-center">
            <Icon :icon="overlayIconName" class="h-10 w-10" :class="overlayIconClass" />
          </div>
        </div>

        <div
          class="absolute bottom-2 right-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
        >
          {{ formatHoursMinutes(asset.duration_seconds) }}
        </div>
      </div>

      <!-- Context coverage indicator (thin bar) -->
      <div class="mt-2 h-1 w-full rounded bg-white/10">
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
        <div class="inline-flex items-center gap-1 text-xs text-white/40">
          <Icon
            v-if="statusDisplay.icon"
            :icon="statusDisplay.icon!"
            class="h-3.5 w-3.5"
            :class="statusDisplay.iconClass"
          />
          <span>{{ statusDisplay.label }}</span>
        </div>
      </div>
    </div>
  </article>
</template>
