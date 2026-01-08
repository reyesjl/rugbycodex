<script setup lang="ts">
import MainNav from '@/modules/app/components/MainNav.vue';
import Sidebar from '@/modules/app/components/Sidebar.vue';
import { storeToRefs } from 'pinia';
import { useSidebarStore } from '@/stores/useSidebarStore';

const sidebarStore = useSidebarStore();
const { isOpen: isSidebarOpen } = storeToRefs(sidebarStore);
const toggleSidebar = () => sidebarStore.toggle();
</script>

<template>
  <div class="min-h-screen bg-black">
    <MainNav @toggle-sidebar="toggleSidebar" />

    
    <Sidebar :is-open="isSidebarOpen" @toggle-sidebar="toggleSidebar" />

    <main 
    class="pt-(--main-nav-height)"
    :class="[ isSidebarOpen ? 'md:pl-64' : 'pl-0', 'transition-all duration-300']">
      <RouterView />
    </main>
  </div>
</template>
