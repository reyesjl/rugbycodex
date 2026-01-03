<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import MainNav from '@/modules/app/components/MainNav.vue'
import Sidebar from '@/modules/app/components/Sidebar.vue'
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore'

const isSidebarOpen = ref(true)
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const activeOrgStore = useActiveOrganizationStore()
const { resolving } = storeToRefs(activeOrgStore)
</script>

<template>
  <div class="min-h-screen bg-black">
    <MainNav @toggle-sidebar="toggleSidebar" />

    <Sidebar
      v-if="!resolving"
      :is-open="isSidebarOpen"
      @toggle-sidebar="toggleSidebar"
    />

    <main
      class="pt-[var(--main-nav-height)] transition-all duration-300"
      :class="[isSidebarOpen ? 'pl-64' : 'pl-0']"
    >
      <div v-if="resolving" class="p-6 text-white">
        Loading organization…
      </div>

      <RouterView v-else />
    </main>
  </div>
</template>

