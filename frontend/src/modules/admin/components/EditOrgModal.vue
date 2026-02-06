<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
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
import type { Organization, OrganizationType, OrganizationVisibility } from '@/modules/orgs/types';

type TypeOption = {
  value: OrganizationType;
  label: string;
};

type VisibilityOption = {
  value: OrganizationVisibility;
  label: string;
};

type StorageOption = {
  gb: number;
  mb: number;
  label: string;
};

const typeOptions: TypeOption[] = [
  { value: 'team', label: 'Team' },
  { value: 'personal', label: 'Personal' },
];

const visibilityOptions: VisibilityOption[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

const storageOptions: StorageOption[] = [
  { gb: 10, mb: 10240, label: '10 GB' },
  { gb: 20, mb: 20480, label: '20 GB' },
  { gb: 30, mb: 30720, label: '30 GB' },
  { gb: 40, mb: 40960, label: '40 GB' },
  { gb: 50, mb: 51200, label: '50 GB' },
  { gb: 60, mb: 61440, label: '60 GB' },
  { gb: 70, mb: 71680, label: '70 GB' },
  { gb: 80, mb: 81920, label: '80 GB' },
  { gb: 90, mb: 92160, label: '90 GB' },
  { gb: 100, mb: 102400, label: '100 GB' },
];

const props = defineProps<{
  organization: Organization;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { 
    name: string; 
    bio: string | null; 
    type: OrganizationType; 
    visibility: OrganizationVisibility;
    storage_limit_mb: number;
  }];
}>();

const show = ref(true);
const name = ref('');
const bio = ref('');
const selectedType = ref<TypeOption>(typeOptions[0]!);
const selectedVisibility = ref<VisibilityOption>(visibilityOptions[0]!);
const selectedStorage = ref<StorageOption>(storageOptions[0]!);
const validationError = ref<string | null>(null);

// Initialize form when organization changes
watch(() => props.organization, (org) => {
  name.value = org.name;
  bio.value = org.bio || '';
  
  // Find closest storage option
  const storageMb = org.storage_limit_mb;
  const closestOption = storageOptions.reduce((prev, curr) => {
    return Math.abs(curr.mb - storageMb) < Math.abs(prev.mb - storageMb) ? curr : prev;
  });
  selectedStorage.value = closestOption;
  
  const typeOpt = typeOptions.find(t => t.value === org.type) ?? typeOptions[0]!;
  selectedType.value = typeOpt;
  
  const visOpt = visibilityOptions.find(v => v.value === org.visibility) ?? visibilityOptions[0]!;
  selectedVisibility.value = visOpt;
  
  validationError.value = null;
}, { immediate: true });

function validateForm(): string | null {
  if (!name.value.trim()) {
    return 'Organization name cannot be empty.';
  }

  if (name.value.length > 100) {
    return 'Organization name must be 100 characters or less.';
  }

  if (bio.value.length > 500) {
    return 'Bio must be 500 characters or less.';
  }

  return null;
}

function handleSubmit() {
  validationError.value = validateForm();
  if (validationError.value) return;

  emit('submit', {
    name: name.value.trim(),
    bio: bio.value.trim() || null,
    type: selectedType.value.value,
    visibility: selectedVisibility.value.value,
    storage_limit_mb: selectedStorage.value.mb,
  });
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <TransitionRoot appear :show="show" as="template">
    <Dialog as="div" @close="handleClose" class="relative z-70">
      <!-- Backdrop -->
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      </TransitionChild>

      <!-- Dialog positioning -->
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- Dialog panel -->
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-xl transform overflow-hidden rounded-lg bg-black border border-white/20 text-white shadow-xl transition-all">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-medium">
                  Edit Organization
                </DialogTitle>
                <p class="text-sm text-gray-400 mt-1">
                  Update organization details and settings
                </p>
              </header>

              <!-- Form -->
              <div class="p-4 space-y-4">
                <!-- Name -->
                <div>
                  <label for="org-name" class="block text-sm font-medium mb-1">
                    Name
                  </label>
                  <input
                    id="org-name"
                    v-model="name"
                    type="text"
                    class="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                    placeholder="Organization name"
                  />
                </div>

                <!-- Bio -->
                <div>
                  <label for="org-bio" class="block text-sm font-medium mb-1">
                    Bio
                  </label>
                  <textarea
                    id="org-bio"
                    v-model="bio"
                    rows="3"
                    class="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
                    placeholder="Organization bio (optional)"
                  />
                </div>

                <!-- Type -->
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Type
                  </label>
                  <Listbox v-model="selectedType">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40">
                        <span class="block truncate">{{ selectedType.label }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-5 w-5 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in typeOptions"
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
                                {{ option.label }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-5 w-5" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>
                </div>

                <!-- Visibility -->
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Visibility
                  </label>
                  <Listbox v-model="selectedVisibility">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40">
                        <span class="block truncate">{{ selectedVisibility.label }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-5 w-5 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in visibilityOptions"
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
                                {{ option.label }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-5 w-5" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>
                </div>

                <!-- Storage Limit -->
                <div>
                  <label class="block text-sm font-medium mb-1">
                    Storage Limit
                  </label>
                  <Listbox v-model="selectedStorage">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40">
                        <span class="block truncate">{{ selectedStorage.label }}</span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon icon="carbon:chevron-down" class="h-5 w-5 text-white/40" />
                        </span>
                      </ListboxButton>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 shadow-lg focus:outline-none">
                          <ListboxOption
                            v-for="option in storageOptions"
                            :key="option.mb"
                            :value="option"
                            as="template"
                            v-slot="{ active, selected }"
                          >
                            <li
                              class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                              :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                            >
                              <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                {{ option.label }}
                              </span>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-5 w-5" />
                              </span>
                            </li>
                          </ListboxOption>
                        </ListboxOptions>
                      </transition>
                    </div>
                  </Listbox>
                  <p class="mt-1 text-xs text-white/50">
                    {{ selectedStorage.mb.toLocaleString() }} MB
                  </p>
                </div>

                <!-- Validation Error -->
                <div v-if="validationError" class="text-sm text-red-400">
                  {{ validationError }}
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-between p-4 border-t border-t-white/20">
                <button
                  @click="handleClose"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  @click="handleSubmit"
                  class="px-4 py-2 text-sm rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition"
                >
                  Save Changes
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
</style>
