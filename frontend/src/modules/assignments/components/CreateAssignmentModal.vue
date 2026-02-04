<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { AssignmentTargetType } from '@/modules/assignments/types';
import type { OrgMember } from '@/modules/orgs/types';
import type { OrgGroup } from '@/modules/groups/types';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue';

type TargetTypeOption = {
  value: AssignmentTargetType;
  name: string;
};

type PlayerOption = {
  value: string;
  name: string;
  member: OrgMember;
};

type GroupOption = {
  value: string;
  name: string;
  group: OrgGroup;
};

const targetTypeOptions: TargetTypeOption[] = [
  { value: 'team', name: 'Team' },
  { value: 'player', name: 'Player' },
  { value: 'group', name: 'Group' },
];

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

const show = ref(true);
const title = ref('');
const description = ref('');
const dueAt = ref<string>('');

const selectedTargetType = ref<TargetTypeOption>(targetTypeOptions[0]!);
const selectedPlayer = ref<PlayerOption | null>(null);
const selectedGroup = ref<GroupOption | null>(null);

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

const playerOptions = computed<PlayerOption[]>(() => {
  return sortedMembers.value.map(m => ({
    value: m.profile.id,
    name: m.profile.name || m.profile.username || '',
    member: m
  }));
});

const groupOptions = computed<GroupOption[]>(() => {
  return sortedGroups.value.map(g => ({
    value: g.id,
    name: g.name,
    group: g
  }));
});

const handleClose = () => {
  emit('close');
};

function setInitialValues() {
  const initial = props.initial;
  title.value = initial?.title ?? '';
  description.value = initial?.description ?? '';
  dueAt.value = initial?.dueAt ? new Date(initial.dueAt).toISOString().slice(0, 10) : '';
  
  const targetTypeOpt = targetTypeOptions.find(t => t.value === (initial?.targetType ?? 'team')) ?? targetTypeOptions[0]!;
  selectedTargetType.value = targetTypeOpt;
  
  selectedPlayer.value = null;
  selectedGroup.value = null;
  
  if (initial?.targetType === 'player' && initial.targetId) {
    const playerOpt = playerOptions.value.find(p => p.value === initial.targetId);
    if (playerOpt) selectedPlayer.value = playerOpt;
  }
  if (initial?.targetType === 'group' && initial.targetId) {
    const groupOpt = groupOptions.value.find(g => g.value === initial.targetId);
    if (groupOpt) selectedGroup.value = groupOpt;
  }
}

function submit() {
  if (!title.value.trim()) {
    error.value = 'Please enter a title.';
    return;
  }

  if (selectedTargetType.value.value === 'player' && !selectedPlayer.value) {
    error.value = 'Please select a player.';
    return;
  }

  if (selectedTargetType.value.value === 'group' && !selectedGroup.value) {
    error.value = 'Please select a group.';
    return;
  }

  error.value = null;

  const targets: Array<{ type: AssignmentTargetType; id?: string | null }> = [];
  if (selectedTargetType.value.value === 'team') targets.push({ type: 'team' });
  if (selectedTargetType.value.value === 'player') targets.push({ type: 'player', id: selectedPlayer.value?.value });
  if (selectedTargetType.value.value === 'group') targets.push({ type: 'group', id: selectedGroup.value?.value });

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
  <TransitionRoot :show="show">
    <Dialog @close="handleClose" class="relative z-[70]">
      <!-- Backdrop -->
      <TransitionChild
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      </TransitionChild>

      <!-- Dialog container -->
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-xl text-white my-8">
            <header class="p-4 border-b border-b-white/20">
              <DialogTitle as="h2">{{ isEdit ? 'Edit assignment' : 'Create assignment' }}</DialogTitle>
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
                    class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm">Target</label>
                </div>
                <div class="col-span-8 space-y-2">
                  <!-- Target Type Listbox -->
                  <Listbox v-model="selectedTargetType">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 text-left text-sm focus:border-white outline-none">
                        <span class="block truncate">{{ selectedTargetType.name }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in targetTypeOptions"
                            :key="option.value"
                            :value="option"
                            as="template"
                            v-slot="{ active, selected }"
                          >
                            <li
                              class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                              :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                            >
                              <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                {{ option.name }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-4 w-4" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>

                  <!-- Player Listbox (conditional) -->
                  <Listbox v-if="selectedTargetType.value === 'player'" v-model="selectedPlayer" nullable>
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 text-left text-sm focus:border-white outline-none">
                        <span class="block truncate">{{ selectedPlayer?.name || 'Select a player' }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in playerOptions"
                            :key="option.value"
                            :value="option"
                            as="template"
                            v-slot="{ active, selected }"
                          >
                            <li
                              class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                              :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                            >
                              <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                {{ option.name }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-4 w-4" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>

                  <!-- Group Listbox (conditional) -->
                  <Listbox v-if="selectedTargetType.value === 'group'" v-model="selectedGroup" nullable>
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 text-left text-sm focus:border-white outline-none">
                        <span class="block truncate">{{ selectedGroup?.name || 'Select a group' }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in groupOptions"
                            :key="option.value"
                            :value="option"
                            as="template"
                            v-slot="{ active, selected }"
                          >
                            <li
                              class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                              :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                            >
                              <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                {{ option.name }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-4 w-4" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>

                </div>
              </div>

              <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
            </div>

            <div class="flex justify-between p-4 border-t border-t-white/20">
              <button
                @click="handleClose"
                class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                @click="submit"
                class="px-4 py-2 text-sm rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition"
              >
                {{ isEdit ? 'Save' : 'Create' }}
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
