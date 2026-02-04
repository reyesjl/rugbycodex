<script setup lang="ts">
import type { OrgMember } from "@/modules/orgs/types";

defineProps<{
  member: OrgMember;
  showRole?: boolean; // Optional prop to hide role tag
}>();

function displayName(m: OrgMember) {
  return m.profile.name || m.profile.username || '';
}

function rolePillClass(role: string) {
  // color-coded (700 shades) to blend with dark scheme
  switch (role) {
    case "owner":
      return "border border-purple-700/40 bg-purple-700/20 text-purple-200";
    case "staff":
      return "border border-blue-700/40 bg-blue-700/20 text-blue-200";
    case "manager":
      return "border border-amber-700/40 bg-amber-700/20 text-amber-200";
    case "member":
      return "border border-emerald-700/40 bg-emerald-700/20 text-emerald-200";
    default:
      return "border border-slate-700/40 bg-slate-700/20 text-slate-200";
  }
}
</script>

<template>
  <div
    class="group flex items-center justify-between gap-2 rounded-full px-3 py-1.5 transition border border-white/10 bg-white/0 hover:bg-white/5 w-full"
  >
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-sm text-gray-500 group-hover:text-white transition truncate">
        {{ displayName(member) }}
      </span>
      <span 
        v-if="showRole !== false"
        class="text-[11px] px-2 py-0.5 rounded-full leading-none shrink-0" 
        :class="rolePillClass(member.membership.role)"
      >
        {{ member.membership.role }}
      </span>
    </div>
    
    <!-- Actions slot for menu icon - pushed to the right -->
    <div class="shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>
