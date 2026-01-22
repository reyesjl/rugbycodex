<script setup lang="ts">
import { Icon } from '@iconify/vue';

const bullets = [
  'Your personal work-ons will appear here once you start tagging yourself in match clips.',
  'Coaching focus areas will appear here as you add narrations and assignments.',
  "Recent activity will show what’s changed since your last session.",
  'Your moments will collect the clips you appear in.',
  'Your tasks will track assignments you’ve been given.',
];
</script>

<template>
  <div class="max-w-3xl rounded-lg border border-violet-400/25 bg-violet-500/5 p-3 shadow-[0_0_24px_rgba(139,92,246,0.16)]">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2 min-w-0">
        <Icon icon="carbon:information" width="16" height="16" class="text-violet-200 mt-0.5" />
        <div class="min-w-0">
          <div class="text-sm font-semibold text-white truncate">My Rugby preview</div>
          <div class="text-xs text-white/60">
            Join a workspace to see personalized insights from your matches.
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3">
      <ul class="space-y-1 text-sm text-white/90">
        <li v-for="(item, idx) in bullets" :key="idx" class="flex gap-2">
          <span class="text-violet-200">•</span>
          <span class="leading-snug">{{ item }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
