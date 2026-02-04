<script setup lang="ts">
import { ref } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem, Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { OrgMember } from '@/modules/orgs/types';

const props = defineProps<{
  member: OrgMember;
  groupId: string;
  groupName: string;
}>();

const emit = defineEmits<{
  remove: [{ groupId: string; userId: string }];
}>();

const showRemoveDialog = ref(false);
const isLoading = ref(false);

function openRemoveDialog() {
  showRemoveDialog.value = true;
}

function closeRemoveDialog() {
  showRemoveDialog.value = false;
}

function handleRemove() {
  isLoading.value = true;
  emit('remove', { 
    groupId: props.groupId, 
    userId: props.member.profile.id 
  });
  showRemoveDialog.value = false;
  // Parent will handle loading reset via list refresh
}

function displayName(m: OrgMember) {
  return m.profile.name || m.profile.username || 'Unknown';
}
</script>

<template>
  <div>
    <!-- Action Menu -->
    <Menu as="div" class="relative">
      <MenuButton
        class="flex items-center justify-center p-1 rounded hover:bg-white/10 transition"
        :disabled="isLoading"
        @click.stop
      >
        <Icon 
          icon="carbon:overflow-menu-vertical" 
          class="text-gray-400 hover:text-white transition" 
          width="16" 
          height="16" 
        />
      </MenuButton>

      <MenuItems
        class="absolute right-0 origin-top-right mt-2 w-56 rounded-lg bg-zinc-800 border border-white/10 shadow-xl z-50 py-1 focus:outline-none"
      >
        <!-- Remove Option -->
        <MenuItem v-slot="{ active }">
          <button
            class="flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition"
            :class="active ? 'bg-red-500/20 text-red-300' : 'text-red-400'"
            @click="openRemoveDialog"
          >
            <Icon icon="carbon:trash-can" width="16" height="16" />
            <span>Remove from group</span>
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>

    <!-- Remove Confirmation Dialog -->
    <TransitionRoot appear :show="showRemoveDialog" as="template">
      <Dialog as="div" @close="closeRemoveDialog" class="relative z-[70]">
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
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-lg bg-black border border-white/20 text-white shadow-xl transition-all my-8">
                <!-- Header -->
                <header class="p-4 border-b border-b-white/20">
                  <DialogTitle as="h2" class="text-lg font-medium">
                    Remove from {{ groupName }}
                  </DialogTitle>
                  <p class="text-sm text-gray-400 mt-1">
                    Are you sure you want to remove <strong>{{ displayName(member) }}</strong> from this group? They will remain in the organization.
                  </p>
                </header>

                <!-- Footer -->
                <div class="flex justify-end gap-3 p-4">
                  <button
                    @click="closeRemoveDialog"
                    class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                    :disabled="isLoading"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleRemove"
                    class="px-4 py-2 text-sm rounded-lg border border-red-500 bg-red-500/70 hover:bg-red-700/70 transition"
                    :disabled="isLoading"
                  >
                    <span v-if="isLoading">Removing...</span>
                    <span v-else>Remove</span>
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>
