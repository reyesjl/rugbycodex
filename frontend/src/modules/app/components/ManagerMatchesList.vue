<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useManagerMatches } from '@/modules/app/composables/useManagerMatches';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';

const router = useRouter();
const myOrgsStore = useMyOrganizationsStore();

const {
  filteredMatches,
  loading,
  error,
  isEmpty,
  isFilteredEmpty,
  selectedKind,
  selectedLimit,
  loadMatches,
  getCoverageDisplay,
  formatDuration,
  formatRelativeDate,
  getNarrationProgress,
} = useManagerMatches();

onMounted(() => {
  loadMatches();
});

// Reload matches when limit changes
watch(selectedLimit, () => {
  loadMatches();
});

const navigateToMatch = (orgId: string, matchId: string) => {
  // Find org slug from orgId
  const org = myOrgsStore.items.find(item => item.organization.id === orgId);
  if (org) {
    router.push({
      name: 'OrgMediaAssetReview',
      params: {
        slug: org.organization.slug,
        mediaAssetId: matchId,
      },
    });
  }
};
</script>

<template>
  <section class="container-lg text-white pt-20">
    <div class="flex flex-col gap-4 mb-4">
      <div class="text-2xl font-semibold">Your matches</div>
      
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <!-- Limit selector -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-white/50">Show</span>
          <button
            type="button"
            @click="selectedLimit = 5"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 5 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            5
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedLimit = 10"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 10 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            10
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedLimit = 20"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 20 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            20
          </button>
        </div>

        <!-- Kind filter toggle -->
        <div class="flex items-center gap-3 text-sm">
          <button
            type="button"
            @click="selectedKind = 'all'"
            class="transition"
            :class="selectedKind === 'all' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            All
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'match'"
            class="transition"
            :class="selectedKind === 'match' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Match
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'training'"
            class="transition"
            :class="selectedKind === 'training' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Training
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedKind = 'clinic'"
            class="transition"
            :class="selectedKind === 'clinic' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Clinic
          </button>
        </div>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="animate-pulse">
        <div class="flex gap-4 p-4 bg-white/5 rounded-lg">
          <div class="w-32 h-20 bg-white/10 rounded flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 bg-white/10 rounded w-2/3"></div>
            <div class="h-4 bg-white/10 rounded w-1/2"></div>
            <div class="h-3 bg-white/10 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-4">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="text-xs text-white/40">
      <p>No matches found in your organizations yet.</p>
      <p class="mt-2">Matches will appear here once your teams start uploading footage.</p>
    </div>

    <!-- Filtered empty state -->
    <div v-else-if="isFilteredEmpty" class="text-xs text-white/40">
      <p>No {{ selectedKind }} matches found.</p>
      <p class="mt-2">Try selecting a different filter or uploading more footage.</p>
    </div>

    <!-- Matches list -->
    <div v-else class="space-y-3">
      <button
        v-for="match in filteredMatches"
        :key="match.id"
        @click="navigateToMatch(match.orgId, match.id)"
        class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer text-left"
      >
        <!-- Thumbnail -->
        <div class="w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-black">
          <img
            v-if="match.thumbnailPath"
            :src="`https://cdn.rugbycodex.com/${match.thumbnailPath}`"
            :alt="match.title"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-white/20 text-xs"
          >
            <Icon icon="carbon:video" width="24" />
          </div>
        </div>

        <!-- Match info -->
        <div class="flex-1 min-w-0 flex flex-col justify-between">
          <!-- Title & org -->
          <div>
            <div class="flex items-start gap-2 mb-1">
              <h3 class="font-semibold text-white group-hover:text-white/90 truncate capitalize flex-1">
                {{ formatMediaAssetNameForDisplay(match.title) }}
              </h3>
              <span class="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded uppercase tracking-wide">
                {{ match.orgName }}
              </span>
            </div>
            
            <!-- Metadata -->
            <div class="flex items-center gap-2 text-xs text-white/50">
              <span>{{ formatRelativeDate(match.createdAt) }}</span>
              <span class="text-white/30">•</span>
              <span>{{ formatDuration(match.durationSeconds) }}</span>
            </div>
          </div>

          <!-- Coverage badge & narration count -->
          <div class="flex items-center gap-3 mt-2">
            <div
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                getCoverageDisplay(match.coverageTier).colorClass
              ]"
            >
              <Icon :icon="getCoverageDisplay(match.coverageTier).icon" width="14" />
              <span>{{ getCoverageDisplay(match.coverageTier).label }}</span>
            </div>
            
            <div class="text-xs text-white/60">
              <div>{{ getNarrationProgress(match.narrationCount).main }}</div>
              <div v-if="getNarrationProgress(match.narrationCount).helper" class="text-white/40 text-[11px]">
                {{ getNarrationProgress(match.narrationCount).helper }}
              </div>
            </div>

            <!-- Large gap warning -->
            <div v-if="match.hasLargeGap" class="flex items-center gap-1 text-xs text-orange-400" title="Contains gaps larger than 8 minutes">
              <Icon icon="carbon:warning" width="14" />
              <span>Large gaps</span>
            </div>
          </div>
        </div>

        <!-- Arrow icon -->
        <div class="flex-shrink-0 flex items-center text-white/40 group-hover:text-white/70 transition-colors">
          <Icon icon="carbon:arrow-right" width="20" />
        </div>
      </button>
    </div>
  </section>
</template>
