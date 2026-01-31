<script setup lang="ts">
import { ref, watch } from 'vue';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

const props = defineProps<{
  asset: OrgMediaAsset;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { file_name: string; kind: MediaAssetKind }];
}>();

// Extract base name and extension from current file_name
const getFileNameParts = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return { baseName: fileName, extension: '' };
  }
  return {
    baseName: fileName.substring(0, lastDotIndex),
    extension: fileName.substring(lastDotIndex) // includes the dot
  };
};

const extension = ref('');
const fileName = ref('');
const kind = ref<MediaAssetKind>('match');
const validationError = ref<string | null>(null);

// Initialize form when asset changes
watch(() => props.asset, (newAsset) => {
  const { baseName, extension: ext } = getFileNameParts(newAsset.file_name);
  fileName.value = baseName;
  extension.value = ext;
  kind.value = newAsset.kind as MediaAssetKind;
  validationError.value = null;
}, { immediate: true });

function validateFileName(name: string): string | null {
  if (!name.trim()) {
    return 'File name cannot be empty.';
  }

  if (name.length > 200) {
    return 'File name must be 200 characters or less.';
  }

  // Allow letters, numbers, spaces, hyphens, underscores, periods, parentheses, and accented characters
  const validPattern = /^[\p{L}\p{N}\s\-_.()]+$/u;
  if (!validPattern.test(name)) {
    return 'File name contains invalid characters.';
  }

  return null;
}

function normalizeFileName(name: string): string {
  // Trim whitespace
  let normalized = name.trim();
  
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Replace spaces with dashes (matching upload behavior)
  normalized = normalized.replace(/\s/g, '-');
  
  // Replace multiple dashes with single dash
  normalized = normalized.replace(/-+/g, '-');
  
  return normalized;
}

function handleSubmit() {
  validationError.value = validateFileName(fileName.value);
  if (validationError.value) return;

  // Normalize the base name and append original extension
  const normalizedBaseName = normalizeFileName(fileName.value);
  const fullFileName = normalizedBaseName + extension.value;

  emit('submit', {
    file_name: fullFileName,
    kind: kind.value,
  });
}

function handleCancel() {
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit media asset"
      @click.self="handleCancel"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-md text-white">
        <header class="p-4 border-b border-b-white/20">
          <h2 class="text-lg font-semibold">Edit Media</h2>
        </header>

        <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
          <div>
            <label for="edit-file-name" class="block text-sm font-medium mb-2">
              File Name
            </label>
            <div class="flex items-center gap-2">
              <input
                id="edit-file-name"
                v-model="fileName"
                type="text"
                class="flex-1 px-3 py-2 text-sm rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter file name"
                maxlength="200"
              />
              <span class="text-sm text-white/70 whitespace-nowrap">{{ extension }}</span>
            </div>
            <p v-if="validationError" class="text-red-400 text-xs mt-1">
              {{ validationError }}
            </p>
            <p class="text-white/50 text-xs mt-1">
              Spaces will be replaced with dashes
            </p>
          </div>

          <div>
            <label for="edit-kind" class="block text-sm font-medium mb-2">
              Type
            </label>
            <select
              id="edit-kind"
              v-model="kind"
              class="w-full px-3 py-2 text-sm rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="match">Match</option>
              <option value="training">Training</option>
              <option value="clinic">Clinic</option>
            </select>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="handleCancel"
              class="px-3 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-3 py-1.5 text-xs rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
