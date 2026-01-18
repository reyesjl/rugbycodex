<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';

const { displayName, initials, username } = useProfileDisplay();

const greeting = computed(() => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  if (hour >= 12 && hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
});

</script>

<template>
  <section class="space-y-8 text-white">
    <div class="text-4xl flex flex-col">
      <div>{{ greeting }},</div>
      <div class="text-white/60 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <RouterLink
        to="/organizations"
        class="rounded border p-4 text-white md:col-span-3 bg-white/5 border-blue-400/30 hover:border-blue-400/60"
      >
        <div class="rounded-full border border-white/20 p-2 w-fit">
          <Icon icon="carbon:add-child-node" width="22" height="22" />
        </div>
        <p class="mt-3 text-lg font-semibold">Join a team or workspace</p>
        <p class="text-sm text-white/70">Join a team using a join code from your coach or organization.</p>
      </RouterLink>

      <RouterLink
        to="/organizations/create"
        class="rounded border p-4 text-white md:col-span-2 border-red-400/30 bg-white/5 hover:border-red-400/60"
      >
        <div class="rounded-full border border-white/20 p-2 w-fit">
          <Icon icon="carbon:intent-request-create" width="22" height="22" />
        </div>
        <p class="mt-3 text-lg font-semibold">Create a workspace</p>
        <p class="text-sm text-white/70">Set up a new workspace for team, club, or personal analysis.</p>
      </RouterLink>

      <RouterLink to="/organizations" class="rounded border p-4 text-white md:col-span-1 border-yellow-400/30 bg-white/5 hover:border-yellow-400/60">
        <div class="rounded-full border border-white/20 p-2 w-fit">
          <Icon icon="carbon:help" width="22" height="22" />
        </div>
        <p class="mt-3 text-lg font-semibold">See a real example</p>
        <p class="text-sm text-white/70">Walk through a real example of footage, narration, and tagging.</p>
      </RouterLink>
    </div>

    <div class="rounded border border-white/10 bg-black/30 p-5 text-sm text-white/70">
      If you're stuck, we are here to help. Email <a href="mailto:contact@biasware.com" class="text-white underline">contact@biasware.com</a>
    </div>
  </section>
</template>
