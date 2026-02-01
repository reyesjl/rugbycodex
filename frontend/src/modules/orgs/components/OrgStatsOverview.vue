<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useOrgStats } from '../composables/useOrgStats';
import OrgStatModal from './OrgStatModal.vue';

type StatType = 'matches' | 'coverage' | 'learning' | 'attention' | 'identity';

const {
  loading,
  error,
  matchesLast30Days,
  coverage,
  learningActivity,
  attentionDensity,
  identityCoverage,
} = useOrgStats();

const modalOpen = ref(false);
const selectedStat = ref<StatType>('matches');

const openModal = (statType: StatType) => {
  selectedStat.value = statType;
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
};
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
      <div class="relative rounded-lg border border-white/10 bg-white/5 p-4">
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
        <!-- Info icon -->
        <button
          @click.stop="openModal('matches')"
          class="absolute bottom-2 right-2 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          title="Learn more about this metric"
        >
          <Icon icon="carbon:information" class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Coverage -->
      <div class="relative rounded-lg border border-white/10 bg-white/5 p-4">
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
        <!-- Info icon -->
        <button
          @click.stop="openModal('coverage')"
          class="absolute bottom-2 right-2 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          title="Learn more about this metric"
        >
          <Icon icon="carbon:information" class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Learning Activity -->
      <div class="relative rounded-lg border border-white/10 bg-white/5 p-4">
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
        <!-- Info icon -->
        <button
          @click.stop="openModal('learning')"
          class="absolute bottom-2 right-2 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          title="Learn more about this metric"
        >
          <Icon icon="carbon:information" class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Attention Density -->
      <div class="relative rounded-lg border border-white/10 bg-white/5 p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">Attention</div>
            <div class="mt-1 text-xs text-white/60">Density</div>
          </div>
          <Icon icon="carbon:microphone" class="h-4 w-4 text-white/30 flex-shrink-0" />
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <template v-else>
            <div class="text-2xl font-semibold text-white">
              {{ attentionDensity.average }}
            </div>
            <!-- Tier indicator -->
            <div
              v-if="attentionDensity.tier !== 'none'"
              class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              :class="{
                'bg-red-500/20 text-red-300': attentionDensity.tier === 'not_covered',
                'bg-yellow-500/20 text-yellow-300': attentionDensity.tier === 'partial',
                'bg-emerald-500/20 text-emerald-300': attentionDensity.tier === 'well_covered',
                'bg-blue-500/20 text-blue-300': attentionDensity.tier === 'very_well_covered'
              }"
            >
              {{ attentionDensity.tier === 'not_covered' ? 'Low' : 
                 attentionDensity.tier === 'partial' ? 'OK' : 
                 attentionDensity.tier === 'well_covered' ? 'Good' : 'Great' }}
            </div>
          </template>
        </div>
        <!-- Info icon -->
        <button
          @click.stop="openModal('attention')"
          class="absolute bottom-2 right-2 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          title="Learn more about this metric"
        >
          <Icon icon="carbon:information" class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Identity Coverage -->
      <div class="relative rounded-lg border border-white/10 bg-white/5 p-4">
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
        <!-- Info icon -->
        <button
          @click.stop="openModal('identity')"
          class="absolute bottom-2 right-2 rounded-full p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95"
          title="Learn more about this metric"
        >
          <Icon icon="carbon:information" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Modal -->
    <OrgStatModal
      :stat-type="selectedStat"
      :is-open="modalOpen"
      @close="closeModal"
    />
  </div>
</template>
