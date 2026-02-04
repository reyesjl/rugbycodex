<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { isSupportedVideoFile, sanitizeFileName } from '@/modules/media/utils/assetUtilities';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';
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

type AddMediaUploadPayload = {
  file: globalThis.File;
  kind: MediaAssetKind;
};

type KindOption = {
  value: MediaAssetKind;
  name: string;
};

const kindOptions: KindOption[] = [
  { value: 'match', name: 'Match' },
  { value: 'training', name: 'Training' },
  { value: 'clinic', name: 'Clinic' },
];

const emit = defineEmits<{
  close: [];
  submit: [payload: AddMediaUploadPayload];
}>();

const show = ref(true);
const title = ref('');
const selectedKind = ref<KindOption>(kindOptions[0]!);
const file = ref<globalThis.File | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);

const canSubmit = computed(() => {
  return Boolean(title.value.trim()) && Boolean(file.value) && !loading.value;
});

function reset() {
  title.value = '';
  selectedKind.value = kindOptions[0]!;
  file.value = null;
  error.value = null;
  loading.value = false;
}

function handleClose() {
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

  // Extract extension from original file (sanitizeFileName already lowercases)
  const originalName = original.name;
  const extMatch = originalName.match(/\.[a-z0-9]+$/i);
  const ext = extMatch?.[0]?.toLowerCase() ?? '';

  // Avoid double extension if user included it in title
  const desiredName = ext && sanitizedTitle.endsWith(ext) 
    ? sanitizedTitle 
    : `${sanitizedTitle}${ext}`;

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
    kind: selectedKind.value.value,
  });

  // Close immediately after emitting the payload (validation-only modal).
  handleClose();
}
</script>

<template>
  <TransitionRoot :show="show">
    <Dialog @close="handleClose" class="relative z-[70]">
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-xl text-white my-8">
            <header class="p-4 border-b border-b-white/20">
              <DialogTitle as="h2">Add media</DialogTitle>
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
                  <label class="text-sm">Kind<span class="text-red-400">*</span></label>
                </div>
                <div class="col-span-8">
                  <Listbox v-model="selectedKind" :disabled="loading">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 text-left text-sm focus:border-white outline-none disabled:opacity-50 disabled:cursor-not-allowed">
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
                @click="handleClose"
                class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
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
          </DialogPanel>
        </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped></style>
