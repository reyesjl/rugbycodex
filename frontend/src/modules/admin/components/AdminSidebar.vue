<script setup lang="ts">
import { toRef } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import { useSidebarGestures } from '@/modules/app/composables/useSidebarGestures';

const props = defineProps<{
  isOpen: boolean;
}>();
const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const adminLinks = [
  { to: '/admin/', label: 'Organizations', icon: 'carbon:group-presentation' },
  { to: '/admin/org-requests', label: 'New Org Requests', icon: 'carbon:notification-new' }, 
  { to: '/admin/users', label: 'Users', icon: 'carbon:user-multiple' },
  { to: '/admin/narrations', label: 'Narrations Moderation', icon: 'carbon:microphone' },
  { to: '/admin/media', label: 'Media Review', icon: 'carbon:image-search' },
  { to: '/admin/jobs', label: 'Jobs / Pipelines', icon: 'carbon:flow' },
  { to: '/admin/billing', label: 'Billing / Metering', icon: 'carbon:finance' },
  { to: '/admin/flags', label: 'Feature Flags', icon: 'carbon:flag' },
  { to: '/admin/experiments', label: 'Experiments', icon: 'carbon:chemistry' },
  { to: '/profile', label: 'Profile', icon: 'carbon:user-profile' },
];

const handleSidebarToggle = () => emit('toggle-sidebar');

const {
  mobileSheetRef,
  sheetStyle,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onEdgePointerDown,
  onEdgePointerMove,
  onEdgePointerUp,
} = useSidebarGestures({
  isOpen: toRef(props, 'isOpen'),
  onToggle: handleSidebarToggle,
});

</script>

<template>
  <!-- MOBILE OVERLAY -->
  <div
    v-if="isOpen"
    class="md:hidden fixed inset-0 bg-black/60 z-40"
    @click="handleSidebarToggle"
  />

  <!-- DESKTOP SIDEBAR -->
  <div
    class="
      hidden md:block
      overflow-y-auto fixed
      top-[var(--main-nav-height)] left-0
      text-white backdrop-blur bg-black/30
      w-64 h-full z-50 border-r border-white/30
      transition-transform duration-300
    "
    :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
  >
    <div class="container-lg h-full py-5">
      <nav class="sidebar">
        <ul class="sidebar-list">
          <li class="mb-6">
            <div class="flex justify-between items-center">
              <div class="text-lg select-none px-4">
                RUGBY<span class="font-semibold">CODEX</span>
              </div>

              <button
                type="button"
                class="flex items-center px-2 py-2 rounded hover:bg-white/10"
                @click="handleSidebarToggle"
              >
                <Icon icon="carbon:side-panel-close" width="20" height="20" />
              </button>
            </div>
          </li>

          <li>
            <RouterLink
              to="/dashboard"
              class="flex w-full items-center rounded px-4 py-2 hover:bg-white/10"
            >
              <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5" />
              Back to Dashboard
            </RouterLink>
          </li>

          <li class="pt-4 pb-2 px-4 text-xs uppercase tracking-wide text-white/60">
            Admin Console
          </li>

          <li v-for="link in adminLinks" :key="link.to">
            <RouterLink
              :to="link.to"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
            >
              <Icon :icon="link.icon" width="20" height="20" class="mr-5" />
              {{ link.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>
  </div>

  <!-- MOBILE EDGE SWIPE ZONE -->
  <div
    v-if="!isOpen"
    class="md:hidden fixed bottom-0 left-0 w-full h-6 z-40"
    style="touch-action: none;"
    @pointerdown="onEdgePointerDown"
    @pointermove="onEdgePointerMove"
    @pointerup="onEdgePointerUp"
    @pointercancel="onEdgePointerUp"
  />

  <!-- MOBILE BOTTOM SHEET -->
  <div
    class="
      md:hidden
      fixed left-0 bottom-0
      w-full
      h-[80vh]
      z-50
      backdrop-blur bg-black/80
      border-t border-white/20
      rounded-t-2xl
      text-white
      transition-transform duration-300
    "
    :class="[ isOpen ? 'translate-y-0' : 'translate-y-full' ]"
    :style="sheetStyle"
    ref="mobileSheetRef"
  >
    <div class="p-4 h-full flex flex-col">
      <div
        class="pb-6"
        style="touch-action: none;"
        @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove"
        @pointerup="onHandlePointerUp"
        @pointercancel="onHandlePointerUp"
      >
        <div class="w-10 h-1.5 bg-white/30 rounded-full mx-auto mb-3" />
        <div class="flex items-center justify-between text-lg select-none px-4">
          <div>RUGBY<span class="font-semibold">CODEX</span></div>
          <button type="button" data-no-drag @click="handleSidebarToggle">
            <Icon icon="carbon:close" width="22" />
          </button>
        </div>
      </div>

      <div class="overflow-y-auto flex-1 px-2">
        <nav class="sidebar">
          <ul class="sidebar-list">
            <li>
              <RouterLink
                to="/dashboard"
                class="flex w-full items-center rounded px-4 py-2 hover:bg-white/10"
                @click="handleSidebarToggle"
              >
                <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5" />
                Back to Dashboard
              </RouterLink>
            </li>

            <li class="pt-4 pb-2 px-4 text-xs uppercase tracking-wide text-white/60">
              Admin Console
            </li>

            <li v-for="link in adminLinks" :key="link.to">
              <RouterLink
                :to="link.to"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                @click="handleSidebarToggle"
              >
                <Icon :icon="link.icon" width="20" height="20" class="mr-5" />
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>
