<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

// Placeholder - will be implemented with actual assignment data later
const assignments = ref([]);
const loading = ref(false);
const error = ref<string | null>(null);
</script>

<template>
  <section class="container-lg text-white py-20">
    <div class="text-2xl font-semibold mb-4">Your assignments</div>
    
    <!-- Loading state -->
    <div v-if="loading" class="text-sm text-white/60">
      Loading assignments...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <!-- Empty state / Placeholder -->
    <div v-else class="text-xs text-white/40">
      <p>This section will display assignments you've created for your teams.</p>
      <p class="mt-2">Coming soon: Track assignment completion rates and manage team learning objectives.</p>
    </div>

    <!-- Future: Assignments list will go here -->
    <!-- 
    <div v-else class="space-y-3">
      <div v-for="assignment in assignments" :key="assignment.id">
        Assignment item from manager perspective
      </div>
    </div>
    -->
  </section>
</template>
