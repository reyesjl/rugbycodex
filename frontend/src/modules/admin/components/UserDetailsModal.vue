<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import type { AdminUserListItem, UserOrgMembership } from '@/modules/profiles/types';

interface Props {
  show: boolean;
  user: AdminUserListItem | null;
  organizations: UserOrgMembership[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const handleClose = () => {
  emit('close');
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatXP = (xp: number) => {
  return xp.toLocaleString();
};

const roleBadgeClass = (role: string) => {
  if (role === 'admin') {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
};

const orgTypeBadgeClass = (type: string) => {
  if (type === 'team') {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
};

const memberRoleBadgeClass = (role: string) => {
  switch(role.toLowerCase()) {
    case 'owner':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'admin':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-white/10 text-white/60 border-white/20';
  }
};

const hasOrganizations = computed(() => props.organizations.length > 0);
</script>

<template>
  <TransitionRoot :show="show" as="template">
    <Dialog as="div" class="relative z-70" @close="handleClose">
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

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-3xl text-white my-8">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-semibold">
                  User Details
                </DialogTitle>
              </header>

              <!-- Body -->
              <div v-if="user" class="p-4 space-y-6">
                <!-- Profile Info -->
                <div class="space-y-4">
                  <div class="flex items-start gap-3">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <h4 class="text-xl font-semibold text-white">{{ user.name }}</h4>
                        <Icon v-if="user.role === 'admin'" icon="carbon:user-admin" class="h-5 w-5 text-purple-400" />
                      </div>
                      <div class="text-sm text-white/60">@{{ user.username }}</div>
                    </div>
                    <span
                      class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                      :class="roleBadgeClass(user.role)"
                    >
                      {{ user.role }}
                    </span>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">XP</div>
                      <div class="text-sm text-white/70">{{ formatXP(user.xp) }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Joined</div>
                      <div class="text-sm text-white/70">{{ formatDate(user.creation_time) }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Primary Organization</div>
                      <div class="text-sm text-white/70">{{ user.primary_org_name || 'None' }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Organizations</div>
                      <div class="text-sm text-white/70">{{ user.org_membership_count }} membership{{ user.org_membership_count !== 1 ? 's' : '' }}</div>
                    </div>
                  </div>
                </div>

                <!-- Organization Memberships -->
                <div v-if="hasOrganizations" class="border-t border-white/10 pt-4">
                  <div class="text-sm font-semibold text-white mb-3">Organization Memberships</div>
                  <div class="space-y-2">
                    <div
                      v-for="org in organizations"
                      :key="org.org_id"
                      class="rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm font-semibold text-white truncate">{{ org.org_name }}</span>
                            <span
                              class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide shrink-0"
                              :class="orgTypeBadgeClass(org.org_type)"
                            >
                              {{ org.org_type }}
                            </span>
                          </div>
                          <div class="text-xs text-white/50">@{{ org.org_slug }}</div>
                        </div>
                        <span
                          class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide shrink-0"
                          :class="memberRoleBadgeClass(org.member_role)"
                        >
                          {{ org.member_role }}
                        </span>
                      </div>
                      <div class="mt-2 text-xs text-white/45">
                        Joined {{ formatDate(org.joined_at) }}
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="border-t border-white/10 pt-4 text-center text-sm text-white/50">
                  Not a member of any organizations
                </div>

                <!-- Internal IDs -->
                <div class="border-t border-white/10 pt-4">
                  <div class="text-xs text-white/50 uppercase tracking-wider mb-2">Internal IDs</div>
                  <div class="grid gap-2 text-xs text-white/60">
                    <div class="flex justify-between">
                      <span class="text-white/40">User ID:</span>
                      <span class="font-mono">{{ user.id }}</span>
                    </div>
                    <div v-if="user.primary_org" class="flex justify-between">
                      <span class="text-white/40">Primary Org ID:</span>
                      <span class="font-mono">{{ user.primary_org }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-end p-4 border-t border-t-white/20 gap-3">
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                  @click="handleClose"
                >
                  Close
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
