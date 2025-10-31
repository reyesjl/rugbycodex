<script setup lang="ts">
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

  <section class="container space-y-16 pb-32">
    <div
      v-for="release in releases"
      :key="release.version"
      class="release-card p-8 md:p-12 rounded-3xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
    >
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-neutral-700 dark:text-neutral-300">
        <div>
          <div class="text-3xl md:text-4xl text-neutral-900 dark:text-neutral-100">
            {{ release.version }} - {{ release.codename }}
          </div>
          <div class="text-neutral-500 dark:text-neutral-500 text-sm md:text-base mt-1 uppercase tracking-wide">
            {{ release.date }}
          </div>
        </div>
        <div class="text-neutral-600 dark:text-neutral-400 md:max-w-lg">
          {{ release.summary }}
        </div>
      </div>

      <ul class="mt-8 space-y-4 text-neutral-700 dark:text-neutral-200">
        <li v-for="highlight in release.highlights" :key="highlight" class="flex items-start gap-3">
          <span class="mt-2 inline-block h-2 w-2 rounded-full bg-amber-500"></span>
          <span>{{ highlight }}</span>
        </li>
      </ul>
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
      <div
        v-for="milestone in milestones"
        :key="milestone.title"
        class="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-6"
      >
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
      <div
        v-for="focus in focusAreas"
        :key="focus.title"
        class="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-6"
      >
        <h3 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{{ focus.title }}</h3>
        <p class="mt-4 text-neutral-600 dark:text-neutral-400">{{ focus.description }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped></style>
