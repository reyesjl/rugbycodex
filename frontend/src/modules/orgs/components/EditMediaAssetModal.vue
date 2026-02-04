<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import { sanitizeFileName } from '@/modules/media/utils/assetUtilities';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue';

type KindOption = {
  value: MediaAssetKind;
  name: string;
};

const kindOptions: KindOption[] = [
  { value: 'match', name: 'Match' },
  { value: 'training', name: 'Training' },
  { value: 'clinic', name: 'Clinic' },
];

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

// Convert dashes/underscores to spaces for display in input
const denormalizeForDisplay = (normalizedName: string): string => {
  return normalizedName.replace(/[-_]+/g, ' ').trim();
};

const show = ref(true);
const extension = ref('');
const fileName = ref('');
const selectedKind = ref<KindOption>(kindOptions[0]!);
const validationError = ref<string | null>(null);

// Initialize form when asset changes
watch(() => props.asset, (newAsset) => {
  const { baseName, extension: ext } = getFileNameParts(newAsset.file_name);
  // Display with spaces for easier editing
  fileName.value = denormalizeForDisplay(baseName);
  extension.value = ext;
  const kindOpt = kindOptions.find(k => k.value === newAsset.kind) ?? kindOptions[0]!;
  selectedKind.value = kindOpt;
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

function handleSubmit() {
  validationError.value = validateFileName(fileName.value);
  if (validationError.value) return;

  // Use shared sanitizeFileName (includes lowercase normalization)
  const normalizedBaseName = sanitizeFileName(fileName.value);
  const fullFileName = normalizedBaseName + extension.value;

  emit('submit', {
    file_name: fullFileName,
    kind: selectedKind.value.value,
  });
}

function handleClose() {
  emit('close');
}
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-md text-white my-8">
            <header class="p-4 border-b border-b-white/20">
              <DialogTitle as="h2" class="text-lg font-semibold">Edit Media</DialogTitle>
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
                <label class="block text-sm font-medium mb-2">
                  Type
                </label>
                <Listbox v-model="selectedKind">
                  <div class="relative">
                    <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-3 py-2 pr-10 text-left text-sm focus:border-white outline-none">
                      <span class="block truncate">{{ selectedKind.name }}</span>
                      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                      </span>
                    </ListboxButton>
                    
                    <transition
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100"
                      leave-to-class="opacity-0"
                    >
                      <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                        <ListboxOption
                          v-for="option in kindOptions"
                          :key="option.value"
                          :value="option"
                          as="template"
                          v-slot="{ active, selected }"
                        >
                          <li
                            class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                            :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                          >
                            <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                              {{ option.name }}
                            </span>
                            <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                              <Icon icon="carbon:checkmark" class="h-4 w-4" />
                            </span>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </transition>
                  </div>
                </Listbox>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  @click="handleClose"
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
          </DialogPanel>
        </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
