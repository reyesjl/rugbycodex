<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';

type Release = {
  version: string;
  codename: string;
  date: string;
  summary: string;
  highlights: string[];
};

type RoadmapItem = {
  title: string;
  description: string;
};

const releases: Release[] = [
  {
    version: '1.2.0',
    codename: 'Narrations Spotlight',
    date: 'November 03, 2025',
    summary:
      'Narrations move to the front of the experience. This release introduces curated voice examples across the platform, showcasing how commentary, player reflection, and coach previews can bring match footage to life before users begin submitting their own takes.',
    highlights: [
      'Added a dedicated narration demo that lets visitors play real match examples and reveal aligned transcripts without recording their own audio.',
      'Surfaced the same preset narration selector inside user dashboards so coaching staff can explore broadcast, player, and coach perspectives in context.',
      'Curated authentic clips from recent fixtures to ground each preset in believable match moments and set quality expectations for future submissions.',
      'Prepared the workflow that will soon allow teams to layer their own narrations onto vault clips once collaboration opens.'
    ]
  },
  {
    version: '1.1.0',
    codename: 'Closed Beta Prep',
    date: 'October 31, 2025',
    summary:
      'This release prepared Rugbycodex for its first trusted users. It focused on strengthening security and building the narration workflow so coaches, analysts, and union staff could begin contributing confidently. The goal was to make the platform ready for collaboration while protecting the integrity of every voice.',
    highlights: [
      'Created secure private user accounts with approval gates for verified coaches and analysts.',
      'Integrated early narration tools with backend services to allow users to record or upload voice directly onto clips.',
      'Designed the initial onboarding flow for teams and players to start organizing their footage and contributions during the closed beta.'
    ]
  },
  {
    version: '1.0.0',
    codename: 'Experience Framework',
    date: 'September 21, 2025',
    summary:
      'This version turned Rugbycodex from a technical demo into a living platform. The public site introduced clear storytelling, visual rhythm, and a unified design that explained narrations, threads, and vaults to players and coaches.',
    highlights: [
      'Launched the live landing page, navigation, and hero visuals that communicate the purpose of Rugbycodex.',
      'Built a consistent typography and layout framework to keep future pages visually unified.',
      'Added full support for light and dark themes to enhance usability across environments.',
      'Prepared the user interface for live data and future user interactions.'
    ]
  },
  {
    version: '0.1.0',
    codename: 'Local Prototype',
    date: 'August 14, 2025',
    summary:
      'This was the very beginning of Rugbycodex, created as a local test to prove that film, context, and artificial intelligence could work together. The prototype ran entirely on a single computer and showed that coaches could use natural language to interact with footage.',
    highlights: [
      'Developed the first working pipeline that processed video clips locally from upload to transcription and summary.',
      'Created an early sequence builder that produced highlight reels using text based prompts.',
      'Explored how coaches could tag and analyze clips without manually scrubbing through entire matches.',
      'Validated processing speed and transcription accuracy before building any public facing interface.'
    ]
  }
];


const milestones: RoadmapItem[] = [
  {
    title: 'Narrator Profiles & Reputation',
    description:
      'Surface expertise by letting coaches and analysts build trust signals around their narrations, with badges tied to union and club history.'
  },
  {
    title: 'Vault Access Controls',
    description:
      'Granular roles for admins, coaches, and players to protect sensitive insights while keeping learning pathways open.'
  },
  {
    title: 'Pattern Discovery Engine',
    description:
      'Automated clustering of narrations and clips to highlight emerging tactical trends across regions and competitions.'
  }
];

const focusAreas: RoadmapItem[] = [
  {
    title: 'Experience Design',
    description:
      'Continue polishing the interface so the platform feels conversational and human, especially on mobile devices for eventual use on training grounds.'
  },
  {
    title: 'Club Onboarding',
    description:
      'Enable clubs to bring in their existing footage libraries seamlessly, with upload tools that adapt to different formats and tagging habits.'
  },
  {
    title: 'Insights Delivery',
    description:
      'Personalized weekly briefs that package vault activity, key narrations, and program-level learnings for coaching staff.'
  }
];

const sliderRef = ref<HTMLElement | null>(null);
const activeReleaseIndex = ref(0);
const edgePadding = ref(24);
let scrollAnimationFrame: number | null = null;

const releaseCardSelector = '[data-release-card="true"]';

const getReleaseCards = (): HTMLElement[] => {
  const container = sliderRef.value;
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(releaseCardSelector));
};

const updateActiveIndexFromScroll = () => {
  const container = sliderRef.value;
  if (!container) {
    return;
  }

  const cards = getReleaseCards();
  if (!cards.length) {
    return;
  }

  const containerCenter = container.scrollLeft + container.clientWidth / 2;

  let closestIndex = activeReleaseIndex.value;
  let smallestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - containerCenter);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });

  activeReleaseIndex.value = closestIndex;
};

const handleScroll = () => {
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame);
  }

  scrollAnimationFrame = requestAnimationFrame(() => {
    updateActiveIndexFromScroll();
    scrollAnimationFrame = null;
  });
};

const scrollToIndex = (index: number, options: { smooth?: boolean } = { smooth: true }) => {
  const clampedIndex = Math.max(0, Math.min(releases.length - 1, index));
  const container = sliderRef.value;

  if (!container) {
    activeReleaseIndex.value = clampedIndex;
    return clampedIndex;
  }

  const cards = getReleaseCards();
  if (!cards.length) {
    activeReleaseIndex.value = clampedIndex;
    return clampedIndex;
  }

  const target = cards[Math.min(clampedIndex, cards.length - 1)];

  if (target) {
    const preferredOffset =
      target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = Math.max(0, Math.min(maxScroll, preferredOffset));

    container.scrollTo({
      left: nextScrollLeft,
      behavior: !options.smooth ? 'auto' : 'smooth'
    });
  }

  activeReleaseIndex.value = clampedIndex;
  return clampedIndex;
};

const updateEdgePadding = async () => {
  const container = sliderRef.value;
  if (!container) {
    return;
  }

  const cards = getReleaseCards();
  const firstCard = cards[0];
  if (!firstCard) {
    return;
  }

  const viewportWidth = container.clientWidth;
  const cardWidth = firstCard.offsetWidth;
  const baseSpacing =
    typeof window === 'undefined'
      ? 24
      : window.innerWidth >= 1280
        ? 64
        : window.innerWidth >= 768
          ? 48
          : 24;
  const computedPadding = Math.max((viewportWidth - cardWidth) / 2, baseSpacing);

  edgePadding.value = Number.isFinite(computedPadding) ? computedPadding : baseSpacing;

  await nextTick();
  scrollToIndex(activeReleaseIndex.value, { smooth: false });
};

const handleResize = () => {
  void updateEdgePadding();
};

const handleArrowClick = (direction: 'prev' | 'next') => {
  const delta = direction === 'prev' ? -1 : 1;
  scrollToIndex(activeReleaseIndex.value + delta);
};

onMounted(() => {
  const container = sliderRef.value;
  if (container) {
    container.addEventListener('scroll', handleScroll, { passive: true });
  }
  window.addEventListener('resize', handleResize);
  void updateEdgePadding();
});

onBeforeUnmount(() => {
  const container = sliderRef.value;
  if (container) {
    container.removeEventListener('scroll', handleScroll);
  }
  window.removeEventListener('resize', handleResize);

  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame);
  }
});
</script>

<template>
  <section class="hero container flex flex-col justify-center items-center min-h-screen">
    <div class="mt-auto text-5xl md:text-8xl text-indigo-600 dark:text-indigo-300">Releases</div>
    <p class="text-xs text-neutral-500">Scroll to bottom for milestones & focus areas.</p>
    <p class="mb-auto text-center text-xl md:text-2xl mt-20 text-neutral-600 dark:text-neutral-300">
      Transparent snapshots of how Rugbycodex is evolving. Each release captures the capabilities live today, the
      lessons learned with clubs, and the next problems we are focused on.
    </p>
  </section>

  <section class="relative w-full pb-32">

    <div class="container">
      <div class="flex justify-end gap-3 px-6 md:px-12 pb-4">
        <button type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 text-neutral-600 dark:text-neutral-200 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="View previous release" aria-controls="release-slider" @click="handleArrowClick('prev')"
          :disabled="activeReleaseIndex === 0">
          <Icon icon="carbon:chevron-left" class="h-5 w-5" />
        </button>
        <button type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 text-neutral-600 dark:text-neutral-200 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="View next release" aria-controls="release-slider" @click="handleArrowClick('next')"
          :disabled="activeReleaseIndex === releases.length - 1">
          <Icon icon="carbon:chevron-right" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <div id="release-slider" ref="sliderRef"
      class="no-scrollbar scroll-smooth snap-x snap-mandatory flex gap-6 overflow-x-auto">
      <div aria-hidden="true" class="shrink-0" :style="{ width: `${edgePadding}px`, flexBasis: `${edgePadding}px` }">
      </div>
      <div v-for="(release, index) in releases" :key="release.version" data-release-card="true"
        class="release-card flex flex-col shrink-0 snap-center snap-always w-[min(90vw,38rem)] md:w-[min(75vw,48rem)] lg:w-[min(60vw,54rem)] border border-neutral-200 dark:border-neutral-800 rounded-3xl bg-neutral-100 dark:bg-neutral-900">
        <button type="button"
          class="w-full text-left p-8 md:p-12 flex flex-col gap-4 text-neutral-700 dark:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-3xl"
          @click="scrollToIndex(index)">
          <div class="text-3xl md:text-4xl text-neutral-900 dark:text-neutral-100">
            {{ release.version }} - {{ release.codename }}
          </div>
          <div class="flex flex-row justify-between items-center gap-4">
            <div>
              
              <div class="text-neutral-500 dark:text-neutral-500 text-sm md:text-base mt-1 uppercase tracking-wide">
                {{ release.date }}
              </div>
            </div>
            <div class="text-sm uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Slide {{ index + 1 }} / {{ releases.length }}
            </div>
          </div>
        </button>

        <div class="text-sm px-8 pb-8 md:px-12 md:pb-12 space-y-8 text-neutral-700 dark:text-neutral-200">
          <p class="text-neutral-600 dark:text-neutral-400 md:max-w-3xl">
            {{ release.summary }}
          </p>
          <ul class="space-y-4">
            <li v-for="highlight in release.highlights" :key="highlight" class="flex items-start gap-3">
              <span class="mt-2 inline-block shrink-0 h-2 w-2 rounded-full bg-amber-500"></span>
              <span>{{ highlight }}</span>
            </li>
          </ul>
        </div>
      </div>
      <div aria-hidden="true" class="shrink-0" :style="{ width: `${edgePadding}px`, flexBasis: `${edgePadding}px` }">
      </div>
    </div>
  </section>

  <section class="container space-y-12 pb-32">
    <div class="space-y-4 text-neutral-700 dark:text-neutral-100">
      <div class="text-4xl md:text-5xl">Milestones</div>
      <p class="text-neutral-600 dark:text-neutral-400 md:text-lg">
        These initiatives are in active development with partner clubs and unions. They focus on trust, access, and
        making sure Rugbycodex reflects the culture of the people who use it.
      </p>
    </div>

    <div class="grid gap-8 md:grid-cols-3 text-neutral-700 dark:text-neutral-200">
      <div v-for="milestone in milestones" :key="milestone.title"
        class="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-6">
        <h3 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{{ milestone.title }}</h3>
        <p class="mt-4 text-neutral-600 dark:text-neutral-400">{{ milestone.description }}</p>
      </div>
    </div>
  </section>

  <section class="container space-y-12 pb-32">
    <div class="space-y-4 text-neutral-700 dark:text-neutral-100">
      <div class="text-4xl md:text-5xl">Focus Areas</div>
      <p class="text-neutral-600 dark:text-neutral-400 md:text-lg">
        Strategic efforts that guide the product roadmap. These highlight how we balance design, data, and support for
        rugby programs of every size.
      </p>
    </div>

    <div class="grid gap-8 md:grid-cols-3 text-neutral-800 dark:text-neutral-200">
      <div v-for="focus in focusAreas" :key="focus.title"
        class="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-6">
        <h3 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{{ focus.title }}</h3>
        <p class="mt-4 text-neutral-600 dark:text-neutral-400">{{ focus.description }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
