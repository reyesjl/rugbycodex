<script setup lang="ts">
import { computed, ref } from 'vue';

const showUploadModal = ref(false);
const uploadFiles = ref<globalThis.File[]>([]);
const uploadError = ref<string | null>(null);
const uploadProcessing = ref(false);

const emit = defineEmits<{
  upload: [files: globalThis.File[]];
}>();

const formatBytes = (bytes?: number | null) => {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const openUploadModal = () => {
  uploadFiles.value = [];
  uploadError.value = null;
  showUploadModal.value = true;
};

const closeUploadModal = () => {
  showUploadModal.value = false;
  uploadFiles.value = [];
  uploadError.value = null;
};

const MP4_MIME_TYPES = new Set(['video/mp4', 'application/mp4']);
const isMp4File = (file: globalThis.File) => {
  const nameOk = file.name.toLowerCase().endsWith('.mp4');
  if (!nameOk) return false;
  // Some browsers/OSes provide an empty type; allow it if extension is .mp4.
  if (!file.type) return true;
  return MP4_MIME_TYPES.has(file.type);
};

const handleFileChange = (event: globalThis.Event) => {
  const target = event.target as globalThis.HTMLInputElement | null;
  const files = target?.files ? Array.from(target.files) : [];
  if (files.length === 0) {
    uploadFiles.value = [];
    uploadError.value = null;
    return;
  }

  const invalid = files.filter((file) => !isMp4File(file));
  if (invalid.length > 0) {
    uploadFiles.value = [];
    uploadError.value = 'Only MP4 files are supported right now.';
    if (target) target.value = '';
    return;
  }

  uploadFiles.value = files;
  uploadError.value = null;
};

const canUpload = computed(() => uploadFiles.value.length > 0 && !uploadProcessing.value);

const handleUpload = () => {
  if (uploadFiles.value.length === 0) {
    uploadError.value = 'Choose a file first.';
    return;
  }

  emit('upload', uploadFiles.value);
  closeUploadModal();
};

defineExpose({
  openUploadModal,
  closeUploadModal,
});
</script>

<template>
  <teleport to="body">
    <transition name="upload-modal">
      <div v-if="showUploadModal" class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
        role="dialog" aria-modal="true" aria-label="Upload media" @click.self="closeUploadModal">
        <div
          class="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl">
          <header class="border-b border-white/10 px-6 py-4">
            <h2 class="text-xl font-semibold">Upload</h2>
          </header>
          <div class="space-y-4 px-6 py-5">
            <p class="text-sm text-white/70">
              Files are stored under <span class="font-mono text-white/80">matches/orgs/&lt;orgId&gt;/media/…</span>
            </p>

            <label class="block text-sm font-semibold uppercase tracking-wide text-white/60" for="org-media-file">
              File
            </label>
            <input id="org-media-file" type="file" multiple accept="video/mp4,.mp4"
              class="w-full rounded border border-white/20 bg-black/40 p-3 text-sm text-white file:mr-4 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
              :disabled="uploadProcessing" @change="handleFileChange" />
            <p class="text-xs text-white/50">Supported format: MP4 only. You can select multiple files; they will upload
              one at a time.</p>

            <div v-if="uploadFiles.length" class="rounded border border-white/10 bg-black/30 p-3 text-sm text-white/80">
              <p class="text-white/60">Selected:</p>
              <ul class="mt-2 space-y-1">
                <li v-for="file in uploadFiles" :key="file.name" class="flex items-center justify-between gap-3">
                  <span class="truncate">{{ file.name }}</span>
                  <span class="shrink-0 text-white/60">{{ formatBytes(file.size) }}</span>
                </li>
              </ul>
            </div>

            <p v-if="uploadError" class="text-sm text-rose-300">{{ uploadError }}</p>
          </div>
          <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
            <button type="button"
              class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="uploadProcessing" @click="closeUploadModal">
              Cancel
            </button>
            <button type="button"
              class="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canUpload" @click="handleUpload">
              <span v-if="uploadProcessing" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                Uploading…
              </span>
              <span v-else>Upload</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.upload-modal-enter-active,
.upload-modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.upload-modal-enter-from,
.upload-modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
