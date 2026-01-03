<script setup lang="ts">
import { ref } from 'vue';
import MainNav from '@/modules/app/components/MainNav.vue';
import AdminSidebar from '@/modules/admin/components/AdminSidebar.vue';

const isSidebarOpen = ref(false);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};
</script>

<template>
  <div class="min-h-screen bg-black">
    <MainNav @toggle-sidebar="toggleSidebar" />

    <AdminSidebar :is-open="isSidebarOpen" @toggle-sidebar="toggleSidebar" />

    <main
      class="pt-[var(--main-nav-height)]"
      :class="[ isSidebarOpen ? 'md:pl-64' : 'pl-0', 'transition-all duration-300']"
    >
      <RouterView />
    </main>
  </div>
</template>
