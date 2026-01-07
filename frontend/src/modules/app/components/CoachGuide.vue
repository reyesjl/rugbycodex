<script setup lang="ts">
import { CDN_BASE } from '@/lib/cdn';

const coachImage = `${CDN_BASE}/static/assets/helper/coach.png`;

const props = withDefaults(defineProps<{ imgWidth?: string }>(), {
    imgWidth: '140px',
});
</script>

<template>
    <div class="flex items-start gap-4">
        <img
            :src="coachImage"
            alt="Coach illustration"
            class="block flex-shrink-0"
            :style="{ maxWidth: props.imgWidth }"
        />
        <div class="flex-1">
            <slot />
        </div>
    </div>
</template>
