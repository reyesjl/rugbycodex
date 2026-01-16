<script setup lang="ts">
type ActivityItem = {
  id: string;
  title: string;
  meta?: string;
};

defineProps<{
  narrations: ActivityItem[];
  mediaUploads: ActivityItem[];
  assignments: ActivityItem[];
  isLoading?: boolean;
}>();
</script>

<template>
  <section class="rounded-xl border border-white/10 bg-black/40 p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Recent Activity</h2>
      <div class="text-[11px] text-white/40">Last 5 signals by type</div>
    </div>

    <div v-if="isLoading" class="mt-4 text-sm text-white/50">Loading activity feed...</div>

    <div v-else class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="space-y-3">
        <div class="text-[11px] uppercase tracking-[0.2em] text-white/40">Narrations</div>
        <div v-if="narrations.length" class="space-y-2">
          <div
            v-for="item in narrations"
            :key="item.id"
            class="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div class="text-sm text-white">{{ item.title }}</div>
            <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
          </div>
        </div>
        <p v-else class="text-xs text-white/40">No narrations recorded yet.</p>
      </div>

      <div class="space-y-3">
        <div class="text-[11px] uppercase tracking-[0.2em] text-white/40">Media Uploads</div>
        <div v-if="mediaUploads.length" class="space-y-2">
          <div
            v-for="item in mediaUploads"
            :key="item.id"
            class="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div class="text-sm text-white">{{ item.title }}</div>
            <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
          </div>
        </div>
        <p v-else class="text-xs text-white/40">No uploads logged yet.</p>
      </div>

      <div class="space-y-3">
        <div class="text-[11px] uppercase tracking-[0.2em] text-white/40">Assignments</div>
        <div v-if="assignments.length" class="space-y-2">
          <div
            v-for="item in assignments"
            :key="item.id"
            class="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div class="text-sm text-white">{{ item.title }}</div>
            <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
          </div>
        </div>
        <p v-else class="text-xs text-white/40">No assignments created yet.</p>
      </div>
    </div>
  </section>
</template>
