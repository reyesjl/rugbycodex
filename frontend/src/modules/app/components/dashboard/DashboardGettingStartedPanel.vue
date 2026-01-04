<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';

const profile = useProfileDisplay();

const steps = [
  {
    title: 'Join a team or workspace',
    description: 'Join an existing team or organization with their join code.',
    icon: 'carbon:add-child-node',
    to: '/organizations',
  },
  {
    title: 'Create a workspace',
    description: 'Set up a new workspace for team, club, or personal analysis.',
    icon: 'carbon:intent-request-create',
    to: '/organizations/create',
  },
  {
    title: 'See a real example',
    description: 'Walk through a real example of footage, narration, and tagging.',
    icon: 'carbon:help',
    to: '/organizations',
  },
];
</script>

<template>
  <section class="space-y-8 text-white">
    <div class="text-2xl">Welcome, {{ profile.displayName }}</div>
    <CoachGuide>
      <div class="space-y-1">
        <p class="text-lg font-semibold text-white/90">What do you want to do first?</p>
        <p class="text-sm text-white/70">Pick a place to begin, you can always change this later.</p>
      </div>
    </CoachGuide>

    <div class="grid gap-4 md:grid-cols-3">
      <RouterLink
        v-for="step in steps"
        :key="step.title"
        :to="step.to"
        class="rounded border border-white/10 bg-white/5 p-4 text-white hover:border-white/40"
      >
        <div class="rounded-full border border-white/20 p-2 w-fit">
          <Icon :icon="step.icon" width="22" height="22" />
        </div>
        <p class="mt-3 text-lg font-semibold">{{ step.title }}</p>
        <p class="text-sm text-white/70">{{ step.description }}</p>
      </RouterLink>
    </div>

    <div class="rounded border border-white/10 bg-black/30 p-5 text-sm text-white/70">
      If you're stuck, we are here to help. Email <a href="mailto:contact@biasware.com" class="text-white underline">contact@biasware.com</a>
    </div>
  </section>
</template>
