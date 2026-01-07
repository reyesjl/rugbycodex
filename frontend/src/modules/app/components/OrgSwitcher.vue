<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore'
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore'
import type { UserOrganizationSummary } from '@/modules/orgs/types'
import { useAuthStore } from '@/auth/stores/useAuthStore'

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const myOrgStore = useMyOrganizationsStore()
const { items, hasOrganizations } = storeToRefs(myOrgStore)

const activeOrgStore = useActiveOrganizationStore()
const { orgContext } = storeToRefs(activeOrgStore)

const activeOrgId = computed(() => orgContext.value?.organization.id ?? null)

const displayOrg = computed(() => {
  // when on an org route, active will be set
  if (orgContext.value) return orgContext.value

  // fallback:nothing
  return null
})

const orgMenuOpen = ref(false)
const orgMenuRef = ref<HTMLElement | null>(null)
const orgButtonRef = ref<HTMLElement | null>(null)

const closeOrgMenu = () => (orgMenuOpen.value = false)
const toggleOrgMenu = () => (orgMenuOpen.value = !orgMenuOpen.value)

const handleClickOutside = (event: MouseEvent) => {
  if (!orgMenuOpen.value) return
  const target = event.target as Node | null
  if (orgButtonRef.value?.contains(target) || orgMenuRef.value?.contains(target)) return
  closeOrgMenu()
}

const handleOrgSelect = async (org: UserOrganizationSummary) => {
  closeOrgMenu()
  await router.push(`/organizations/${org.organization.slug}`)
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    myOrgStore.load()
  }
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(
  () => route.fullPath,
  closeOrgMenu
)
</script>


<template>
  <!-- Org switcher -->
  <div class="flex items-center mr-4">
    <div class="text-sm mr-1 truncate max-w-[180px]">
      {{ displayOrg?.organization.name ?? 'Select org' }}
    </div>

    <div class="relative">
      <button
        ref="orgButtonRef"
        type="button"
        class="py-2 px-1 flex items-center rounded-full hover:bg-white/10 focus:outline-none cursor-pointer"
        @click.stop="toggleOrgMenu"
        aria-label="Organization menu"
      >
        <Icon
          icon="carbon:caret-down"
          width="16"
          height="16"
          class="text-white/70 transition-transform"
          :class="orgMenuOpen ? 'rotate-180' : ''"
        />
      </button>

      <transition name="fade">
        <div
          v-if="orgMenuOpen"
          ref="orgMenuRef"
          class="absolute left-0 mt-2 w-56 rounded-md border border-white/20 bg-black p-2 text-sm shadow-2xl"
        >
          <!-- Org list -->
          <template v-if="hasOrganizations">
            <button
              v-for="org in items"
              :key="org.organization.id"
              class="flex text-xs cursor-pointer w-full items-center justify-between gap-3 rounded px-3 py-2 border border-transparent"
              :class="activeOrgId === org.organization.id ? 'border-green-500 bg-green-500/30 hover:bg-green-700/70' : 'hover:bg-white/10'"
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

            <hr class="my-2 border-white/20" />
          </template>

          <RouterLink
            to="/organizations"
            class="text-xs flex items-center rounded px-3 py-2 hover:bg-white/10"
            @click="closeOrgMenu"
          >
            <Icon icon="carbon:group-presentation" width="15" height="15" class="mr-2" />
            All Organizations
          </RouterLink>

          <RouterLink
            to="/organizations/create"
            class="text-xs flex items-center rounded px-3 py-2 hover:bg-white/10"
            @click="closeOrgMenu"
          >
            <Icon icon="carbon:add" width="15" height="15" class="mr-2" />
            New Organization
          </RouterLink>

          <hr class="my-2 border-white/20" />

          <RouterLink
            to="/"
            class="text-xs flex items-center rounded px-3 py-2 hover:bg-white/10"
            @click="closeOrgMenu"
          >
            <Icon icon="carbon:home" width="15" height="15" class="mr-2" />
            Back to Home
          </RouterLink>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>