<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';
import OrgSwitcher from './OrgSwitcher.vue';

// auth store
const authStore = useAuthStore();
const userContextStore = useUserContextStore();

// ref for nav
const navRef = ref<HTMLElement | null>(null);
let resizeObserver: globalThis.ResizeObserver | null = null;

const loggingOut = ref(false);
const displayUsername = computed(() => {
  const profileUsername = userContextStore.profileReadonly?.username?.trim();
  if (profileUsername) return profileUsername;

  const metadataUsername = authStore.userReadonly?.user_metadata?.username;
  if (typeof metadataUsername === 'string' && metadataUsername.trim()) {
    return metadataUsername.trim();
  }

  const email = authStore.userReadonly?.email;
  if (email) return email.split('@')[0] ?? 'Account';

  return 'Account';
});

const router = useRouter();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => {
  emit('toggle-sidebar');
};

const handleLogout = async () => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    const { error } = await authStore.signOut();
    if (error) {
      console.error('Failed to sign out:', error.message);
      loggingOut.value = false;
      return;
    }
    await router.push('/auth/login');
  } finally {
    loggingOut.value = false;
  }
};

const setNavHeightVar = () => {
  if (navRef.value) {
    document.documentElement.style.setProperty('--main-nav-height', `${navRef.value.offsetHeight}px`);
    console.log('Main nav height set to', `${navRef.value.offsetHeight}px`);
  }
};

const initNavResizeObserver = () => {
  if (typeof window === 'undefined') {
    setNavHeightVar();
    return;
  }
  if (!navRef.value) {
    setNavHeightVar();
    return;
  }

  const hasResizeObserver = 'ResizeObserver' in window && typeof window.ResizeObserver === 'function';
  if (!hasResizeObserver) {
    setNavHeightVar();
    return;
  }

  resizeObserver = new window.ResizeObserver(() => {
    setNavHeightVar();
  });
  resizeObserver.observe(navRef.value);
};

onMounted(() => {
  setNavHeightVar();
  initNavResizeObserver();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (typeof window !== 'undefined') {
    document.documentElement.style.removeProperty('--main-nav-height');
  }
});
</script>

<template>
  <nav ref="navRef" class="fixed top-0 left-0 w-full backdrop-blur text-white z-60">
    <div class="container-lg py-5 flex items-center justify-between">
      <!-- Left -->
      <div class="flex items-center">
        <div class="flex">
          <Icon
            @click="handleSidebarToggle"
            icon="carbon:menu"
            width="22"
            height="22"
            class="mr-3 w-full cursor-pointer"
          />
        </div>

        <OrgSwitcher />
      </div>

      <!-- Right -->
      <div class="justify-end">
        <div class="flex flex-row items-center text-white">
          <div>
            <Icon
              icon="carbon:search"
              width="23"
              height="23"
              class="h-full w-full p-2 hover:bg-white/10 rounded-full cursor-pointer"
            />
          </div>
          <div>
            <Icon
              icon="carbon:notification"
              width="23"
              height="23"
              class="h-full w-full p-2 hover:bg-white/10 rounded-full cursor-pointer"
            />
          </div>
          <div v-if="authStore.isAuthenticated">
            <Menu as="div" class="relative" v-slot="{ open }">
              <MenuButton
                class="flex items-center rounded-full px-2 py-1 hover:bg-white/10 focus:outline-none"
                aria-label="User menu"
              >
                <span class="max-w-[160px] truncate text-sm font-semibold text-white">{{ displayUsername }}</span>
                <Icon
                  icon="carbon:chevron-down"
                  width="16"
                  height="16"
                  class="ml-1 text-white/70 transition-transform"
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
                  class="absolute right-0 mt-2 w-56 rounded-md border border-white/10 bg-black/90 p-2 text-sm focus:outline-none"
                >
                  <MenuItem v-slot="{ active }">
                    <RouterLink
                      to="/profile"
                      class="flex items-center rounded px-3 py-2 text-white transition"
                      :class="active ? 'bg-white/15' : ''"
                    >
                      <Icon icon="carbon:user-profile" width="18" height="18" class="mr-2" />
                      Profile
                    </RouterLink>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <RouterLink
                      to="/settings"
                      class="flex items-center rounded px-3 py-2 text-white transition"
                      :class="active ? 'bg-white/15' : ''"
                    >
                      <Icon icon="carbon:settings" width="18" height="18" class="mr-2" />
                      Settings
                    </RouterLink>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      type="button"
                      class="mt-1 flex w-full items-center rounded px-3 py-2 text-left text-rose-300 transition"
                      :class="active ? 'bg-rose-500/10' : ''"
                      @click="handleLogout"
                      :disabled="loggingOut"
                    >
                      <Icon icon="carbon:logout" width="18" height="18" class="mr-2" />
                      <span>{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
          <RouterLink
            v-else
            :to="`/auth/login`"
            class="ml-3 rounded-full border border-white/40 px-3 py-1 text-sm uppercase tracking-wide hover:bg-white/10"
          >
            Sign in
          </RouterLink>
        </div>
      </div>
    </div>
  </nav>
</template>
