<script setup lang="ts">
type OverviewItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
};

defineProps<{
  title: string;
  description?: string;
  assignmentsTitle: string;
  groupsTitle: string;
  assignments: OverviewItem[];
  groups: OverviewItem[];
  isLoading?: boolean;
}>();
</script>

<template>
  <section class="rounded-xl border border-white/10 bg-black/40 p-5">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{{ title }}</h2>
        <p v-if="description" class="mt-1 text-xs text-white/40">{{ description }}</p>
      </div>
    </div>

    <div v-if="isLoading" class="mt-4 text-sm text-white/50">Loading your context...</div>

    <div v-else class="mt-4 grid gap-4 lg:grid-cols-2">
      <div class="space-y-3">
        <div class="text-[11px] uppercase tracking-[0.2em] text-white/40">{{ assignmentsTitle }}</div>
        <div v-if="assignments.length" class="space-y-2">
          <div
            v-for="item in assignments"
            :key="item.id"
            class="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm text-white">{{ item.title }}</div>
              <span v-if="item.status" class="text-[11px] uppercase tracking-[0.2em] text-white/40">
                {{ item.status }}
              </span>
            </div>
            <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
          </div>
        </div>
        <p v-else class="text-xs text-white/40">No assignments in this queue.</p>
      </div>

      <div class="space-y-3">
        <div class="text-[11px] uppercase tracking-[0.2em] text-white/40">{{ groupsTitle }}</div>
        <div v-if="groups.length" class="space-y-2">
          <div
            v-for="item in groups"
            :key="item.id"
            class="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div class="text-sm text-white">{{ item.title }}</div>
            <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
          </div>
        </div>
        <p v-else class="text-xs text-white/40">No groups to surface yet.</p>
      </div>
    </div>
  </section>
</template>
