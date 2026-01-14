<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';

import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';

import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { AssignmentTargetType } from '@/modules/assignments/types';

import MemberPill from '@/modules/orgs/components/MemberPill.vue';

const props = defineProps<{
  orgId: string;
  segmentId: string;
  segmentLabel?: string;
  onClose: () => void;
  onAssigned?: () => void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);

const members = ref<OrgMember[]>([]);
const groups = ref<OrgGroup[]>([]);

const title = ref('');
const description = ref('');
const dueAt = ref<string>('');

const targetType = ref<AssignmentTargetType>('team');
const selectedPlayerId = ref<string>('');
const selectedGroupId = ref<string>('');

const defaultTitle = computed(() => {
  const base = props.segmentLabel?.trim();
  if (base) return base;
  return 'Segment assignment';
});

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

function selectPlayer(profileId: string) {
  selectedPlayerId.value = selectedPlayerId.value === profileId ? '' : profileId;
}

function selectGroup(groupId: string) {
  selectedGroupId.value = selectedGroupId.value === groupId ? '' : groupId;
}

async function load() {
  loading.value = true;
  error.value = null;

  try {
    const [memberRows, groupRows] = await Promise.all([
      orgService.listMembers(props.orgId),
      groupsService.getGroupsForOrg(props.orgId),
    ]);

    members.value = memberRows;
    groups.value = groupRows.map((g) => g.group);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load members and groups.';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!title.value.trim()) {
    error.value = 'Please enter a title.';
    return;
  }

  if (targetType.value === 'player' && !selectedPlayerId.value) {
    error.value = 'Please select a player.';
    return;
  }

  if (targetType.value === 'group' && !selectedGroupId.value) {
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
          ? { type: 'player' as const, id: selectedPlayerId.value }
          : { type: 'group' as const, id: selectedGroupId.value };

    const created = await assignmentsService.createAssignment(props.orgId, {
      title: title.value.trim(),
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
  title.value = defaultTitle.value;
  void load();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="props.onClose"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-2xl text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2>Assign Segment</h2>
          <p class="text-sm text-gray-400">Assign this moment to the team, a player, or a group.</p>
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
                placeholder="Assignment title"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="target">Target</label>
            </div>
            <div class="col-span-8">
              <div class="inline-flex rounded-lg border border-white/15 overflow-hidden">
                <button
                  type="button"
                  class="px-3 py-2 text-xs transition"
                  :class="targetType === 'team' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                  @click="targetType = 'team'"
                >
                  Team
                </button>
                <button
                  type="button"
                  class="px-3 py-2 text-xs transition border-l border-white/10"
                  :class="targetType === 'player' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                  @click="targetType = 'player'"
                >
                  Players
                </button>
                <button
                  type="button"
                  class="px-3 py-2 text-xs transition border-l border-white/10"
                  :class="targetType === 'group' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                  @click="targetType = 'group'"
                >
                  Groups
                </button>
              </div>
            </div>
          </div>

          <div v-if="targetType === 'player'" class="border-t border-white/10 pt-4">
            <div class="text-sm text-white/80 mb-2">Select a player</div>
            <div v-if="loading" class="text-white/60 text-sm">Loading…</div>
            <div v-else class="flex flex-wrap gap-2">
              <MemberPill
                v-for="m in sortedMembers"
                :key="m.profile.id"
                :member="m"
                :selected="m.profile.id === selectedPlayerId"
                :can-manage="true"
                @toggle="selectPlayer(m.profile.id)"
              />
            </div>
          </div>

          <div v-if="targetType === 'group'" class="border-t border-white/10 pt-4">
            <div class="text-sm text-white/80 mb-2">Select a group</div>
            <div v-if="loading" class="text-white/60 text-sm">Loading…</div>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="g in sortedGroups"
                :key="g.id"
                type="button"
                class="group flex items-center gap-2 rounded-full px-3 py-1.5 transition"
                :class="g.id === selectedGroupId
                  ? 'border border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/20'
                  : 'border border-white/10 bg-white/0 hover:bg-white/5'"
                @click="selectGroup(g.id)"
              >
                <span class="text-sm text-gray-500 group-hover:text-white transition">{{ g.name }}</span>
              </button>
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
            @click="props.onClose"
            class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="submit"
            class="flex items-center gap-2 px-2 py-1 text-xs rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition disabled:opacity-50"
            :disabled="loading"
          >
            <Icon icon="carbon:task" width="15" height="15" />
            Assign
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
