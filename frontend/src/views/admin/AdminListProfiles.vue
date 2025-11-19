<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { useProfilesList } from '@/profiles/composables/useProfileList';

const expandedProfiles = ref<Set<string>>(new Set());
const searchQuery = ref('');

const toggleExpand = (profileId: string) => {
  if (expandedProfiles.value.has(profileId)) {
    expandedProfiles.value.delete(profileId);
  } else {
    expandedProfiles.value.add(profileId);
  }
};

const isExpanded = (profileId: string) => expandedProfiles.value.has(profileId);

const hasExpandedProfiles = () => expandedProfiles.value.size > 0;

const collapseAll = () => {
  expandedProfiles.value.clear();
};

const profileList = useProfilesList();

const handleRefresh = async () => {
  await profileList.loadProfiles();
};

const filteredProfiles = computed(() => {
  let result = [...profileList.profiles.value];
  
  // Filter if search query exists
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(profile => 
      profile.name.toLowerCase().includes(query)
    );
  }
  
  return result;
});

onMounted(async () => {
  await profileList.loadProfiles();
});

</script>

<template>
  <section class="space-y-6">
    <section
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Profiles</h2>
        <div class="flex items-center gap-2">
          <button
            v-if="hasExpandedProfiles()"
            type="button"
            @click="collapseAll"
            class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
            title="Collapse all"
          >
            <Icon icon="mdi:unfold-less-horizontal" class="h-5 w-5" />
          </button>
          <RefreshButton
            :refresh="handleRefresh"
            :loading="profileList.loading.value"
            title="Refresh profiles"
          />
        </div>
      </div>

      <div class="mt-6">
        <div class="relative">
          <Icon icon="mdi:magnify" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by profile name..."
            class="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-12 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20"
          />
        </div>
      </div>

      <div v-if="filteredProfiles.length === 0 && !profileList.loading.value && !profileList.error.value" class="mt-4">
        <p class="text-neutral-600 dark:text-neutral-400">
          {{ searchQuery ? 'No profiles match your search.' : 'No profiles found.' }}
        </p>
      </div>
      <div v-else-if="profileList.error.value" class="mt-4">
        <p class="text-sm text-rose-500 dark:text-rose-400">Error: {{ profileList.error.value }}</p>
      </div>
      <div v-else class="scrolling-list mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        <TransitionGroup name="profile-list" tag="div" class="space-y-4">
          <div
            v-for="profile in filteredProfiles"
            :key="profile.id"
            class="overflow-hidden rounded-lg border border-neutral-200/60 bg-white/80 transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_12px_40px_rgba(15,23,42,0.35)]"
          >
            <div
              @click="toggleExpand(profile.id)"
              class="flex cursor-pointer items-center justify-between px-3 py-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
            >
              <div class="flex-1">
                <RouterLink
                  :to="`/admin/profiles/${profile.id}`"
                  @click.stop
                  class="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                >
                  {{ profile.name }}
                </RouterLink>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click.stop="toggleExpand(profile.id)"
                  class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :title="isExpanded(profile.id) ? 'Collapse' : 'Expand'"
                >
                  <Icon :icon="isExpanded(profile.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              class="grid transition-all duration-300 ease-in-out"
              :class="isExpanded(profile.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
            >
              <div class="overflow-hidden">
                <div class="space-y-2 border-t border-neutral-200/60 px-3 pb-3 pt-3 dark:border-neutral-800/70">
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">ID: {{ profile.id }}</p>
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">Role: {{ profile.role }}</p>
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">XP: {{ profile.xp ?? 'N/A' }}</p>
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    Created: {{ profile.creation_time.toLocaleString() }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </section>
  </section>
</template>

<style scoped>
/* TransitionGroup animation for profile deletion */
.profile-list-move,
.profile-list-enter-active,
.profile-list-leave-active {
  transition: all 0.5s ease;
}

.profile-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.profile-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.profile-list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
