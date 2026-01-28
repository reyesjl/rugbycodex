<script setup lang="ts">
import { computed, ref } from 'vue';
import { isSupportedVideoFile, sanitizeFileName } from '@/modules/media/utils/assetUtilities';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';

type AddMediaUploadPayload = {
  file: globalThis.File;
  kind: MediaAssetKind;
};

const emit = defineEmits<{
  close: [];
  submit: [payload: AddMediaUploadPayload];
}>();

const title = ref('');
const kind = ref<MediaAssetKind>('match');
const file = ref<globalThis.File | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);

const canSubmit = computed(() => {
  return Boolean(title.value.trim()) && Boolean(file.value) && !loading.value;
});

function reset() {
  title.value = '';
  kind.value = 'match';
  file.value = null;
  error.value = null;
  loading.value = false;
}

function close() {
  if (loading.value) return;
  reset();
  emit('close');
}

function handleFileChange(event: globalThis.Event) {
  const target = event.target as globalThis.HTMLInputElement | null;
  const selected = target?.files?.[0] ?? null;

  if (!selected) {
    file.value = null;
    error.value = null;
    return;
  }

  if (!isSupportedVideoFile(selected)) {
    file.value = null;
    error.value = 'Unsupported file format. Please upload MP4, MOV, AVI, MKV, WebM, or FLV.';
    if (target) target.value = '';
    return;
  }

  file.value = selected;
  error.value = null;
}

function buildUploadFile(original: globalThis.File, rawTitle: string) {
  const trimmedTitle = rawTitle.trim();
  const sanitizedTitle = sanitizeFileName(trimmedTitle);

  const originalName = original.name;
  const extMatch = originalName.match(/\.[a-z0-9]+$/i);
  const ext = extMatch?.[0]?.toLowerCase() ?? '.mp4';

  const desiredName = sanitizedTitle.toLowerCase().endsWith(ext) ? sanitizedTitle : `${sanitizedTitle}${ext}`;

  return new File([original], desiredName, {
    type: original.type,
    lastModified: original.lastModified,
  });
}

async function submit() {
  if (!title.value.trim()) {
    error.value = 'Title is required.';
    return;
  }

  if (!file.value) {
    error.value = 'Please choose a file.';
    return;
  }

  error.value = null;

  const uploadFile = buildUploadFile(file.value, title.value);
  emit('submit', {
    file: uploadFile,
    kind: kind.value,
  });

  // Close immediately after emitting the payload (validation-only modal).
  close();
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add media asset"
      @click.self="close"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2>Add media</h2>
          <p class="text-sm text-gray-400">Upload a clip for this organization.</p>
        </header>

        <div class="p-4 space-y-4">
          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="media-title">Title<span class="text-red-400">*</span></label>
            </div>
            <div class="col-span-8">
              <input
                id="media-title"
                v-model="title"
                type="text"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                placeholder="Opponent - Week 3" 
                :disabled="loading"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="media-kind">Kind<span class="text-red-400">*</span></label>
            </div>
            <div class="col-span-8">
              <select
                id="media-kind"
                v-model="kind"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                :disabled="loading"
              >
                <option value="match" class="bg-black text-white">Match</option>
                <option value="training" class="bg-black text-white">Training</option>
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
            <div class="col-span-4">
              <label class="text-sm" for="media-file">File<span class="text-red-400">*</span></label>
            </div>
            <div class="col-span-8">
              <input
                id="media-file"
                type="file"
                accept="video/mp4,.mp4,.m4v,.mov,.avi,.mkv,.webm,.flv"
                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                :disabled="loading"
                @change="handleFileChange"
              />
              <p class="text-xs text-gray-400 mt-1">Supported: MP4, MOV, AVI, MKV, WebM, FLV</p>
            </div>
          </div>

          <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
        </div>

        <div class="flex justify-between p-4 border-t border-t-white/20">
          <button
            type="button"
            @click="close"
            class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            :disabled="loading"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="submit"
            class="px-3 py-1.5 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50 cursor-pointer"
            :disabled="!canSubmit"
          >
            <span v-if="loading">Starting…</span>
            <span v-else>Start upload</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped></style>
