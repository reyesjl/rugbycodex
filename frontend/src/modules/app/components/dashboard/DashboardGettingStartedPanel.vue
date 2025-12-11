<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';

const props = defineProps<{ profileName: string }>();

const steps = [
  {
    title: 'Create an organization',
    description: 'Claim your club name, drop in branding, and invite collaborators.',
    icon: 'carbon:add',
    to: '/v2/organizations',
  },
  {
    title: 'Upload first media',
    description: 'Send us a match file or training capture and we will transcode it for tagging.',
    icon: 'carbon:cloud-upload',
    to: '/v2/media',
  },
  {
    title: 'Invite your staff',
    description: 'Analysts, players, and coaches can all share notes once inside an org.',
    icon: 'carbon:user-follow',
    to: '/v2/organizations',
  },
];
</script>

<template>
  <section class="space-y-8 text-white">
    <div class="rounded border border-blue-400/40 bg-blue-500/10 p-6">
      <p class="text-xs uppercase tracking-wide text-blue-200/70">Welcome, {{ props.profileName || 'friend' }}</p>
      <p class="mt-3 text-2xl font-semibold">Let’s stand up your rugby workspace</p>
      <p class="mt-2 text-sm text-white/80">You’re not linked to an organization yet. Start with the checklist below or ping support for a concierge onboarding.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <RouterLink
        v-for="step in steps"
        :key="step.title"
        :to="step.to"
        class="rounded border border-white/10 bg-white/5 p-4 text-white hover:border-white/40"
      >
        <div class="rounded-full border border-white/20 p-2">
          <Icon :icon="step.icon" width="22" height="22" />
        </div>
        <p class="mt-3 text-lg font-semibold">{{ step.title }}</p>
        <p class="text-sm text-white/70">{{ step.description }}</p>
      </RouterLink>
    </div>

    <div class="rounded border border-white/10 bg-black/30 p-5 text-sm text-white/70">
      Need help provisioning your org? Email <a href="mailto:contact@biasware.com" class="text-white underline">contact@biasware.com</a> and we’ll carve a launch path with you.
    </div>
  </section>
</template>
