<script setup lang="ts">
import MainNav from '@/modules/app/components/MainNav.vue';
import Sidebar from '@/modules/app/components/Sidebar.vue';
import { ref } from 'vue';

const isSidebarOpen = ref(true);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};
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
