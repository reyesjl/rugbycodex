<script setup lang="ts">
import { computed, ref } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem, Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { OrgMember } from '@/modules/orgs/types';

const props = defineProps<{
  member: OrgMember;
  currentUserRole: 'owner' | 'manager' | 'staff' | 'member';
  currentUserId: string;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  promote: [{ memberId: string; newRole: 'owner' | 'manager' | 'staff' | 'member' }];
  demote: [{ memberId: string; newRole: 'owner' | 'manager' | 'staff' | 'member' }];
  remove: [{ memberId: string }];
}>();

const showRemoveDialog = ref(false);
const isLoading = ref(false);

// Role hierarchy (lower number = more power)
const ROLE_RANK = {
  owner: 0,
  manager: 1,
  staff: 2,
  member: 3,
} as const;

// Check if current user can promote this member
const canPromote = computed(() => {
  if (props.isAdmin) return true;
  if (props.currentUserId === props.member.profile.id) return false; // Can't promote self

  const myRank = ROLE_RANK[props.currentUserRole];
  const theirRank = ROLE_RANK[props.member.membership.role as keyof typeof ROLE_RANK];
  const nextRank = theirRank - 1; // Promote = decrease rank number

  // Can promote if they're not at max AND result won't exceed my rank
  return theirRank > 0 && nextRank > myRank;
});

// Check if current user can demote this member
const canDemote = computed(() => {
  if (props.isAdmin) return true;
  if (props.currentUserId === props.member.profile.id) return false; // Can't demote self

  const myRank = ROLE_RANK[props.currentUserRole];
  const theirRank = ROLE_RANK[props.member.membership.role as keyof typeof ROLE_RANK];

  // Can demote if they're not at minimum AND they're below my rank
  return theirRank < 3 && theirRank > myRank;
});

// Check if current user can remove this member
const canRemove = computed(() => {
  if (props.isAdmin) return true;
  if (props.currentUserId === props.member.profile.id) return false; // Can't remove self

  const myRank = ROLE_RANK[props.currentUserRole];
  const theirRank = ROLE_RANK[props.member.membership.role as keyof typeof ROLE_RANK];

  // Can remove if I'm staff+ AND they're below or equal to my rank
  return myRank <= 2 && theirRank > myRank;
});

// Calculate next role up (for promote)
const nextRoleUp = computed(() => {
  const role = props.member.membership.role;
  if (role === 'member') return 'staff';
  if (role === 'staff') return 'manager';
  if (role === 'manager') return 'owner';
  return null;
});

// Calculate next role down (for demote)
const nextRoleDown = computed(() => {
  const role = props.member.membership.role;
  if (role === 'owner') return 'manager';
  if (role === 'manager') return 'staff';
  if (role === 'staff') return 'member';
  return null;
});

// Show menu only if user has any permissions
const showMenu = computed(() => {
  return canPromote.value || canDemote.value || canRemove.value;
});

function handlePromote() {
  if (!canPromote.value || !nextRoleUp.value) return;
  isLoading.value = true;
  emit('promote', { 
    memberId: props.member.profile.id, 
    newRole: nextRoleUp.value 
  });
  // Parent will handle resetting loading state via member list refresh
}

function handleDemote() {
  if (!canDemote.value || !nextRoleDown.value) return;
  isLoading.value = true;
  emit('demote', { 
    memberId: props.member.profile.id, 
    newRole: nextRoleDown.value 
  });
}

function openRemoveDialog() {
  showRemoveDialog.value = true;
}

function closeRemoveDialog() {
  showRemoveDialog.value = false;
}

function handleRemove() {
  if (!canRemove.value) return;
  isLoading.value = true;
  emit('remove', { memberId: props.member.profile.id });
  showRemoveDialog.value = false;
}
</script>

<template>
  <div v-if="showMenu">
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
        <!-- Promote Option -->
        <MenuItem v-if="canPromote" v-slot="{ active }">
          <button
            class="flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition"
            :class="active ? 'bg-white/10 text-white' : 'text-gray-300'"
            @click="handlePromote"
          >
            <Icon icon="carbon:arrow-up" width="16" height="16" />
            <span>Promote to {{ nextRoleUp }}</span>
          </button>
        </MenuItem>

        <!-- Demote Option -->
        <MenuItem v-if="canDemote" v-slot="{ active }">
          <button
            class="flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition"
            :class="active ? 'bg-white/10 text-white' : 'text-gray-300'"
            @click="handleDemote"
          >
            <Icon icon="carbon:arrow-down" width="16" height="16" />
            <span>Demote to {{ nextRoleDown }}</span>
          </button>
        </MenuItem>

        <!-- Divider if both promote/demote and remove exist -->
        <div 
          v-if="(canPromote || canDemote) && canRemove" 
          class="my-1 border-t border-white/10"
        />

        <!-- Remove Option -->
        <MenuItem v-if="canRemove" v-slot="{ active }">
          <button
            class="flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition"
            :class="active ? 'bg-red-500/20 text-red-300' : 'text-red-400'"
            @click="openRemoveDialog"
          >
            <Icon icon="carbon:trash-can" width="16" height="16" />
            <span>Remove from org</span>
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
              <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-lg bg-black border border-white/20 text-white shadow-xl transition-all">
                <!-- Header -->
                <header class="p-4 border-b border-b-white/20">
                  <DialogTitle as="h2" class="text-lg font-medium">
                    Remove Member
                  </DialogTitle>
                  <p class="text-sm text-gray-400 mt-1">
                    Are you sure you want to remove <strong>{{ member.profile.username }}</strong> from this organization? This action cannot be undone.
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

<style scoped>
/* Headless UI handles most styling, minimal overrides needed */
</style>
