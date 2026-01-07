<script lang="ts" setup>
import { ref } from 'vue';

const emit = defineEmits<{
  close: [];
  submit: [payload: { username: string; role: 'member' | 'staff' | 'manager' | 'owner' }];
}>();

const username = ref('');
const role = ref<'member' | 'staff' | 'manager' | 'owner'>('member');
const error = ref<string | null>(null);

const submit = () => {
  if (!username.value.trim()) {
    error.value = "Please enter a username.";
    return;
  }

  error.value = null;
  emit('submit', { username: username.value.trim(), role: role.value });
};
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="emit('close')"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
        <!-- Header -->
        <header class="p-4 border-b border-b-white/20">
          <h2>Add member</h2>
          <p class="text-sm text-gray-400">Add a new member to your organization.</p>
        </header>

        <!-- Input section -->
        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="username">Username</label>
            </div>
            <div class="col-span-8">
              <input
                id="username"
                v-model="username"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="role">Role</label>
            </div>
            <div class="col-span-8">
              <select
                id="role"
                v-model="role"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              >
                <option value="member">member</option>
                <option value="staff">staff</option>
                <option value="manager">manager</option>
                <option value="owner">owner</option>
              </select>
            </div>
          </div>

          <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
        </div>

        <div class="flex justify-between p-4 border-t border-t-white/20">
          <!-- Submit and cancel buttons -->
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
            Add
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped></style>
