<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import NarrationActionsMenu from '@/components/NarrationActionsMenu.vue';
import { formatRelativeTime } from '@/lib/date';

const props = defineProps<{
  narration: NarrationListItem;
  isActive?: boolean;
  isEditing?: boolean;
  editText?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'cancelEdit'): void;
  (e: 'saveEdit', text: string): void;
  (e: 'update:editText', text: string): void;
}>();

const localEditText = ref('');

function normalizeNarrationSourceType(value: unknown): NarrationSourceType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member') {
    return raw as NarrationSourceType;
  }
  return 'member';
}

function narrationSourceTypeFor(item: NarrationListItem): NarrationSourceType {
  return normalizeNarrationSourceType(item.source_type);
}

const sourceLabel = computed(() => {
  const source = narrationSourceTypeFor(props.narration);
  return `${source.charAt(0).toUpperCase()}${source.slice(1)}`;
});

const sourceColorClass = computed(() => {
  const source = narrationSourceTypeFor(props.narration);
  if (source === 'coach') return 'bg-slate-700/50 text-slate-300';
  if (source === 'staff') return 'bg-slate-700/50 text-slate-300';
  return 'bg-slate-700/50 text-slate-300';
});

const formattedTime = computed(() => {
  const d = (props.narration as any).created_at;
  if (!d) return '';
  return formatRelativeTime(d) || '';
});

const transcriptWithBoldTerms = computed(() => {
  const text = (props.narration as any).transcript_raw ?? '';
  const rugbyTerms = /\b(tackle|carry|pass|kick|ruck|scrum|lineout|turnover|maul|breakdown|penalty|try|conversion)\b/gi;
  return text.replace(rugbyTerms, '<strong class="font-semibold">$1</strong>');
});

const isUploading = computed(() => (props.narration as any)?.status === 'uploading');

function handleSaveEdit() {
  const text = props.editText?.trim() || localEditText.value.trim();
  if (text) {
    emit('saveEdit', text);
  }
}
</script>

<template>
  <div
    class="group relative border-l-2 transition-colors"
    :class="isActive 
      ? 'border-blue-400 bg-blue-500/10' 
      : 'border-transparent hover:bg-slate-800/30'"
  >
    <div class="px-4 py-3 cursor-pointer" @click="emit('click')">
      <!-- Header Row: Source badge + timestamp + actions -->
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
            :class="sourceColorClass"
          >
            {{ sourceLabel }}
          </span>
          <span v-if="isActive" class="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
            Now
          </span>
          <span class="text-xs text-slate-400 truncate">
            {{ formattedTime }}
          </span>
        </div>

        <div 
          v-if="(canEdit || canDelete) && !isEditing"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop
        >
          <NarrationActionsMenu
            :can-edit="canEdit"
            :can-delete="canDelete"
            @edit="emit('edit')"
            @delete="emit('delete')"
          />
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-if="isEditing" class="space-y-2" @click.stop>
        <textarea
          :value="editText"
          rows="3"
          class="w-full rounded-md bg-slate-900/50 border border-slate-700/50 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          @input="emit('update:editText', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="text-xs text-slate-400 hover:text-slate-200 transition"
            @click="emit('cancelEdit')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-blue-500/20 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/30 transition"
            :disabled="!editText?.trim()"
            @click="handleSaveEdit"
          >
            Save
          </button>
        </div>
      </div>

      <!-- Narration Text -->
      <div v-else-if="isUploading" class="flex items-center gap-3 text-sm text-slate-300">
        <LoadingDot />
        <ShimmerText text="rugbycodex is transcribing your voice..." />
      </div>
      <div v-else class="text-base text-slate-50 leading-relaxed" v-html="transcriptWithBoldTerms" />
    </div>
  </div>
</template>
