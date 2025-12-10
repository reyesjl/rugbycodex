<script setup lang="ts">
import MainNav from '@/modules/app/components/MainNav.vue';
import OrgSidebar from '@/modules/orgs/components/OrgSidebar.vue';
import { ref } from 'vue';

const isSidebarOpen = ref(true);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};
</script>

<template>
  <div class="min-h-screen bg-black">
    <MainNav @toggle-sidebar="toggleSidebar" />

    
    <OrgSidebar :is-open="isSidebarOpen" @toggle-sidebar="toggleSidebar" />

    <main 
    class="pt-[var(--main-nav-height)]"
    :class="[ isSidebarOpen ? 'pl-64' : 'pl-0', 'transition-all duration-300']">
      <RouterView />
    </main>
  </div>
</template>
