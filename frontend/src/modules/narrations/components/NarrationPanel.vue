<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';

const props = withDefaults(
  defineProps<{
  narrations: NarrationListItem[];
  submitting?: boolean;
  submitError?: string | null;
  currentUserId?: string | null;
}>(),
  {
    submitting: false,
    submitError: null,
    currentUserId: null,
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

const draft = ref('');
const canSubmit = computed(() => !!draft.value.trim() && !props.submitting);

const editingId = ref<string | null>(null);
const editDraft = ref('');
const saving = ref(false);
const narrationElById = ref(new Map<string, HTMLElement>());
const previousNarrationIds = ref<string[]>([]);
const hasInitialized = ref(false);

function canManage(item: NarrationListItem): boolean {
  if (!props.currentUserId) return false;
  if (isOptimistic(item)) return false;
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
  const ok = window.confirm('Delete this narration?');
  if (!ok) return;
  emit('delete', item.id);
  if (editingId.value === item.id) cancelEdit();
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
    <div class="flex items-center justify-between">
      <div class="text-sm font-semibold text-white">Narrations ({{ narrations.length }})</div>
      <button
        type="button"
        class="text-xs text-white/60 hover:text-white"
        @click="emit('refresh')"
      >
        Refresh
      </button>
    </div>

    <!-- Input area (typed narration) -->
    <div class="mt-3 border-b border-white/10 pb-3">
      <textarea
        v-model="draft"
        rows="3"
        class="w-full resize-none bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
        placeholder="Add a narration"
        :disabled="submitting"
      />
      <div class="mt-2 flex items-center justify-between">
        <div class="text-xs text-white/50">
          <span v-if="submitting">Saving…</span>
          <span v-else-if="submitError" class="text-red-300">{{ submitError }}</span>
          <span v-else>{{ draft.length }} chars</span>
        </div>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs ring-1 transition"
          :class="canSubmit
            ? 'bg-white/5 text-white ring-white/10 hover:bg-white/10'
            : 'bg-white/5 text-white/30 ring-white/10 cursor-not-allowed'"
          :disabled="!canSubmit"
          @click="submit"
        >
          Submit
        </button>
      </div>
    </div>

    <div class="mt-3">
      <div
        v-for="item in narrations"
        :key="item.id"
        class="group border-t border-white/10 px-1 py-2 transition hover:bg-white/5 first:border-t-0"
        :ref="(el) => setNarrationEl(String(item.id), el)"
        @click="emit('selectNarration', item.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="text-[10px] font-mono text-white/40">
            {{ new Date(item.created_at).toLocaleString() }}
            <span v-if="isOptimistic(item)" class="ml-2">
              <span v-if="item.status === 'uploading'">• Uploading…</span>
              <span v-else class="text-red-300">• Failed</span>
            </span>
          </div>

          <div v-if="canManage(item)" class="flex items-center gap-2 opacity-40 transition group-hover:opacity-100 focus-within:opacity-100">
            <button
              v-if="editingId !== item.id"
              type="button"
              class="text-[11px] text-white/60 hover:text-white"
              :disabled="saving"
              @click.stop="beginEdit(item)"
            >
              Edit
            </button>
            <button
              type="button"
              class="text-[11px] text-red-300/70 hover:text-red-200"
              :disabled="saving"
              @click.stop="requestDelete(item)"
            >
              Trash
            </button>
          </div>
        </div>

        <div v-if="editingId === item.id" class="mt-2">
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

        <div v-else class="mt-1 whitespace-pre-wrap text-sm text-white">
          {{ item.transcript_raw }}
        </div>
        <div v-if="isOptimistic(item) && item.status === 'error' && item.errorMessage" class="mt-2 text-xs text-red-300">
          {{ item.errorMessage }}
        </div>
      </div>

      <div v-if="narrations.length === 0" class="text-sm text-white/50">
        No narrations yet.
      </div>
    </div>
  </div>
</template>