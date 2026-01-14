<script setup lang="ts">
import type { OrgMember } from '@/modules/orgs/types';
import { Icon } from '@iconify/vue';

defineProps<{
  member: OrgMember;
  canManage: boolean;
}>();

const emit = defineEmits<{
  remove: [];
}>();

function displayName(m: OrgMember) {
  return m.profile.username || m.profile.name;
}

function rolePillClass(role: string) {
  switch (role) {
    case 'owner':
      return 'border border-purple-700/40 bg-purple-700/20 text-purple-200';
    case 'staff':
      return 'border border-blue-700/40 bg-blue-700/20 text-blue-200';
    case 'manager':
      return 'border border-amber-700/40 bg-amber-700/20 text-amber-200';
    case 'member':
      return 'border border-emerald-700/40 bg-emerald-700/20 text-emerald-200';
    default:
      return 'border border-slate-700/40 bg-slate-700/20 text-slate-200';
  }
}
</script>

<template>
  <div class="group flex items-center gap-2 rounded-full px-3 py-1.5 border border-white/10 bg-white/0 hover:bg-white/5 transition">
    <span class="text-sm text-gray-500 group-hover:text-white transition">
      {{ displayName(member) }}
    </span>

    <span class="text-[11px] px-2 py-0.5 rounded-full leading-none" :class="rolePillClass(member.membership.role)">
      {{ member.membership.role }}
    </span>

    <button
      v-if="canManage"
      type="button"
      class="ml-1 inline-flex items-center justify-center rounded-full h-6 w-6 border border-white/15 bg-white/5 hover:bg-white/10 transition"
      title="Remove"
      @click.stop="emit('remove')"
    >
      <Icon icon="carbon:close" width="14" height="14" />
    </button>
  </div>
</template>
