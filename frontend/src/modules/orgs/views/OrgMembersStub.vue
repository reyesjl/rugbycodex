<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { orgService } from '@/modules/orgs/services/orgService';
import { profileService } from '@/modules/profiles/services/ProfileService';
import { MEMBERSHIP_ROLES, ROLE_ORDER, type MembershipRole, type ProfileWithMembership } from '@/modules/profiles/types';

const props = defineProps<{ slug?: string | string[] }>();

const normalizedSlug = computed(() => {
  if (!props.slug) return null;
  return Array.isArray(props.slug) ? props.slug[0] : props.slug;
});

const authStore = useAuthStore();
const activeOrgStore = useActiveOrgStore();
const { isAdmin } = storeToRefs(authStore);
const { activeMembership } = storeToRefs(activeOrgStore);

const orgName = ref('');
const orgId = ref<string | null>(null);
const members = ref<ProfileWithMembership[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const savingMemberId = ref<string | null>(null);
const roleError = ref<string | null>(null);
const roleSuccess = ref<string | null>(null);

const formatRole = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const formatJoinDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(date);
const memberHandle = (member: ProfileWithMembership) => member.username ? `@${member.username}` : member.name;

const canManageMembers = computed(() => {
  if (isAdmin.value) return true;
  const role = activeMembership.value?.org_role;
  if (!role) return false;
  const managerOrder = ROLE_ORDER.manager ?? Infinity;
  return (ROLE_ORDER[role] ?? Infinity) <= managerOrder;
});

const loadMembers = async (slug: string) => {
  loading.value = true;
  error.value = null;
  try {
    const org = await orgService.organizations.getBySlug(slug);
    orgName.value = org.name;
    orgId.value = org.id;
    members.value = await profileService.memberships.listByOrganization(org.id);
  } catch (err) {
    members.value = [];
    orgId.value = null;
    error.value = err instanceof Error ? err.message : 'Unable to load members right now.';
  } finally {
    loading.value = false;
  }
};

const handleRoleUpdate = async (member: ProfileWithMembership, nextRole: MembershipRole) => {
  if (!orgId.value) {
    roleError.value = 'Organization not loaded yet.';
    return;
  }
  if (member.org_role === nextRole) {
    return;
  }
  savingMemberId.value = member.id;
  roleError.value = null;
  roleSuccess.value = null;
  try {
    await profileService.memberships.setRole(member.id, orgId.value, nextRole);
    member.org_role = nextRole;
    roleSuccess.value = `${memberHandle(member)} is now ${formatRole(nextRole)}.`;
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : 'Unable to update role right now.';
  } finally {
    savingMemberId.value = null;
  }
};

const handleRoleSelect = (member: ProfileWithMembership, event: unknown) => {
  const target = (event as { target?: { value?: string } } | null)?.target;
  if (!target || typeof target.value !== 'string') return;
  handleRoleUpdate(member, target.value as MembershipRole);
};

watch(
  normalizedSlug,
  (slug) => {
    if (!slug) {
      error.value = 'Organization not found.';
      orgId.value = null;
      members.value = [];
      return;
    }
    loadMembers(slug);
  },
  { immediate: true },
);
</script>

<template>
  <div class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <p class="text-sm uppercase tracking-wide text-white/60">Organization members</p>
      <h1 class="text-3xl font-semibold">
        {{ orgName || 'Members' }}
      </h1>
    </header>

    <div v-if="loading" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading members…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="text-sm text-white/80">Refresh or try another organization.</p>
    </div>

    <section v-else class="space-y-4">
      <div v-if="roleSuccess || roleError" class="space-y-2">
        <p v-if="roleSuccess" class="rounded border border-emerald-400/50 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {{ roleSuccess }}
        </p>
        <p v-if="roleError" class="rounded border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-200">
          {{ roleError }}
        </p>
      </div>

      <ul class="divide-y divide-white/10 rounded border border-white/10">
        <li v-if="members.length === 0" class="py-3 px-4 text-white/60">
          No members yet.
        </li>

        <li
          v-for="member in members"
          :key="member.id"
          class="py-3 px-4"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-semibold">{{ memberHandle(member) }}</p>
              <p class="text-sm text-white/70">
                {{ member.name }} · {{ formatRole(member.org_role) }} · Joined {{ formatJoinDate(member.join_date) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <RouterLink
                class="text-xs uppercase tracking-wide text-white/70 transition hover:text-white"
                :to="member.username
                  ? `/v2/profile/${member.username}`
                  : member.id
                    ? `/v2/profile/${member.id}`
                    : '/v2/profile'"
              >
                View profile
              </RouterLink>
              <div v-if="canManageMembers" class="flex items-center gap-2">
                <label class="text-xs uppercase tracking-wide text-white/50">Role</label>
                <select
                  class="rounded border border-white/30 bg-black/30 px-2 py-1 text-sm text-white"
                  :disabled="savingMemberId === member.id"
                  :value="member.org_role"
                  @change="(event) => handleRoleSelect(member, event)"
                >
                  <option
                    v-for="role in MEMBERSHIP_ROLES"
                    :key="role.value"
                    :value="role.value"
                  >
                    {{ role.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
