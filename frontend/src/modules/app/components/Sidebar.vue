<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink, useRoute } from 'vue-router';
import { isPlatformAdmin } from "@/modules/auth/identity";
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { storeToRefs } from 'pinia';
import { useSidebarGestures } from '@/modules/app/composables/useSidebarGestures';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => emit('toggle-sidebar');

const authStore = useAuthStore();
const activeOrgStore = useActiveOrganizationStore();
const route = useRoute();
const { orgContext, hasActiveOrg } = storeToRefs(activeOrgStore);

const canManageOrgTools = computed(() => {
  if (authStore.isAdmin) return true;
  const role = orgContext.value?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const isFeedRouteActive = computed(() => {
  return route.name === 'OrgFeed' || route.name === 'OrgFeedView';
});

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

void mobileSheetRef.value;
</script>

<template>
  <!-- MOBILE OVERLAY -->
  <div v-if="isOpen" class="md:hidden fixed inset-0
    bg-black/60 z-40" @click="handleSidebarToggle" />

  <!-- DESKTOP SIDEBAR -->
  <div class="
      hidden md:block
      overflow-y-auto fixed
      top-(--main-nav-height) left-0
      text-white backdrop-blur bg-black/30
      w-64 h-full z-50 border-r border-white/30
      transition-transform duration-300
    " :class="[isOpen ? 'translate-x-0' : '-translate-x-full']">
    <div class="container-lg h-full py-5">
      <nav class="sidebar">
        <ul class="sidebar-list">
          <li class="mb-6">
            <div class="flex justify-between items-center">
              <div class="text-lg select-none px-4">
                RUGBY<span class="font-semibold">CODEX</span>
              </div>

              <button type="button" class="flex items-center px-2 py-2 rounded hover:bg-white/10"
                @click="handleSidebarToggle">
                <Icon icon="carbon:side-panel-close" width="20" height="20" />
              </button>
            </div>
          </li>

          <template v-if="hasActiveOrg">
            <li v-if="canManageOrgTools">
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/assignments`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:task" width="20" height="20" class="mr-5" />
                Assignments
              </RouterLink>
            </li>
            <li v-if="canManageOrgTools">
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/media`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:image" width="20" height="20" class="mr-5" />
                Media
              </RouterLink>
            </li>
            <li v-if="canManageOrgTools">
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/groups`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:group" width="20" height="20" class="mr-5" />
                Groups
              </RouterLink>
            </li>
            <li v-if="canManageOrgTools">
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/usage`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:meter" width="20" height="20" class="mr-5" />
                Usage
              </RouterLink>
            </li>
            <li v-if="canManageOrgTools" class="my-3 border-t border-white/10" />
            <li>
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/feed`"
                :class="[
                  'flex items-center px-4 py-2 rounded',
                  isFeedRouteActive ? 'bg-white text-black hover:bg-white!' : 'hover:bg-white/10',
                ]">
                <Icon icon="carbon:connection-signal" width="20" height="20" class="mr-5" />
                Feed
              </RouterLink>
            </li>
            <li>
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/overview`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:home" width="20" height="20" class="mr-5" />
                Overview
              </RouterLink>
            </li>
            <li>
              <RouterLink :to="`/organizations/${orgContext?.organization.slug}/members`"
                active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                <Icon icon="carbon:user-multiple" width="20" height="20" class="mr-5" />
                Members
              </RouterLink>
            </li>
          </template>

          <li v-if="hasActiveOrg" class="my-3 border-t border-white/10" />
          <li class="mt-5">
            <div class="flex items-center px-4 py-2 font-semibold text-white/80 select-none">
              You
              <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5 opacity-60" />
            </div>
          </li>

          <li>
            <RouterLink to="/my-rugby" active-class="bg-white text-black hover:!bg-white"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon icon="fluent-mdl2:rugby" width="20" height="20" class="mr-5" />
              My Rugby
            </RouterLink>
          </li>

          <li>
            <RouterLink to="/profile" active-class="bg-white text-black hover:!bg-white"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon icon="carbon:user-profile" width="20" height="20" class="mr-5" />
              Profile
            </RouterLink>
          </li>

          <li>
            <RouterLink to="/settings" active-class="bg-white text-black hover:!bg-white"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon icon="carbon:settings" width="20" height="20" class="mr-5" />
              Settings
            </RouterLink>
          </li>

          <li v-if="isPlatformAdmin()" class="mt-5">
            <RouterLink to="/admin" active-class="bg-white text-black hover:!bg-white"
              class="flex items-center px-4 py-2 text-amber-200 hover:bg-white/10 rounded">
              <Icon icon="carbon:police" width="20" height="20" class="mr-5" />
              Admin Console
            </RouterLink>
          </li>
        </ul>
        <div class="text-xs text-gray-400 px-4 py-3 mt-auto">
          v0.10.0
        </div>
      </nav>
    </div>
  </div>

  <!-- MOBILE EDGE SWIPE ZONE -->
  <div v-if="!isOpen" class="md:hidden fixed bottom-0 left-0 w-full h-6 z-40" style="touch-action: none;"
    @pointerdown="onEdgePointerDown" @pointermove="onEdgePointerMove" @pointerup="onEdgePointerUp"
    @pointercancel="onEdgePointerUp" />

  <!-- MOBILE BOTTOM SHEET -->
  <div class="
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
    " :class="[isOpen ? 'translate-y-0' : 'translate-y-full']" :style="sheetStyle" ref="mobileSheetRef">
    <div class="p-4 h-full flex flex-col">
      <div class="pb-6" style="touch-action: none;" @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove" @pointerup="onHandlePointerUp" @pointercancel="onHandlePointerUp">
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
            <template v-if="hasActiveOrg">
              <li v-if="canManageOrgTools">
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/assignments`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:task" width="20" height="20" class="mr-5" />
                  Assignments
                </RouterLink>
              </li>
              <li v-if="canManageOrgTools">
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/media`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:image" width="20" height="20" class="mr-5" />
                  Media
                </RouterLink>
              </li>
              <li v-if="canManageOrgTools">
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/groups`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:group" width="20" height="20" class="mr-5" />
                  Groups
                </RouterLink>
              </li>
              <li v-if="canManageOrgTools">
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/usage`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:meter" width="20" height="20" class="mr-5" />
                  Usage
                </RouterLink>
              </li>
              <li v-if="canManageOrgTools" class="my-3 border-t border-white/10" />
              <li>
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/feed`"
                  :class="[
                    'flex items-center px-4 py-2 rounded',
                    isFeedRouteActive ? 'bg-white text-black hover:bg-white!' : 'hover:bg-white/10',
                  ]">
                  <Icon icon="carbon:connection-signal" width="20" height="20" class="mr-5" />
                  Feed
                </RouterLink>
              </li>
              <li>
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/overview`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:home" width="20" height="20" class="mr-5" />
                  Overview
                </RouterLink>
              </li>

              <li>
                <RouterLink :to="`/organizations/${orgContext?.organization.slug}/members`"
                  active-class="bg-white text-black hover:!bg-white"
                  class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                  @click="handleSidebarToggle">
                  <Icon icon="carbon:user-multiple" width="20" height="20" class="mr-5" />
                  Members
                </RouterLink>
              </li>
            </template>

            <li v-if="hasActiveOrg" class="my-3 border-t border-white/10" />
            <li class="mt-5">
              <div class="flex items-center px-4 py-2 font-semibold text-white/80 select-none">
                You
                <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5 opacity-60" />
              </div>
            </li>

            <li>
              <RouterLink to="/my-rugby" active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded" @click="handleSidebarToggle">
                <Icon icon="fluent-mdl2:rugby" width="20" height="20" class="mr-5" />
                My Rugby
              </RouterLink>
            </li>

            <li>
              <RouterLink to="/profile" active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded" @click="handleSidebarToggle">
                <Icon icon="carbon:user-profile" width="20" height="20" class="mr-5" />
                Profile
              </RouterLink>
            </li>

            <li>
              <RouterLink to="/settings" active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 hover:bg-white/10 rounded" @click="handleSidebarToggle">
                <Icon icon="carbon:settings" width="20" height="20" class="mr-5" />
                Settings
              </RouterLink>
            </li>

            <li v-if="isPlatformAdmin()" class="mt-5">
              <RouterLink to="/admin" active-class="bg-white text-black hover:!bg-white"
                class="flex items-center px-4 py-2 text-amber-200 hover:bg-white/10 rounded"
                @click="handleSidebarToggle">
                <Icon icon="carbon:police" width="20" height="20" class="mr-5" />
                Admin Console
              </RouterLink>
            </li>
          </ul>
        </nav>
      </div>
      <div class="text-xs text-gray-400 px-4 py-3">
        v0.10.0
      </div>
    </div>
  </div>
</template>
