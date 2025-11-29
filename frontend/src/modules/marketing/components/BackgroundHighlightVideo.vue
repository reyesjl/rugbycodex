<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Props {
  srcMp4: string;
  srcWebm?: string;
  randomWindow?: number; // seconds
  highlights?: Array<number | string>; // timestamps to bias toward
  highlightBias?: number; // probability to pick a highlight (0-1), default 0.7
  bgClass?: string; // Tailwind utility classes for background (e.g., 'bg-black')
}

const props = defineProps<Props>();
const videoRef = ref<HTMLVideoElement | null>(null);

onMounted(() => {
  const video = videoRef.value;
  if (!video) return;

  const randomWindow = Math.max(0, props.randomWindow ?? 30);

  const parseTimestamp = (t: number | string): number => {
    if (typeof t === 'number' && isFinite(t)) return Math.max(0, t);
    if (typeof t === 'string') {
      // Supports formats like "M:SS" or "H:MM:SS"
      const parts = t.trim().split(':').map(Number);
      if (parts.some((p) => Number.isNaN(p))) return 0;
      if (parts.length === 2) {
        const [m = 0, s = 0] = parts;
        return Math.max(0, m * 60 + s);
      }
      if (parts.length === 3) {
        const [h = 0, m = 0, s = 0] = parts;
        return Math.max(0, h * 3600 + m * 60 + s);
      }
      return 0;
    }
    return 0;
  };

  const seekAndPlay = () => {
    const duration = video.duration || 0;
    if (!isFinite(duration) || duration <= 0) return;

    const maxStart = Math.max(0, duration - randomWindow);

    const bias = Math.min(1, Math.max(0, props.highlightBias ?? 0.7));
    const hasHighlights = Array.isArray(props.highlights) && props.highlights.length > 0;

    let start = Math.random() * maxStart;

    if (hasHighlights && Math.random() < bias) {
      const candidates = props.highlights!.map(parseTimestamp).filter((s) => s >= 0 && isFinite(s));
      if (candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        const pick = candidates[idx] as number;
        // Clamp pick to ensure window fits
        start = Math.min(Math.max(0, pick), maxStart);
      }
    }

    try {
      video.currentTime = start;
    } catch (_) {
      // Ignore seek errors
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // Ignore autoplay rejection (should be allowed since muted)
      });
    }
  };

  if (video.readyState >= 1) {
    // HAVE_METADATA or more
    seekAndPlay();
  } else {
    const onLoadedMeta = () => {
      seekAndPlay();
      video.removeEventListener('loadedmetadata', onLoadedMeta);
    };
    video.addEventListener('loadedmetadata', onLoadedMeta);
  }
});
</script>

<template>
  <div class="relative">
    <video
      ref="videoRef"
      class="w-full h-auto md:pt-10"
      :class="props.bgClass"
      autoplay
      loop
      muted
      playsinline
    >
      <source v-if="props.srcWebm" :src="props.srcWebm" type="video/webm" />
      <source :src="props.srcMp4" type="video/mp4" />
    </video>
    <!-- Linear black gradient bottom to top -->
    <div class="absolute bottom-0 left-0 right-0 h-20 md:h-100 pointer-events-none bg-gradient-to-t from-black via-black/40 to-transparent"></div>
  </div>
</template>
