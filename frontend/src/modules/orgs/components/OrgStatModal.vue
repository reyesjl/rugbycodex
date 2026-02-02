<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

type StatType = 'matches' | 'coverage' | 'learning' | 'attention' | 'identity';

interface Props {
  statType: StatType;
  isOpen: boolean;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const statContent = {
  matches: {
    title: 'Matches (Last 30 Days)',
    icon: 'carbon:video',
    description: 'Track your recent upload activity',
    explanation: `This metric shows how many match videos have been uploaded to your organization in the last 30 days.`,
    whatItMeans: [
      'Higher numbers indicate active content creation',
      'Consistent uploads help maintain coaching momentum',
      'A drop might signal you need to upload recent matches'
    ],
    actionable: 'Aim to upload matches within 24-48 hours after games for timely feedback.'
  },
  coverage: {
    title: 'Coverage (Reviewed)',
    icon: 'carbon:analytics',
    description: 'Measure how thoroughly footage has been analyzed',
    explanation: `Shows the ratio of matches with thorough coaching analysis. Coverage is tiered based on narration count and temporal distribution across the match.`,
    whatItMeans: [
      'Not Covered: <25 narrations — needs significant review',
      'Partial: 25-34 narrations — basic coverage, could use more',
      'Well Covered: 35-44 narrations — solid analysis',
      'Very Well Covered: 45+ narrations — excellent depth'
    ],
    actionable: 'Coverage can be downgraded if there are gaps larger than 8 minutes between narrated segments. Aim for even distribution throughout the match, not just key moments.'
  },
  learning: {
    title: 'Learning Activity',
    icon: 'carbon:task',
    description: 'Organizational learning engagement',
    explanation: `Shows the total number of incomplete assignments across your organization. This includes assignments to individual players, groups, and the entire team that haven't been completed yet.`,
    whatItMeans: [
      'Active learning tasks distributed across the team',
      'Higher numbers indicate strong coaching engagement',
      'Zero means everyone is caught up or you need to create assignments',
      'Tracks organizational learning momentum'
    ],
    actionable: 'Keep assignments flowing to maintain consistent player development. Incomplete assignments represent active learning opportunities for your team.'
  },
  attention: {
    title: 'Attention Density',
    icon: 'carbon:microphone',
    description: 'Average coaching feedback per match',
    explanation: `The average number of narrations (coach feedback clips) per match across your entire organization. This measures overall coaching intensity and depth of analysis.`,
    whatItMeans: [
      'Below 25 avg: Matches are under-reviewed, need more attention',
      '25-34 avg: Partial coverage tier, basic feedback provided',
      '35-44 avg: Well covered tier, solid coaching depth',
      '45+ avg: Very well covered tier, excellent analysis'
    ],
    actionable: 'This average includes all matches, even unreviewed ones. Focus on bringing your lowest matches up to at least 25 narrations before adding more to already-covered matches. Even distribution beats depth in a few.'
  },
  identity: {
    title: 'Identity Coverage',
    icon: 'carbon:user-avatar',
    description: 'Player self-identification engagement',
    explanation: `Counts unique video segments where players have tagged themselves using "That\'s me". This shows player engagement with the footage.`,
    whatItMeans: [
      'Higher numbers show active player involvement',
      'Players owning their moments leads to better learning',
      'Low numbers suggest players aren\'t reviewing their clips'
    ],
    actionable: 'Encourage players to tag themselves in clips to build self-awareness and accountability.'
  }
};

const content = computed(() => statContent[props.statType]);

const handleClose = () => {
  emit('close');
};

const handleBackdropClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose();
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 p-4 overflow-y-auto pt-20 sm:pt-4"
        @click="handleBackdropClick"
      >
        <div
          class="relative w-full max-w-lg rounded-lg border border-white/10 bg-gradient-to-b from-gray-900 to-black p-6 shadow-2xl my-8"
          @click.stop
        >
          <!-- Close button -->
          <button
            @click="handleClose"
            class="absolute right-4 top-4 rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <Icon icon="carbon:close" class="h-5 w-5" />
          </button>

          <!-- Header -->
          <div class="mb-6 flex items-start gap-3">
            <div class="rounded-lg bg-white/10 p-3">
              <Icon :icon="content.icon" class="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 class="text-2xl font-semibold text-white">{{ content.title }}</h2>
              <p class="mt-1 text-sm text-white/60">{{ content.description }}</p>
            </div>
          </div>

          <!-- Content -->
          <div class="space-y-4">
            <!-- Explanation -->
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                What This Measures
              </h3>
              <p class="text-sm leading-relaxed text-white/80">
                {{ content.explanation }}
              </p>
            </div>

            <!-- What it means -->
            <div>
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                What It Means for Your Org
              </h3>
              <ul class="space-y-2">
                <li
                  v-for="(point, index) in content.whatItMeans"
                  :key="index"
                  class="flex items-start gap-2 text-sm text-white/80"
                >
                  <Icon icon="carbon:checkmark" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  <span>{{ point }}</span>
                </li>
              </ul>
            </div>

            <!-- Actionable insight -->
            <div class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <div class="mb-1 flex items-center gap-2">
                <Icon icon="carbon:idea" class="h-4 w-4 text-blue-400" />
                <h3 class="text-xs font-semibold uppercase tracking-wider text-blue-300">
                  Pro Tip
                </h3>
              </div>
              <p class="text-sm leading-relaxed text-blue-100">
                {{ content.actionable }}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="mt-6 flex justify-end">
            <button
              @click="handleClose"
              class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
