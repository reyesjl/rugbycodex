<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { AssignmentTargetType } from '@/modules/assignments/types';
import type { OrgMember } from '@/modules/orgs/types';
import type { OrgGroup } from '@/modules/groups/types';

const props = withDefaults(defineProps<{
  members: OrgMember[];
  groups: OrgGroup[];
  mode?: 'create' | 'edit';
  initial?: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    targetType?: AssignmentTargetType;
    targetId?: string | null;
  } | null;
}>(), {
  mode: 'create',
  initial: null,
});

const emit = defineEmits<{
  close: [];
  submit: [payload: {
    title: string;
    description: string | null;
    dueAt: string | null;
    targets: Array<{ type: AssignmentTargetType; id?: string | null }>;
  }];
}>();

const title = ref('');
const description = ref('');
const dueAt = ref<string>('');

const targetType = ref<AssignmentTargetType>('team');
const targetUserId = ref<string>('');
const targetGroupId = ref<string>('');

const error = ref<string | null>(null);

const isEdit = computed(() => props.mode === 'edit');

const sortedMembers = computed(() => {
  return [...props.members].sort((a, b) => {
    const an = (a.profile.name ?? a.profile.username ?? '').toLowerCase();
    const bn = (b.profile.name ?? b.profile.username ?? '').toLowerCase();
    return an.localeCompare(bn);
  });
});

const sortedGroups = computed(() => {
  return [...props.groups].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
});

function displayName(m: OrgMember) {
  return m.profile.username || m.profile.name;
}

function setInitialValues() {
  const initial = props.initial;
  title.value = initial?.title ?? '';
  description.value = initial?.description ?? '';
  dueAt.value = initial?.dueAt ? new Date(initial.dueAt).toISOString().slice(0, 10) : '';
  targetType.value = initial?.targetType ?? 'team';
  targetUserId.value = '';
  targetGroupId.value = '';
  if (initial?.targetType === 'player' && initial.targetId) {
    targetUserId.value = initial.targetId;
  }
  if (initial?.targetType === 'group' && initial.targetId) {
    targetGroupId.value = initial.targetId;
  }
}

function submit() {
  if (!title.value.trim()) {
    error.value = 'Please enter a title.';
    return;
  }

  if (targetType.value === 'player' && !targetUserId.value) {
    error.value = 'Please select a player.';
    return;
  }

  if (targetType.value === 'group' && !targetGroupId.value) {
    error.value = 'Please select a group.';
    return;
  }

  error.value = null;

  const targets: Array<{ type: AssignmentTargetType; id?: string | null }> = [];
  if (targetType.value === 'team') targets.push({ type: 'team' });
  if (targetType.value === 'player') targets.push({ type: 'player', id: targetUserId.value });
  if (targetType.value === 'group') targets.push({ type: 'group', id: targetGroupId.value });

  emit('submit', {
    title: title.value.trim(),
    description: description.value.trim() ? description.value.trim() : null,
    dueAt: dueAt.value ? new Date(dueAt.value).toISOString() : null,
    targets,
  });
}

watch(
  () => props.initial,
  () => {
    setInitialValues();
  },
  { immediate: true }
);
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="emit('close')"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2>{{ isEdit ? 'Edit assignment' : 'Create assignment' }}</h2>
          <p class="text-sm text-gray-400">
            {{ isEdit ? 'Update title, due date, and targets.' : 'Create a new assignment and target players, groups, or the team.' }}
          </p>
        </header>

        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="title">Title</label>
            </div>
            <div class="col-span-8">
              <input
                id="title"
                v-model="title"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="e.g. Breakdown review"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="description">Description</label>
            </div>
            <div class="col-span-8">
              <textarea
                id="description"
                v-model="description"
                rows="3"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="due">Due date</label>
            </div>
            <div class="col-span-8">
              <input
                id="due"
                v-model="dueAt"
                type="date"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="target">Target</label>
            </div>
            <div class="col-span-8 space-y-2">
              <select
                id="target"
                v-model="targetType"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              >
                <option value="team">Team</option>
                <option value="player">Player</option>
                <option value="group">Group</option>
              </select>

              <select
                v-if="targetType === 'player'"
                v-model="targetUserId"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              >
                <option value="" disabled>Select a player</option>
                <option v-for="m in sortedMembers" :key="m.profile.id" :value="m.profile.id">
                  {{ displayName(m) }}
                </option>
              </select>

              <select
                v-if="targetType === 'group'"
                v-model="targetGroupId"
                class="text-sm w-full rounded bg-black border border-white/20 px-2 py-1 focus:border-white outline-none"
              >
                <option value="" disabled>Select a group</option>
                <option v-for="g in sortedGroups" :key="g.id" :value="g.id">
                  {{ g.name }}
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
            {{ isEdit ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
