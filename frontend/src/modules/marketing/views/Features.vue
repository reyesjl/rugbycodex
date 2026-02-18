<script setup lang="ts">
import PageHero from '../components/PageHero.vue';
import AudienceCTA from '../components/AudienceCTA.vue';

const featureColumns = [
  {
    title: 'Narrated Match Intelligence',
    body: 'Turn raw game footage into structured narration so teams can search, revisit, and teach tactical moments with shared language.',
  },
  {
    title: 'Searchable Rugby Context',
    body: 'Find exact phases, actions, and patterns across matches in seconds using rugby-specific terminology and consistent event tagging.',
  },
  {
    title: 'Role-Based Workflows',
    body: 'Give coaches, players, and unions tailored views so each audience can review performance with clarity and faster decision-making.',
  },
];
</script>

<template>
  <PageHero
    title-label="Features"
    title-text="Everything you need to turn match footage into rugby intelligence."
  />

  <section class="bg-white px-6 py-20 text-black md:px-8">
    <div class="container-lg grid gap-8 md:grid-cols-3">
      <article
        v-for="feature in featureColumns"
        :key="feature.title"
        class="border border-black/10 p-6"
      >
        <h2 class="text-2xl font-medium">{{ feature.title }}</h2>
        <p class="mt-4 text-sm leading-relaxed text-black/80">{{ feature.body }}</p>
      </article>
    </div>
  </section>

  <AudienceCTA
    headline="See how Rugbycodex fits your program."
    subtext="Join the waitlist and get early access to feature updates."
    primary-label="Join Waitlist"
    primary-to="/auth/waitlist"
    shimmer-primary
    learn-more-label="Contact Us"
    learn-more-to="mailto:contact@biasware.com"
    bg-color="bg-black"
  />
</template>
