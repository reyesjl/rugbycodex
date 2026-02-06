<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatRelativeTime } from '@/lib/date';

const props = defineProps<{
  title: string;
  metaLine: string;
  createdAt?: Date;
  canAddIdentity?: boolean;
  hasIdentityTag?: boolean;
}>();

const emit = defineEmits<{
  (e: 'requestIdentityTag'): void;
  (e: 'removeIdentityTag'): void;
}>();

const showIdentityConfirm = ref(false);

const formattedDate = computed(() => {
  if (!props.createdAt) return null;
  return formatRelativeTime(props.createdAt);
});

// Extract assignment info from metaLine (e.g., "Assigned to you • 1/1/2026")
const assignmentInfo = computed(() => {
  const parts = props.metaLine.split('•');
  return parts[0]?.trim() || props.metaLine;
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
  emit('requestIdentityTag');
}

function removeIdentityTag() {
  if (!props.hasIdentityTag) return;
  emit('removeIdentityTag');
}
</script>

<template>
  <div class="px-4 pt-3">
    <!-- Desktop: title and button inline -->
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="text-white text-lg md:text-xl font-semibold leading-snug line-clamp-2">
          {{ title }}
        </div>
        <div class="flex gap-5 mt-1.5 md:justify-normal justify-between">
          <div class="flex flex-col text-xs text-white/60">
            <div>{{ assignmentInfo }}</div>
            <div v-if="formattedDate">
              <div>{{ formattedDate }}</div>
            </div>
          </div>
          <!-- That's Me Button -->
          <div v-if="canAddIdentity" class="shrink-0">
            <button
              v-if="!hasIdentityTag"
              type="button"
              class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90"
              @click="requestIdentityConfirm"
            >
              That's me
            </button>
            <button
              v-else
              type="button"
              class="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-white/20 shadow-sm transition hover:bg-red-500/20 hover:text-red-200 hover:ring-red-300/30"
              title="Remove your tag"
              @click="removeIdentityTag"
            >
              Not me
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Modal (Desktop only) -->
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
            Tag yourself only if you're part of the action. This affects your highlights and reviews.
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
