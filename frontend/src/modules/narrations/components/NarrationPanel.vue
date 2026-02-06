<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import NarrationActionsMenu from '@/components/NarrationActionsMenu.vue';
import type { OrgRole } from '@/modules/orgs/types/OrgRole';
import { formatRelativeTime } from '@/lib/date';

const props = withDefaults(
  defineProps<{
  narrations: NarrationListItem[];
  submitting?: boolean;
  submitError?: string | null;
  currentUserId?: string | null;
  currentUserRole?: OrgRole | null;
}>(),
  {
    submitting: false,
    submitError: null,
    currentUserId: null,
    currentUserRole: null,
  }
);

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'submitText', text: string): void;
  (e: 'updateText', payload: { id: string; transcriptRaw: string }): void;
  (e: 'delete', id: string): void;
  (e: 'selectNarration', id: string): void;
}>();

function isOptimistic(item: NarrationListItem): item is Exclude<NarrationListItem, Narration> {
  return (item as any).status === 'uploading' || (item as any).status === 'error';
}

function getAuthorDisplayName(item: NarrationListItem): string {
  // If it's optimistic (uploading), check if it's current user
  if (isOptimistic(item) && item.author_id === props.currentUserId) {
    return '@you';
  }
  
  // If author is current user, show "@you"
  if (item.author_id === props.currentUserId) {
    return '@you';
  }
  
  // Try author_name first, then author_username, then fallback
  const authorName = (item as any).author_name || (item as any).author_username;
  return authorName ? `@${authorName}` : '@Unknown';
}

const draft = ref('');
const canSubmit = computed(() => !!draft.value.trim() && !props.submitting);

const editingId = ref<string | null>(null);
const editDraft = ref('');
const saving = ref(false);
const narrationElById = ref(new Map<string, HTMLElement>());
const previousNarrationIds = ref<string[]>([]);
const hasInitialized = ref(false);

// Delete confirmation state
const showDeleteConfirm = ref(false);
const narrationToDelete = ref<NarrationListItem | null>(null);
const isDeleting = ref(false);

function isStaffRole(role: OrgRole | null): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'manager' || role === 'staff';
}

function canManage(item: NarrationListItem): boolean {
  if (!props.currentUserId) return false;
  if (isOptimistic(item)) return false;
  
  // Staff can manage any narration
  if (isStaffRole(props.currentUserRole)) return true;
  
  // Members can only manage their own
  return item.author_id === props.currentUserId;
}

function beginEdit(item: NarrationListItem) {
  if (!canManage(item)) return;
  editingId.value = item.id;
  editDraft.value = (item as any).transcript_raw ?? '';
}

function cancelEdit() {
  editingId.value = null;
  editDraft.value = '';
}

async function saveEdit() {
  if (!editingId.value) return;
  const text = editDraft.value.trim();
  if (!text) return;
  saving.value = true;
  try {
    emit('updateText', { id: editingId.value, transcriptRaw: text });
    cancelEdit();
  } finally {
    saving.value = false;
  }
}

function requestDelete(item: NarrationListItem) {
  if (!canManage(item)) return;
  if (isOptimistic(item)) return;
  narrationToDelete.value = item;
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  if (isDeleting.value) return;
  showDeleteConfirm.value = false;
  narrationToDelete.value = null;
}

async function confirmDelete() {
  if (!narrationToDelete.value) return;
  isDeleting.value = true;
  try {
    emit('delete', narrationToDelete.value.id);
    if (editingId.value === narrationToDelete.value.id) cancelEdit();
    showDeleteConfirm.value = false;
    narrationToDelete.value = null;
  } finally {
    isDeleting.value = false;
  }
}

function submit() {
  const text = draft.value.trim();
  if (!text) return;
  draft.value = '';
  emit('submitText', text);
}

function setNarrationEl(id: string, el: unknown) {
  if (!el) {
    narrationElById.value.delete(id);
    return;
  }

  const maybeEl = (el as any)?.$el ?? el;
  if (maybeEl instanceof HTMLElement) {
    narrationElById.value.set(id, maybeEl);
  }
}

watch(
  () => props.narrations,
  async (nextNarrations) => {
    const nextIds = nextNarrations.map((item) => String(item.id));
    if (!hasInitialized.value) {
      previousNarrationIds.value = nextIds;
      hasInitialized.value = true;
      return;
    }

    const prevSet = new Set(previousNarrationIds.value);
    const newId = nextIds.filter((id) => !prevSet.has(id)).pop();
    previousNarrationIds.value = nextIds;

    if (!newId) return;

    await nextTick();
    const el = narrationElById.value.get(newId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
);
</script>

<template>
  <div class="px-4 pt-4 pb-24">
    <div class="flex items-center justify-between mb-3">
      <div class="font-semibold text-white">
        {{ narrations.length }} {{ narrations.length === 1 ? 'Narration' : 'Narrations' }}
      </div>
    </div>

    <!-- Input area (typed narration) -->
    <div class="mb-4 border-b border-white/10 pb-3">
      <textarea
        v-model="draft"
        rows="3"
        class="w-full resize-none bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
        placeholder="Add a narration"
        :disabled="submitting"
        @focus="() => {}"
        @blur="() => {}"
      />
      <div v-if="draft.trim()" class="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs text-white/60 hover:text-white transition"
          @click="draft = ''"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 transition"
          :disabled="!canSubmit || submitting"
          @click="submit"
        >
          {{ submitting ? 'Saving...' : 'Submit' }}
        </button>
      </div>
      <div v-if="submitError" class="mt-2 text-xs text-red-300">
        {{ submitError }}
      </div>
    </div>

    <div class="mt-3">
      <div
        v-for="item in narrations"
        :key="item.id"
        class="group relative border-t border-white/10 px-1 py-2 transition first:border-t-0"
        :ref="(el) => setNarrationEl(String(item.id), el)"
        @click="emit('selectNarration', item.id)"
      >
        <!-- Three dots menu in top right corner -->
        <div v-if="canManage(item)" class="absolute top-2 right-1 opacity-40 transition group-hover:opacity-100 focus-within:opacity-100">
          <NarrationActionsMenu
            v-if="editingId !== item.id"
            :can-edit="true"
            :can-delete="true"
            @edit="beginEdit(item)"
            @delete="requestDelete(item)"
          />
        </div>

        <!-- Username and date -->
        <div class="flex items-baseline gap-1.5 pr-8">
          <span class="text-sm font-semibold text-white">{{ getAuthorDisplayName(item) }}</span>
          <span class="text-white/30">·</span>
          <span class="text-[11px] text-white/50">{{ formatRelativeTime(item.created_at) || 'Unknown time' }}</span>
          <span v-if="isOptimistic(item)" class="ml-2">
            <span v-if="item.status === 'uploading'" class="text-[11px] text-white/40">• Uploading…</span>
            <span v-else class="text-[11px] text-red-300">• Failed</span>
          </span>
        </div>

        <div v-if="editingId === item.id" class="mt-1">
          <textarea
            v-model="editDraft"
            rows="3"
            class="w-full resize-none rounded-md bg-black/20 p-2 text-sm text-white placeholder-white/40 ring-1 ring-white/10 focus:outline-none"
            :disabled="saving"
            @click.stop
          />
          <div class="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-md px-3 py-1 text-xs text-white/70 ring-1 ring-white/10 hover:bg-white/5"
              :disabled="saving"
              @click.stop="cancelEdit"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1 text-xs text-black bg-white hover:bg-white/90"
              :disabled="saving || !editDraft.trim()"
              @click.stop="saveEdit"
            >
              Save
            </button>
          </div>
        </div>

        <div v-else class="mt-1 whitespace-pre-wrap text-sm">
          <ShimmerText v-if="isOptimistic(item) && item.status === 'uploading'" class="text-white/70">
            {{ item.transcript_raw }}
          </ShimmerText>
          <span v-else class="text-white">
            {{ item.transcript_raw }}
          </span>
        </div>
        <div v-if="isOptimistic(item) && item.status === 'error' && item.errorMessage" class="mt-2 text-xs text-red-300">
          {{ item.errorMessage }}
        </div>
      </div>

      <div v-if="narrations.length === 0" class="text-sm text-white/50">
        No narrations yet.
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmDeleteModal
      :show="showDeleteConfirm"
      :item-name="'this narration'"
      popup-title="Delete Narration"
      :is-deleting="isDeleting"
      @confirm="confirmDelete"
      @cancel="closeDeleteConfirm"
      @close="closeDeleteConfirm"
    />
  </div>
</template>