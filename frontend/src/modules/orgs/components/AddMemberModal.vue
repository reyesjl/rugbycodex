<script lang="ts" setup>
import { ref } from 'vue';
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

const emit = defineEmits<{
  close: [];
  submit: [payload: { username: string; role: 'member' | 'staff' | 'manager' | 'owner' }];
}>();

type RoleOption = {
  value: 'member' | 'staff' | 'manager' | 'owner';
  name: string;
};

const roleOptions: RoleOption[] = [
  { value: 'member', name: 'Member' },
  { value: 'staff', name: 'Staff' },
  { value: 'manager', name: 'Manager' },
  { value: 'owner', name: 'Owner' },
];

const show = ref(true);
const username = ref('');
const selectedRole = ref<RoleOption>(roleOptions[0]!);
const error = ref<string | null>(null);

const handleClose = () => {
  emit('close');
};

const submit = () => {
  if (!username.value.trim()) {
    error.value = "Please enter a username.";
    return;
  }

  error.value = null;
  emit('submit', { username: username.value.trim(), role: selectedRole.value.value });
};
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
            <!-- Header -->
            <header class="p-4 border-b border-b-white/20">
              <DialogTitle as="h2">Add member</DialogTitle>
              <p class="text-sm text-gray-400">Add a new member to your organization.</p>
            </header>

            <!-- Input section -->
            <div class="p-4 space-y-4">
              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm" for="username">Username</label>
                </div>
                <div class="col-span-8">
                  <input
                    id="username"
                    v-model="username"
                    class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                <div class="col-span-4">
                  <label class="text-sm">Role</label>
                </div>
                <div class="col-span-8">
                  <Listbox v-model="selectedRole">
                    <div class="relative">
                      <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 text-left text-sm focus:border-white outline-none">
                        <span class="block truncate">{{ selectedRole.name }}</span>
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
                            v-for="option in roleOptions"
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

              <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
            </div>

            <div class="flex justify-between p-4 border-t border-t-white/20">
              <!-- Submit and cancel buttons -->
              <button
                @click="handleClose"
                class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                @click="submit"
                class="px-4 py-2 text-sm rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition"
              >
                Add
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
