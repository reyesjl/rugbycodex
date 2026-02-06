<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useOrgUsage } from '@/modules/usage/composables/useOrgUsage';
import { formatStorage, formatPercent } from '@/lib/format';

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const orgName = computed(() => orgContext.value?.organization.name ?? 'Organization');

const { loading, error, usage, isWarning, isCritical } = useOrgUsage();

const progressClass = computed(() => {
  if (isCritical.value) return 'bg-red-400';
  if (isWarning.value) return 'bg-amber-400';
  return 'bg-emerald-400';
});
</script>

<template>
  <div class="container py-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
      <div>
        <h1 class="text-white text-3xl tracking-tight">Usage</h1>
        <p class="text-sm text-white/60 mt-1">Storage usage for {{ orgName }}.</p>
      </div>
    </div>

    <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
      {{ error }}
    </div>

    <div v-if="loading" class="text-white/60">
      Loading usage…
    </div>

    <div v-else-if="!usage" class="text-white/60">
      No usage data available.
    </div>

    <div v-else class="space-y-6">
      <!-- Storage Usage -->
      <div>
        <h2 class="text-xl font-semibold text-white mb-4">Storage</h2>
        <div class="text-3xl font-medium text-white">
          {{ formatStorage(usage.storage_used_mb) }} of {{ formatStorage(usage.storage_limit_mb) }} used
        </div>
        <div class="mt-2 text-sm text-white/60">
          {{ formatPercent(usage.percent_used) }} of your storage capacity
        </div>

        <div class="mt-4">
          <div class="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              class="h-full transition-all"
              :class="progressClass"
              :style="{ width: `${usage.percent_used}%`, maxWidth: '100%' }"
            />
          </div>
        </div>
      </div>

      <!-- Storage Warnings -->
      <div
        v-if="isCritical"
        class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"
      >
        Critical: storage usage is above 95%.
      </div>
      <div
        v-else-if="isWarning"
        class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200"
      >
        Warning: storage usage is above 80%.
      </div>

      <!-- Match Summary Generations (Placeholder) -->
      <div class="pt-6 border-t border-white/10">
        <h2 class="text-xl font-semibold text-white mb-4">Match Summary Generations</h2>
        <div class="rounded-lg border border-white/10 bg-white/5 p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-2xl font-medium text-white">
                0 of ∞
              </div>
              <div class="text-sm text-white/60 mt-1">
                AI-generated match summaries this month
              </div>
            </div>
            <div class="text-white/40">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div class="text-xs text-white/40">
            Coming soon: Track your AI-generated match summaries and analysis
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
