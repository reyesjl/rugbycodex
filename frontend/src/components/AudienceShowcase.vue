<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Container from '@/components/Container.vue';
import Section from '@/components/Section.vue';
import Button from '@/components/Button.vue';
import Accordion from '@/components/Accordion.vue';
import playerImage from '@/assets/ilona-maher.jpg';
import coachImage from '@/assets/eddie-jones.jpg';
import analystImage from '@/assets/analyst.jpg';
import unionImage from '@/assets/union.jpg';
import fansImage from '@/assets/fans.jpg';

// Define the audiences and their content
const audiences = [
  {
    name: 'Player',
    image: playerImage,
    intro: 'See your game the way a coach sees it.',
    points: [
      {
        title: 'Understand every decision',
        description: 'RugbyCodex breaks down each clip so you can review the cues behind your choices.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-emerald-500 dark:text-emerald-400'
      },
      {
        title: 'Measure your impact over time',
        description: 'Track how your contributions stack up match after match with clear metrics and benchmarks.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-emerald-500 dark:text-emerald-400'
      },
      {
        title: 'Train with targeted clips',
        description: 'Receive personalized film and training sequences focused on the next skill you need to sharpen.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-emerald-500 dark:text-emerald-400'
      }
    ]
  },
  {
    name: 'Coach',
    image: coachImage,
    intro: 'Turn film sessions into real teaching moments.',
    points: [
      {
        title: 'Organize film by skill and situation',
        description: 'Every play is tagged by player, phase, and scenario so your staff finds what matters fast.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-blue-500 dark:text-blue-400'
      },
      {
        title: 'Tell the story of each match',
        description: 'Build playlists that connect phases into the narrative you want the team to carry forward.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-blue-500 dark:text-blue-400'
      },
      {
        title: 'Capture your staff\'s voice',
        description: 'Narrations and shared vocabulary stay consistent across every review and scouting session.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-blue-500 dark:text-blue-400'
      }
    ]
  },
  {
    name: 'Analyst',
    image: analystImage,
    intro: 'Spend less time tagging and more time finding answers.',
    points: [
      {
        title: 'Automate structure and tagging',
        description: 'Every phase of play is sorted and labeled, delivering ready-to-use breakdowns immediately.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-sky-500 dark:text-sky-400'
      },
      {
        title: 'Export clean data instantly',
        description: 'Pull aligned video and metrics into the formats you need for presentations or reports.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-sky-500 dark:text-sky-400'
      },
      {
        title: 'Standardize narration and context',
        description: 'Voice notes and guidelines keep analysts and coaches speaking the same rugby language.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-sky-500 dark:text-sky-400'
      }
    ]
  },
  {
    name: 'Union',
    image: unionImage,
    intro: 'Create a single source of rugby truth across your programs.',
    points: [
      {
        title: 'Unify video, language, and performance data',
        description: 'RugbyCodex brings every dataset together so national staff share a common perspective.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-violet-500 dark:text-violet-400'
      },
      {
        title: 'Spot development trends across clubs',
        description: 'Track how philosophies and skills evolve across academies, regions, and national squads.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-violet-500 dark:text-violet-400'
      },
      {
        title: 'Monitor player progress in one view',
        description: 'Follow athletes from youth to senior levels with a clear, connected performance record.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-violet-500 dark:text-violet-400'
      }
    ]
  },
  {
    name: 'Fan',
    image: fansImage,
    intro: 'Watch the game with new eyes.',
    points: [
      {
        title: 'Replay defining moments with analysis',
        description: 'Review key clips with guided commentary that explains decisions and movement.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-amber-500 dark:text-amber-400'
      },
      {
        title: 'Explore data-backed storytelling',
        description: 'Dive into visuals and stats that decode how each play takes shape on the pitch.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-amber-500 dark:text-amber-400'
      },
      {
        title: 'Learn the game faster',
        description: 'Understand rugby fundamentals through curated sequences built for curious supporters.',
        icon: 'carbon:checkmark-outline',
        iconClass: 'text-amber-500 dark:text-amber-400'
      }
    ]
  }
];

const selectedAudience = ref(0);

const selectAudience = (index: number) => {
  selectedAudience.value = index;
};

// Preload all images on component mount
onMounted(() => {
  audiences.forEach(audience => {
    const img = new Image();
    img.src = audience.image;
  });
});
</script>

<template>
  <Section :variant="'dark'" padding="py-16 md:py-24">
    <Container class="flex flex-col items-center max-w-6xl">
      <p class="mb-3 text-xs text-center tracking-widest font-semibold text-white/60 dark:text-black/60">
        Our Community
      </p>
      <h2 class="text-3xl md:text-4xl font-semibold text-center text-white dark:text-black">
        Every Role. One Understanding.
      </h2>
      <p class="mt-4 max-w-3xltext-base text-center leading-relaxed text-white/80 dark:text-black/80">
        Choose a role to see what RugbyCodex delivers.
      </p>

      <!-- Audience selector buttons -->
      <div class="mt-8 w-full overflow-x-auto scrollbar-hide">
        <div class="flex flex-row gap-1 md:gap-2 items-center min-w-max px-4 mx-auto justify-center md:justify-center snap-x snap-mandatory">
          <template v-for="(audience, index) in audiences" :key="audience.name">
            <Button
              @click="selectAudience(index)"
              :variant="selectedAudience === index ? 'selected' : 'default'"
              size="sm"
              class="snap-center flex-shrink-0"
            >
              {{ audience.name }}
            </Button>
            <span v-if="index < audiences.length - 1" class="text-neutral-400 dark:text-neutral-500 flex-shrink-0">|</span>
          </template>
        </div>
      </div>

      <div class="mt-12 w-full md:w-4/5 mx-auto flex flex-col md:flex-row gap-8 md:gap-12 items-center">
        <!-- Audience image -->
        <div class="flex w-full justify-center md:justify-start md:w-auto flex-shrink-0">
          <div class="w-full max-w-xs md:max-w-sm aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-sm overflow-hidden relative">
            <img
              :src="audiences[selectedAudience]?.image"
              :alt="`${audiences[selectedAudience]?.name} Image`"
              class="w-full h-full object-cover transition-opacity duration-250 ease-out"
              loading="lazy"
            />
          </div>
        </div>

        <!-- Content display -->
        <div
          class="w-full md:flex-1 text-left justify-between"
          :key="`content-${audiences[selectedAudience]?.name}`"
        >
          <h2 class="text-2xl font-semibold text-white dark:text-black">
            For the {{ audiences[selectedAudience]?.name }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-white/80 dark:text-black/80">
            {{ audiences[selectedAudience]?.intro }}
          </p>
          <div class="mt-6 min-h-[300px] flex flex-col">
            <Accordion
              v-if="audiences[selectedAudience]?.points"
              :items="audiences[selectedAudience]?.points ?? []"
              :default-open="0"
            />
          </div>
        </div>
      </div>
    </Container>
  </Section>
</template>
