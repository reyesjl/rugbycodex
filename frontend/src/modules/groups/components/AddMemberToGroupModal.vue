<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { OrgMember } from '@/modules/orgs/types';
import type { OrgGroup } from '@/modules/groups/types';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue';

const props = defineProps<{
  members: OrgMember[];
  groups: Array<{ group: OrgGroup; members: OrgMember[] }>;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { groupId: string; userId: string }];
}>();

const show = ref(true);
const selectedGroup = ref<OrgGroup | null>(null);
const selectedMember = ref<OrgMember | null>(null);
const groupQuery = ref('');
const memberQuery = ref('');
const error = ref<string | null>(null);

const sortedGroups = computed(() => {
  return [...props.groups]
    .map(g => g.group)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
});

const filteredGroups = computed(() => {
  if (!groupQuery.value) return sortedGroups.value;
  const q = groupQuery.value.toLowerCase();
  return sortedGroups.value.filter((g) => {
    return g.name.toLowerCase().includes(q);
  });
});

const availableMembers = computed(() => {
  if (!selectedGroup.value) return [];
  
  // Get members already in the selected group
  const groupData = props.groups.find(g => g.group.id === selectedGroup.value!.id);
  const groupMemberIds = new Set(groupData?.members.map(m => m.profile.id) ?? []);
  
  // Filter out members already in this group
  return props.members
    .filter(m => !groupMemberIds.has(m.profile.id))
    .sort((a, b) => {
      const an = (a.profile.name ?? a.profile.username ?? '').toLowerCase();
      const bn = (b.profile.name ?? b.profile.username ?? '').toLowerCase();
      return an.localeCompare(bn);
    });
});

const filteredMembers = computed(() => {
  if (!memberQuery.value) return availableMembers.value;
  const q = memberQuery.value.toLowerCase();
  return availableMembers.value.filter((m) => {
    const name = displayName(m).toLowerCase();
    return name.includes(q);
  });
});

function displayName(m: OrgMember | null): string {
  if (!m) return '';
  return m.profile.name || m.profile.username || '';
}

const handleClose = () => {
  emit('close');
};

function submit() {
  if (!selectedGroup.value) {
    error.value = 'Please select a group.';
    return;
  }
  
  if (!selectedMember.value) {
    error.value = 'Please select a member.';
    return;
  }

  error.value = null;
  emit('submit', { 
    groupId: selectedGroup.value.id,
    userId: selectedMember.value.profile.id 
  });
}
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
                <DialogTitle as="h2">Add member to group</DialogTitle>
                <p class="text-sm text-gray-400">Select a group and member to add.</p>
              </header>

              <div class="p-4 space-y-4">
                <!-- Group Selection -->
                <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                  <div class="col-span-4">
                    <label class="text-sm">Select Group</label>
                  </div>
                  <div class="col-span-8">
                    <Combobox v-model="selectedGroup" nullable>
                      <div class="relative">
                        <div class="relative">
                          <ComboboxInput
                            class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 focus:border-white outline-none"
                            :display-value="(group: any) => group?.name ?? ''"
                            placeholder="Search groups..."
                            @change="groupQuery = $event.target.value"
                          />
                          <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                            <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                          </ComboboxButton>
                        </div>
                        <TransitionRoot
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                          @after-leave="groupQuery = ''"
                        >
                          <ComboboxOptions
                            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none"
                          >
                            <div v-if="filteredGroups.length === 0 && groupQuery !== ''" class="px-3 py-2 text-white/50">
                              No groups found.
                            </div>
                            <ComboboxOption
                              v-for="group in filteredGroups"
                              :key="group.id"
                              :value="group"
                              as="template"
                              v-slot="{ active, selected }"
                            >
                              <li
                                class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                                :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                              >
                                <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                  {{ group.name }}
                                </span>
                                <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                  <Icon icon="carbon:checkmark" class="h-4 w-4" />
                                </span>
                              </li>
                            </ComboboxOption>
                          </ComboboxOptions>
                        </TransitionRoot>
                      </div>
                    </Combobox>
                  </div>
                </div>

                <!-- Member Selection -->
                <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                  <div class="col-span-4">
                    <label class="text-sm">Select Member</label>
                  </div>
                  <div class="col-span-8">
                    <Combobox v-model="selectedMember" nullable :disabled="!selectedGroup">
                      <div class="relative">
                        <div class="relative">
                          <ComboboxInput
                            class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 focus:border-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            :display-value="(member: any) => displayName(member)"
                            :placeholder="selectedGroup ? 'Search members...' : 'Select a group first'"
                            @change="memberQuery = $event.target.value"
                          />
                          <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                            <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                          </ComboboxButton>
                        </div>
                        <TransitionRoot
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                          @after-leave="memberQuery = ''"
                        >
                          <ComboboxOptions
                            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none"
                          >
                            <div v-if="availableMembers.length === 0" class="px-3 py-2 text-white/50">
                              All members are already in this group.
                            </div>
                            <div v-else-if="filteredMembers.length === 0 && memberQuery !== ''" class="px-3 py-2 text-white/50">
                              No members found.
                            </div>
                            <ComboboxOption
                              v-for="member in filteredMembers"
                              :key="member.profile.id"
                              :value="member"
                              as="template"
                              v-slot="{ active, selected }"
                            >
                              <li
                                class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                                :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                              >
                                <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                  {{ displayName(member) }}
                                </span>
                                <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                  <Icon icon="carbon:checkmark" class="h-4 w-4" />
                                </span>
                              </li>
                            </ComboboxOption>
                          </ComboboxOptions>
                        </TransitionRoot>
                      </div>
                    </Combobox>
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
                  Add
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
