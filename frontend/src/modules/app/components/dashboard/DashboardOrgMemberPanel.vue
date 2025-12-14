<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { OrgMembership } from '@/modules/profiles/types';

type OrgLinks = {
  overview: string;
  media: string;
  members: string;
  settings: string;
};

const props = defineProps<{
  profileName: string;
  membership: OrgMembership | null;
  orgLinks: OrgLinks | null;
}>();

const orgName = computed(() => props.membership?.org_name ?? 'your team');
const roleLabel = computed(() => props.membership?.org_role ?? 'member');

const quickLinks = computed(() => {
  if (!props.orgLinks) {
    return [] as Array<{ label: string; to: string; icon: string; description: string }>;
  }
  return [
    { label: 'Overview', to: props.orgLinks.overview, icon: 'carbon:dashboard', description: 'Daily context + assignments' },
    { label: 'Media', to: props.orgLinks.media, icon: 'carbon:image', description: 'Footage shared with your squad' },
    { label: 'Narrations', to: props.orgLinks.media.replace('/media', '/narrations'), icon: 'carbon:microphone', description: 'Record or review commentary' },
  ];
});
</script>

<template>
  <article class="rounded border border-white/15 bg-black/40 p-6">
    <p class="text-xs uppercase tracking-wide text-white/50">
      What coaches are seeing
    </p>

  <ul class="mt-4 space-y-3 text-sm">
    <li class="text-white">
      Arriving late to the breakdown
    </li>
    <li class="text-white">
      Strong scan before contact
    </li>
    <li class="text-white">
      Tackle height drops in final 20mins
    </li>
  </ul>

  <p class="mt-4 text-xs text-white/50">
    Based on recent review and narration
  </p>
</article>

  <section class="space-y-8 text-white">
    <div class="rounded border border-white/15 bg-white/5 p-6">
      <p class="text-xs uppercase tracking-wide text-white/50">You're contributing as</p>
      <div class="mt-3 text-2xl font-semibold">
        {{ roleLabel }} · {{ orgName }}
      </div>
      <p class="mt-2 text-sm text-white/70">All of your drills, vaults, and narrations funnel through this org. Jump back in below.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <RouterLink
        v-for="link in quickLinks"
        :key="link.label"
        :to="link.to"
        class="rounded border border-white/10 bg-black/30 p-4 hover:border-white/40"
      >
        <div class="flex items-center gap-3">
          <div class="rounded-full border border-white/20 p-2">
            <Icon :icon="link.icon" width="20" height="20" />
          </div>
          <div>
            <p class="font-semibold">{{ link.label }}</p>
            <p class="text-sm text-white/65">{{ link.description }}</p>
          </div>
        </div>
      </RouterLink>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <article class="rounded border border-white/10 bg-black/30 p-4">
        <p class="text-sm font-semibold text-white/80">Assignments</p>
        <ul class="mt-4 space-y-3 text-sm text-white/70">
          <li>Tag the first half of Exiles U18 scrimmage.</li>
          <li>Upload GPS report for Thursday training.</li>
          <li>Prep narration for Women’s 7s final.</li>
        </ul>
      </article>
      <article class="rounded border border-white/10 bg-black/30 p-4">
        <p class="text-sm font-semibold text-white/80">Latest activity</p>
        <ul class="mt-4 space-y-3 text-sm text-white/70">
          <li>Stormers shared “Counterattack Library”.</li>
          <li>Mia added you to “speed sequences” playlist.</li>
          <li>2 new comments on your clip breakdown.</li>
        </ul>
      </article>
    </div>
  </section>
</template>
