<script lang="ts" setup>
import { ref, watch, onMounted, computed } from 'vue';
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
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue';
import { useDebounceFn } from '@vueuse/core';
import { userSearchService, type SearchableUser } from '@/modules/profiles/services/userSearchService';

const props = defineProps<{
  orgId: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { userId: string; role: 'member' | 'staff' | 'manager' | 'owner' }];
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
const query = ref('');
const selectedUser = ref<SearchableUser | null>(null);
const selectedRole = ref<RoleOption>(roleOptions[0]!);
const searchResults = ref<SearchableUser[]>([]);
const isSearching = ref(false);
const error = ref<string | null>(null);

const displayValue = (user: unknown) => {
  const u = user as SearchableUser | null;
  if (!u) return '';
  return u.name || u.username;
};

const performSearch = async (searchQuery: string) => {
  isSearching.value = true;
  error.value = null;
  try {
    searchResults.value = await userSearchService.searchUsersForOrg(
      props.orgId,
      searchQuery
    );
  } catch (err) {
    console.error('Search failed:', err);
    error.value = err instanceof Error ? err.message : 'Failed to search users';
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

// Debounce search to avoid hammering server
const debouncedSearch = useDebounceFn(performSearch, 300);

watch(query, (newQuery) => {
  // Search if 2+ characters OR empty (load recent users)
  if (newQuery.length >= 2 || newQuery.length === 0) {
    debouncedSearch(newQuery);
  } else if (newQuery.length === 1) {
    // Clear results when only 1 character
    searchResults.value = [];
  }
});

// Load initial suggestions (recent users) on mount
onMounted(() => {
  performSearch('');
});

const handleClose = () => {
  emit('close');
};

const submit = () => {
  if (!selectedUser.value) {
    error.value = "Please search and select a user.";
    return;
  }

  error.value = null;
  emit('submit', { 
    userId: selectedUser.value.id, 
    role: selectedRole.value.value 
  });
};

const filteredResults = computed(() => {
  // If no query and no search happening, show all results
  if (query.value === '' && !isSearching.value) {
    return searchResults.value;
  }
  return searchResults.value;
});

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
                  <label class="text-sm">User</label>
                </div>
                <div class="col-span-8">
                  <Combobox v-model="selectedUser" nullable>
                    <div class="relative">
                      <div class="relative">
                        <ComboboxInput
                          :displayValue="displayValue"
                          @change="query = $event.target.value"
                          placeholder="Search by name or username..."
                          class="w-full rounded bg-white/10 border border-white/20 px-3 py-1.5 pr-10 text-sm focus:border-white outline-none"
                        />
                        <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                          <Icon 
                            icon="carbon:chevron-down" 
                            class="h-4 w-4 text-white/40" 
                            aria-hidden="true" 
                          />
                        </ComboboxButton>
                      </div>
                      
                      <transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ComboboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                          <!-- Loading state -->
                          <div v-if="isSearching" class="px-3 py-2 text-white/50 text-xs">
                            <Icon icon="carbon:circle-dash" class="inline animate-spin mr-2" />
                            Searching...
                          </div>
                          
                          <!-- Empty state -->
                          <div v-else-if="filteredResults.length === 0 && query.length >= 2" class="px-3 py-2 text-white/50 text-xs">
                            No users found
                          </div>
                          
                          <!-- Hint when query too short -->
                          <div v-else-if="query.length === 1" class="px-3 py-2 text-white/40 text-xs">
                            Type at least 2 characters to search...
                          </div>
                          
                          <!-- Results -->
                          <ComboboxOption
                            v-else
                            v-for="user in filteredResults"
                            :key="user.id"
                            :value="user"
                            as="template"
                            v-slot="{ active, selected }"
                          >
                            <li
                              class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                              :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                            >
                              <div class="flex flex-col">
                                <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                  {{ user.name }}
                                </span>
                                <span class="text-xs text-white/50">@{{ user.username }}</span>
                              </div>
                              <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                <Icon icon="carbon:checkmark" class="h-4 w-4" />
                              </span>
                            </li>
                          </ComboboxOption>
                        </ComboboxOptions>
                      </transition>
                    </div>
                  </Combobox>
                  <p v-if="query.length === 0 && !isSearching && filteredResults.length > 0" class="text-xs text-white/40 mt-1">
                    Showing recent users. Type to search.
                  </p>
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
