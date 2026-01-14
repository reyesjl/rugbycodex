<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  close: [];
  submit: [payload: { name: string; description: string | null }];
}>();

const name = ref('');
const description = ref('');
const error = ref<string | null>(null);

function submit() {
  if (!name.value.trim()) {
    error.value = 'Please enter a group name.';
    return;
  }

  error.value = null;
  emit('submit', {
    name: name.value.trim(),
    description: description.value.trim() ? description.value.trim() : null,
  });
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="emit('close')"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2>Create group</h2>
          <p class="text-sm text-gray-400">Create a group to organize players (forwards, backs, etc.).</p>
        </header>

        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="group-name">Name</label>
            </div>
            <div class="col-span-8">
              <input
                id="group-name"
                v-model="name"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="e.g. Forwards"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="group-description">Description</label>
            </div>
            <div class="col-span-8">
              <textarea
                id="group-description"
                v-model="description"
                rows="3"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
        </div>

        <div class="flex justify-between p-4 border-t border-t-white/20">
          <button
            @click="emit('close')"
            class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
          >
            Cancel
          </button>
          <button
            @click="submit"
            class="px-2 py-1 text-xs rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
