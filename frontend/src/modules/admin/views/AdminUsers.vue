<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { useProfilesList } from '@/modules/profiles/composables/useProfileList';

const profileList = useProfilesList();
const searchQuery = ref('');

const handleRefresh = async () => {
  await profileList.loadProfiles();
};

const filteredProfiles = computed(() => {
  let result = [...profileList.profiles.value];
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((profile) => profile.name.toLowerCase().includes(query));
  }
  return result;
});

const formatDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(date);

onMounted(async () => {
  await profileList.loadProfiles();
});
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-wide text-white/60">Admin</p>
        <h1 class="text-3xl font-semibold">Profiles directory</h1>
        <p class="text-white/70">Search, review, and jump into any profile.</p>
      </div>
      <RefreshButton :refresh="handleRefresh" :loading="profileList.loading.value" title="Refresh profiles" />
    </header>

    <div class="relative">
      <Icon icon="mdi:magnify" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by profile name"
        class="w-full rounded border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </div>

    <div v-if="profileList.loading.value" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading profiles…
    </div>

    <div v-else-if="profileList.error.value" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ profileList.error.value }}</p>
      <p class="text-sm text-white/80">Try refreshing or check back later.</p>
    </div>

    <div v-else>
      <ul class="divide-y divide-white/10 rounded border border-white/10">
        <li v-if="filteredProfiles.length === 0" class="py-3 px-4 text-white/60">
          {{ searchQuery ? 'No profiles match your search.' : 'No profiles found yet.' }}
        </li>
        <li
          v-for="profile in filteredProfiles"
          :key="profile.id"
        >
          <RouterLink
            class="group flex items-center justify-between py-3 px-4 transition hover:bg-white hover:text-black"
            :to="`/v2/profile/${profile.id}`"
          >
            <div>
              <p class="font-semibold group-hover:text-black">
                {{ profile.name }}
              </p>
              <p class="text-sm text-white/70 group-hover:text-black/70">
                {{ profile.role }} · XP {{ profile.xp ?? '—' }} · Joined {{ formatDate(profile.creation_time) }}
              </p>
            </div>
            <span class="text-xs uppercase tracking-wide group-hover:text-black">View profile</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

