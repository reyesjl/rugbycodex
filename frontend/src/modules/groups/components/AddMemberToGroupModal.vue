<script setup lang="ts">
import { computed, ref } from 'vue';
import type { OrgMember } from '@/modules/orgs/types';

const props = defineProps<{
  members: OrgMember[];
  groupName: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { userId: string }];
}>();

const selectedUserId = ref<string>('');
const error = ref<string | null>(null);

const sortedMembers = computed(() => {
  return [...props.members].sort((a, b) => {
    const an = (a.profile.name ?? a.profile.username ?? '').toLowerCase();
    const bn = (b.profile.name ?? b.profile.username ?? '').toLowerCase();
    return an.localeCompare(bn);
  });
});

function displayName(m: OrgMember) {
  return m.profile.username || m.profile.name;
}

function submit() {
  if (!selectedUserId.value) {
    error.value = 'Please select a member.';
    return;
  }

  error.value = null;
  emit('submit', { userId: selectedUserId.value });
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
          <h2>Add member</h2>
          <p class="text-sm text-gray-400">Add an organization member to {{ props.groupName }}.</p>
        </header>

        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="member">Member</label>
            </div>
            <div class="col-span-8">
              <select
                id="member"
                v-model="selectedUserId"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              >
                <option value="" disabled>Select a member</option>
                <option v-for="m in sortedMembers" :key="m.profile.id" :value="m.profile.id">
                  {{ displayName(m) }}
                </option>
              </select>
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
            Add
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
