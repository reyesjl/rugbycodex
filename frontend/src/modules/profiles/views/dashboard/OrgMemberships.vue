<script setup lang="ts">
import { computed } from 'vue';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import AnimatedLink from '@/components/AnimatedLink.vue';
import { ROLE_ORDER } from '@/modules/profiles/types';

const profileStore = useProfileStore();
const prioritizedMemberships = computed(() => {
  return [...profileStore.memberships].sort((a, b) => {
    const aOrder = ROLE_ORDER[a.org_role] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = ROLE_ORDER[b.org_role] ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
})
</script>

<template>
  <section class="space-y-6">
    <article
      class="rounded-2xl border border-neutral-200 bg-neutral-50/90 p-6 text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <h3 class="text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Memberships
      </h3>
      <div v-if="profileStore.memberships.length === 0" class="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        You are not a member of any organizations.
      </div>
      <div v-else class="max-h-[80vh] overflow-y-auto">
        <div v-for="m in prioritizedMemberships" :key="m.org_id"
          class="flex flex-col border-b border-neutral-200 py-4 dark:border-neutral-800">
          <!-- Row: Left = org link, Right = role + join date -->
          <div class="flex items-center justify-between">
            <AnimatedLink :to="`/organizations/${m.slug}`" :text="m.org_name" class="text-base font-medium"
              @click.stop />

            <div class="flex overflow-auto items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span class="font-medium capitalize text-neutral-800 dark:text-neutral-200">
                {{ m.org_role }}
              </span>
              <span>
                {{ new Date(m.join_date).toLocaleDateString() }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>
