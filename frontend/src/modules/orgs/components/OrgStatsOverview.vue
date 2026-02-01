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
      <button
        @click="openModal('matches')"
        class="group rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/30 hover:bg-white/10 hover:shadow-lg active:scale-95"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition">Matches</div>
            <div class="mt-1 text-xs text-white/60 group-hover:text-white/80 transition">Last 30 days</div>
          </div>
          <Icon icon="carbon:video" class="h-4 w-4 text-white/30 flex-shrink-0 group-hover:text-white/50 transition" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white group-hover:text-white transition">
            {{ matchesLast30Days }}
          </div>
        </div>
      </button>

      <!-- Coverage -->
      <button
        @click="openModal('coverage')"
        class="group rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/30 hover:bg-white/10 hover:shadow-lg active:scale-95"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition">Coverage</div>
            <div class="mt-1 text-xs text-white/60 group-hover:text-white/80 transition">Reviewed</div>
          </div>
          <Icon icon="carbon:analytics" class="h-4 w-4 text-white/30 flex-shrink-0 group-hover:text-white/50 transition" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-20 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-base font-semibold text-white leading-tight group-hover:text-white transition">
            {{ coverage.display }}
          </div>
        </div>
      </button>

      <!-- Learning Activity -->
      <button
        @click="openModal('learning')"
        class="group rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/30 hover:bg-white/10 hover:shadow-lg active:scale-95"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition">Learning</div>
            <div class="mt-1 text-xs text-white/60 group-hover:text-white/80 transition">Activity flow</div>
          </div>
          <Icon icon="carbon:task" class="h-4 w-4 text-white/30 flex-shrink-0 group-hover:text-white/50 transition" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white group-hover:text-white transition">
            {{ learningActivity.count }}
          </div>
        </div>
      </button>

      <!-- Attention Density -->
      <button
        @click="openModal('attention')"
        class="group rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/30 hover:bg-white/10 hover:shadow-lg active:scale-95"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition">Attention</div>
            <div class="mt-1 text-xs text-white/60 group-hover:text-white/80 transition">Density</div>
          </div>
          <Icon icon="carbon:microphone" class="h-4 w-4 text-white/30 flex-shrink-0 group-hover:text-white/50 transition" />
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <template v-else>
            <div class="text-2xl font-semibold text-white group-hover:text-white transition">
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
      </button>

      <!-- Identity Coverage -->
      <button
        @click="openModal('identity')"
        class="group rounded-lg border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-white/30 hover:bg-white/10 hover:shadow-lg active:scale-95"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition">Identity</div>
            <div class="mt-1 text-xs text-white/60 group-hover:text-white/80 transition">Tagged clips</div>
          </div>
          <Icon icon="carbon:user-avatar" class="h-4 w-4 text-white/30 flex-shrink-0 group-hover:text-white/50 transition" />
        </div>
        <div class="mt-3">
          <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
          <div v-else class="text-2xl font-semibold text-white group-hover:text-white transition">
            {{ identityCoverage.count }}
          </div>
        </div>
      </button>
    </div>

    <!-- Modal -->
    <OrgStatModal
      :stat-type="selectedStat"
      :is-open="modalOpen"
      @close="closeModal"
    />
  </div>
</template>
