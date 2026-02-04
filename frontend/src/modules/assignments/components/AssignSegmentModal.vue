<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  ComboboxButton,
} from '@headlessui/vue';

import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';

import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { AssignmentTargetType } from '@/modules/assignments/types';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { Narration } from '@/modules/narrations/types/Narration';

const props = defineProps<{
  orgId: string;
  segmentId: string;
  segmentLabel?: string;
  onClose: () => void;
  onAssigned?: () => void;
}>();

const show = ref(true);
const loading = ref(false);
const error = ref<string | null>(null);

const members = ref<OrgMember[]>([]);
const groups = ref<OrgGroup[]>([]);

const title = ref('');
const description = ref('');
const dueAt = ref<string>('');
const titleTouched = ref(false);
const autoTitle = ref('Clip review');

const targetType = ref<AssignmentTargetType>('team');
const selectedPlayer = ref<OrgMember | null>(null);
const selectedGroup = ref<OrgGroup | null>(null);
const playerQuery = ref('');
const groupQuery = ref('');

const sortedMembers = computed(() => {
  return [...members.value].sort((a, b) => {
    const an = (a.profile.name ?? a.profile.username ?? '').toLowerCase();
    const bn = (b.profile.name ?? b.profile.username ?? '').toLowerCase();
    return an.localeCompare(bn);
  });
});

const sortedGroups = computed(() => {
  return [...groups.value].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
});

const filteredMembers = computed(() => {
  if (!playerQuery.value) return sortedMembers.value;
  const query = playerQuery.value.toLowerCase();
  return sortedMembers.value.filter((m) => {
    const name = (m.profile.name ?? m.profile.username ?? '').toLowerCase();
    return name.includes(query);
  });
});

const filteredGroups = computed(() => {
  if (!groupQuery.value) return sortedGroups.value;
  const query = groupQuery.value.toLowerCase();
  return sortedGroups.value.filter((g) => g.name.toLowerCase().includes(query));
});

function displayMemberName(m: OrgMember | null): string {
  if (!m) return '';
  return m.profile.name || m.profile.username || '';
}

function cleanTitleCandidate(input: string): string {
  let value = input.trim();
  if (!value) return '';
  value = value.replace(/\b(coach|member|staff)\b/gi, '');
  value = value.replace(/\bvs\b\s+[A-Z0-9\s]+/g, '');
  value = value.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*[–-]\s*\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
  value = value.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
  value = value.replace(/\bsegment\s*\d+\b/gi, '');
  value = value.replace(/\bclip\s*\d+\b/gi, '');
  value = value.replace(/[•]/g, ' ');
  value = value.replace(/\s*[–-]\s*/g, ' ');
  value = value.replace(/\s{2,}/g, ' ').trim();
  return value;
}

function extractNarrationTitle(narrations: Narration[]): string | null {
  const sorted = [...narrations].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  for (const n of sorted) {
    const text = (n.transcript_clean || n.transcript_raw || '').trim();
    if (!text) continue;
    const sentenceMatch = text.match(/[^.!?]+[.!?]/);
    const candidate = (sentenceMatch?.[0] ?? text).trim();
    const cleaned = cleanTitleCandidate(candidate);
    if (cleaned) return cleaned;
  }
  return null;
}

const handleClose = () => {
  if (!loading.value) {
    props.onClose();
  }
};

async function load() {
  loading.value = true;
  error.value = null;

  try {
    const [memberRows, groupRows, narrations] = await Promise.all([
      orgService.listMembers(props.orgId),
      groupsService.getGroupsForOrg(props.orgId),
      narrationService.listNarrationsForSegment(props.segmentId).catch(() => []),
    ]);

    members.value = memberRows;
    groups.value = groupRows.map((g) => g.group);

    const narrationTitle = extractNarrationTitle(narrations);
    autoTitle.value = narrationTitle || 'Clip review';
    if (!titleTouched.value || !title.value.trim()) {
      title.value = autoTitle.value;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load members and groups.';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  const trimmedTitle = title.value.trim();
  const finalTitle = trimmedTitle || autoTitle.value || 'Clip review';

  if (targetType.value === 'player' && !selectedPlayer.value) {
    error.value = 'Please select a player.';
    return;
  }

  if (targetType.value === 'group' && !selectedGroup.value) {
    error.value = 'Please select a group.';
    return;
  }

  error.value = null;
  loading.value = true;

  try {
    const dueAtIso = dueAt.value ? new Date(dueAt.value).toISOString() : null;

    const target =
      targetType.value === 'team'
        ? { type: 'team' as const }
        : targetType.value === 'player'
          ? { type: 'player' as const, id: selectedPlayer.value!.profile.id }
          : { type: 'group' as const, id: selectedGroup.value!.id };

    const created = await assignmentsService.createAssignment(props.orgId, {
      title: finalTitle,
      description: description.value.trim() ? description.value.trim() : null,
      dueAt: dueAtIso,
      targets: [target],
    });

    await assignmentsService.attachSegment(created.id, props.segmentId);

    toast({
      variant: 'success',
      message: 'Assigned successfully.',
      durationMs: 2500,
    });

    props.onClose();
    props.onAssigned?.();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to assign segment.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  title.value = autoTitle.value;
  void load();
});
</script>

<template>
  <TransitionRoot :show="show">
    <Dialog @close="handleClose" class="relative z-70">
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-2xl text-white my-8">
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2">Assign Segment</DialogTitle>
                <p class="text-sm text-gray-400">Assign this moment to the team, a player, or a group.</p>
              </header>

            <div class="p-4 space-y-4">
              <!-- Title -->
              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm" for="title">Title</label>
                </div>
                <div class="col-span-8">
                  <input
                    id="title"
                    v-model="title"
                    class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                    placeholder="Assignment title"
                    @input="titleTouched = true"
                  />
                </div>
              </div>

              <!-- Target Type -->
              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm">Target</label>
                </div>
                <div class="col-span-8">
                  <div class="inline-flex rounded-lg border border-white/15 overflow-hidden">
                    <button
                      type="button"
                      class="px-3 py-2 text-xs transition"
                      :class="targetType === 'team' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                      @click="targetType = 'team'; selectedPlayer = null; selectedGroup = null;"
                    >
                      Team
                    </button>
                    <button
                      type="button"
                      class="px-3 py-2 text-xs transition border-l border-white/10"
                      :class="targetType === 'player' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                      @click="targetType = 'player'; selectedGroup = null;"
                    >
                      Player
                    </button>
                    <button
                      type="button"
                      class="px-3 py-2 text-xs transition border-l border-white/10"
                      :class="targetType === 'group' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                      @click="targetType = 'group'; selectedPlayer = null;"
                    >
                      Group
                    </button>
                  </div>
                </div>
              </div>

              <!-- Player Combobox -->
              <div v-if="targetType === 'player'" class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm">Select Player</label>
                </div>
                <div class="col-span-8">
                  <Combobox v-model="selectedPlayer" nullable>
                    <div class="relative">
                      <div class="relative">
                        <ComboboxInput
                          class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 focus:border-white outline-none"
                          :display-value="(member: any) => displayMemberName(member)"
                          placeholder="Search players..."
                          @change="playerQuery = $event.target.value"
                        />
                        <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                        </ComboboxButton>
                      </div>
                      <TransitionRoot
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                        @after-leave="playerQuery = ''"
                      >
                        <ComboboxOptions
                          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none"
                        >
                          <div v-if="filteredMembers.length === 0 && playerQuery !== ''" class="px-3 py-2 text-white/50">
                            No players found.
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
                                {{ displayMemberName(member) }}
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

              <!-- Group Combobox -->
              <div v-if="targetType === 'group'" class="flex flex-col gap-2 md:grid md:grid-cols-12">
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

              <!-- Due Date -->
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

              <!-- Note -->
              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm" for="note">Note</label>
                </div>
                <div class="col-span-8">
                  <textarea
                    id="note"
                    v-model="description"
                    rows="3"
                    class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div v-if="error" class="text-xs text-red-400">{{ error }}</div>
            </div>

            <div class="flex justify-between p-4 border-t border-t-white/20">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                :disabled="loading"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="submit"
                class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition disabled:opacity-50"
                :disabled="loading"
              >
                <Icon icon="carbon:task" width="15" height="15" />
                Assign
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
