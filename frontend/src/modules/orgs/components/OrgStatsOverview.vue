<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useOrgStats } from '../composables/useOrgStats';

const {
  loading,
  error,
  matchesLast30Days,
  coverage,
  learningActivity,
  attentionDensity,
  identityCoverage,
} = useOrgStats();
</script>

<template>
  <div class="space-y-4">
    <!-- Error state -->
    <div
      v-if="error"
      class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
    >
      {{ error }}
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <!-- Matches (last 30 days) -->
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Matches</div>
            <div class="mt-1 text-xs text-white/60">Last 30 days</div>
          </div>
          <Icon icon="carbon:video" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white">
            {{ matchesLast30Days }}
          </div>
        </div>
      </div>

      <!-- Coverage -->
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Coverage</div>
            <div class="mt-1 text-xs text-white/60">Reviewed</div>
          </div>
          <Icon icon="carbon:analytics" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-20 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-base font-semibold text-white leading-tight">
            {{ coverage.display }}
          </div>
        </div>
      </div>

      <!-- Learning Activity -->
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Learning</div>
            <div class="mt-1 text-xs text-white/60">Activity flow</div>
          </div>
          <Icon icon="carbon:task" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white">
            {{ learningActivity.count }}
          </div>
        </div>
      </div>

      <!-- Attention Density -->
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Attention</div>
            <div class="mt-1 text-xs text-white/60">Density</div>
          </div>
          <Icon icon="carbon:microphone" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white">
            {{ attentionDensity.average }}
          </div>
        </div>
      </div>

      <!-- Identity Coverage -->
      <div class="rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Identity</div>
            <div class="mt-1 text-xs text-white/60">Tagged clips</div>
          </div>
          <Icon icon="carbon:user-avatar" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white">
            {{ identityCoverage.count }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
