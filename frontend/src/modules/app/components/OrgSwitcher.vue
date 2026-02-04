<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore'
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore'
import type { UserOrganizationSummary } from '@/modules/orgs/types'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'

const router = useRouter()

const authStore = useAuthStore()
const userContextStore = useUserContextStore()
const { organizations, hasOrganizations } = storeToRefs(userContextStore)

const activeOrgStore = useActiveOrganizationStore()
const { orgContext } = storeToRefs(activeOrgStore)

const activeOrgId = computed(() => orgContext.value?.organization.id ?? null)

const displayOrg = computed(() => {
  // when on an org route, active will be set
  if (orgContext.value) return orgContext.value

  // fallback:nothing
  return null
})

const handleOrgSelect = async (org: UserOrganizationSummary) => {
  await router.push(`/organizations/${org.organization.slug}`)
}

onMounted(() => {
  void authStore.initializePostAuthContext()
})
</script>

<template>
  <!-- Org switcher -->
  <div class="flex items-center mr-4">
    <Menu as="div" class="relative" v-slot="{ open }">
      <MenuButton
        class="py-2 px-2 flex items-center gap-1 rounded-full hover:bg-white/10 focus:outline-none cursor-pointer"
        aria-label="Organization menu"
      >
        <span class="text-sm truncate max-w-[180px]">
          {{ displayOrg?.organization.name ?? 'Select org' }}
        </span>
        <Icon
          icon="carbon:caret-down"
          width="16"
          height="16"
          class="text-white/70 transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
      </MenuButton>

      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <MenuItems
          class="absolute left-0 mt-2 w-56 rounded-md border border-white/10 bg-black/90 p-2 text-sm focus:outline-none"
        >
          <!-- Org list -->
          <template v-if="hasOrganizations">
            <MenuItem
              v-for="org in organizations"
              :key="org.organization.id"
              v-slot="{ active }"
            >
              <button
                class="flex text-xs cursor-pointer w-full items-center justify-between gap-3 rounded px-3 py-2 border border-transparent transition text-white"
                :class="[
                  activeOrgId === org.organization.id 
                    ? 'border-green-500/50 bg-green-500/20' 
                    : active 
                      ? 'bg-white/15' 
                      : ''
                ]"
                @click="handleOrgSelect(org)"
              >
                <span class="truncate">{{ org.organization.name }}</span>
                <Icon
                  v-if="activeOrgId === org.organization.id"
                  icon="carbon:checkmark"
                  width="16"
                  height="16"
                  class="shrink-0 text-white/70"
                  aria-label="Active organization"
                />
              </button>
            </MenuItem>

            <hr class="my-2 border-white/20" />
          </template>

          <MenuItem v-slot="{ active }">
            <RouterLink
              to="/organizations"
              class="text-xs flex items-center rounded px-3 py-2 transition text-white"
              :class="active ? 'bg-white/15' : ''"
            >
              <Icon icon="carbon:group-presentation" width="15" height="15" class="mr-2" />
              All Organizations
            </RouterLink>
          </MenuItem>

          <MenuItem v-slot="{ active }">
            <RouterLink
              to="/organizations/create"
              class="text-xs flex items-center rounded px-3 py-2 transition text-white"
              :class="active ? 'bg-white/15' : ''"
            >
              <Icon icon="carbon:add" width="15" height="15" class="mr-2" />
              New Organization
            </RouterLink>
          </MenuItem>

          <hr class="my-2 border-white/20" />

          <MenuItem v-slot="{ active }">
            <RouterLink
              to="/"
              class="text-xs flex items-center rounded px-3 py-2 transition text-white"
              :class="active ? 'bg-white/15' : ''"
            >
              <Icon icon="carbon:home" width="15" height="15" class="mr-2" />
              Back to Home
            </RouterLink>
          </MenuItem>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>
