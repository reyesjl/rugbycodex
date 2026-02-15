<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';

const props = withDefaults(
  defineProps<{
    tags?: SegmentTag[];
    currentUserId?: string | null;
    canAddIdentity?: boolean;
    hasIdentityTag?: boolean;
    profileNameById?: Record<string, string>;
  }>(),
  {
    tags: () => [],
    canAddIdentity: false,
    hasIdentityTag: false,
    profileNameById: () => ({}),
  }
);

const emit = defineEmits<{
  (e: 'addIdentityTag'): void;
  (e: 'removeIdentityTag'): void;
}>();

const tagList = computed(() => props.tags ?? []);

const identityTags = computed(() => tagList.value.filter((tag) => tag.tag_type === 'identity'));
const actionTags = computed(() => tagList.value.filter((tag) => tag.tag_type === 'action'));
const contextTags = computed(() => tagList.value.filter((tag) => tag.tag_type === 'context'));

function formatTagLabel(tag: SegmentTag): string {
  const raw = String(tag.tag_key ?? '').replace(/_/g, ' ').trim();
  if (tag.tag_type === 'identity') {
    const profileId = tag.tagged_profile_id ?? tag.created_by;
    if (props.currentUserId && String(profileId) === String(props.currentUserId)) return 'you';
    const profileKey = profileId ? String(profileId) : '';
    const profileName = profileKey ? props.profileNameById?.[profileKey] : '';
    if (profileName) return profileName;
    if (raw && raw !== 'self') return raw;
    return 'player';
  }
  return raw || String(tag.tag_type ?? '').toLowerCase();
}

const playerLabels = computed(() => identityTags.value.map(formatTagLabel));
const actionLabels = computed(() => actionTags.value.map(formatTagLabel));
const contextLabels = computed(() => contextTags.value.map(formatTagLabel));

const shouldCollapsePlayers = computed(() => playerLabels.value.length > 5);
const shouldCollapseActions = computed(() => actionLabels.value.length > 5);
const shouldCollapseContext = computed(() => contextLabels.value.length > 5);

const playersExpanded = ref(false);
const actionsExpanded = ref(false);
const contextExpanded = ref(false);
const showIdentityConfirm = ref(false);

function classForTag(tag: SegmentTag): string {
  const type = String(tag.tag_type ?? '');
  if (type === 'action') return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-200/20';
  if (type === 'context') return 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-200/20';
  if (type === 'identity') return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-200/20';
  return 'bg-white/10 text-white/80 ring-1 ring-white/15';
}

const visiblePlayerTags = computed(() => {
  if (!shouldCollapsePlayers.value || playersExpanded.value) return identityTags.value;
  return identityTags.value.slice(0, 5);
});

const visibleActionTags = computed(() => {
  if (!shouldCollapseActions.value || actionsExpanded.value) return actionTags.value;
  return actionTags.value.slice(0, 5);
});

const visibleContextTags = computed(() => {
  if (!shouldCollapseContext.value || contextExpanded.value) return contextTags.value;
  return contextTags.value.slice(0, 5);
});

function requestIdentityConfirm() {
  if (!props.canAddIdentity || props.hasIdentityTag) return;
  showIdentityConfirm.value = true;
}

function closeIdentityConfirm() {
  showIdentityConfirm.value = false;
}

function confirmIdentityTag() {
  showIdentityConfirm.value = false;
  emit('addIdentityTag');
}

function removeIdentityTag() {
  if (!props.hasIdentityTag) return;
  emit('removeIdentityTag');
}
</script>

<template>
  <div class="px-4 pt-3 space-y-3">
    <div class="flex items-start gap-3 text-xs text-white/80">
      <div class="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Players
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div v-if="visiblePlayerTags.length" class="flex flex-wrap items-center gap-2">
              <span
                v-for="tag in visiblePlayerTags"
                :key="String(tag.id)"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="classForTag(tag)"
              >
                {{ formatTagLabel(tag) }}
              </span>
            </div>
            <div v-else class="text-[11px] text-white/40">None</div>
            <button
              v-if="shouldCollapsePlayers"
              type="button"
              class="text-[11px] text-white/50 underline underline-offset-2 hover:text-white/80"
              :title="playersExpanded ? 'Collapse' : 'Expand'"
              @click="playersExpanded = !playersExpanded"
            >
              ...
            </button>
          </div>
          <button
            v-if="props.canAddIdentity && !props.hasIdentityTag"
            type="button"
            class="md:hidden rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black shadow-sm transition hover:bg-white/90"
            @click="requestIdentityConfirm"
          >
            That's me
          </button>
          <button
            v-else-if="props.canAddIdentity && props.hasIdentityTag"
            type="button"
            class="md:hidden rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70 ring-1 ring-white/20 shadow-sm transition hover:bg-red-500/20 hover:text-red-200 hover:ring-red-300/30"
            title="Remove your tag"
            @click="removeIdentityTag"
          >
            Remove
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-3 text-xs text-white/80">
      <div class="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Actions
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <div v-if="visibleActionTags.length" class="flex flex-wrap items-center gap-2">
            <span
              v-for="tag in visibleActionTags"
              :key="String(tag.id)"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="classForTag(tag)"
            >
              {{ formatTagLabel(tag) }}
            </span>
          </div>
          <div v-else class="text-[11px] text-white/40">None</div>
          <button
            v-if="shouldCollapseActions"
            type="button"
            class="text-[11px] text-white/50 underline underline-offset-2 hover:text-white/80"
            :title="actionsExpanded ? 'Collapse' : 'Expand'"
            @click="actionsExpanded = !actionsExpanded"
          >
            ...
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-3 text-xs text-white/80">
      <div class="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Context
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <div v-if="visibleContextTags.length" class="flex flex-wrap items-center gap-2">
            <span
              v-for="tag in visibleContextTags"
              :key="String(tag.id)"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="classForTag(tag)"
            >
              {{ formatTagLabel(tag) }}
            </span>
          </div>
          <div v-else class="text-[11px] text-white/40">None</div>
          <button
            v-if="shouldCollapseContext"
            type="button"
            class="text-[11px] text-white/50 underline underline-offset-2 hover:text-white/80"
            :title="contextExpanded ? 'Collapse' : 'Expand'"
            @click="contextExpanded = !contextExpanded"
          >
            ...
          </button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="showIdentityConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm involvement"
      @click.self="closeIdentityConfirm"
    >
      <div class="w-full max-w-md rounded-lg border border-white/15 bg-black text-white shadow-xl">
        <div class="border-b border-white/10 px-4 py-3">
          <div class="text-sm font-semibold">Confirm involvement</div>
          <div class="mt-1 text-xs text-white/70">
            Tag yourself only if you’re part of the action. This affects your highlights and reviews.
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
            @click="closeIdentityConfirm"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-white px-3 py-1 text-[11px] font-semibold text-black hover:bg-white/90"
            @click="confirmIdentityTag"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
