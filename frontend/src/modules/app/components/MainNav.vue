<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import OrgSwitcher from './OrgSwitcher.vue';

// auth store
const authStore = useAuthStore();

// ref for nav
const navRef = ref<HTMLElement | null>(null);
let resizeObserver: globalThis.ResizeObserver | null = null;

// Refs for user menu
const userMenuRef = ref<HTMLElement | null>(null);
const avatarButtonRef = ref<HTMLElement | null>(null);

const menuOpen = ref(false);
const loggingOut = ref(false);

const router = useRouter();
const route = useRoute();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => {
  emit('toggle-sidebar');
};

const closeMenu = () => {
  menuOpen.value = false;
};

const toggleMenu = () => {
  menuOpen.value = !menuOpen.value;
};

const handleClickOutside = (event: MouseEvent) => {
  if (!menuOpen.value) return;

  const target = event.target as Node | null;
  if (avatarButtonRef.value?.contains(target) || userMenuRef.value?.contains(target)) return;

  closeMenu();
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
    closeMenu();
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
  if (typeof window !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (typeof window !== 'undefined') {
    document.documentElement.style.removeProperty('--main-nav-height');
    document.removeEventListener('click', handleClickOutside);
  }
});

watch(
  () => route.fullPath,
  () => closeMenu()
);
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
          <div v-if="authStore.isAuthenticated" class="relative">
            <button
              ref="avatarButtonRef"
              type="button"
              class="flex items-center rounded-full p-1 hover:bg-white/10 focus:outline-none"
              @click.stop="toggleMenu"
              aria-label="User menu"
            >
              <Icon icon="carbon:user-avatar" width="23" height="23" class="text-white" />
              <Icon
                icon="carbon:chevron-down"
                width="16"
                height="16"
                class="ml-1 text-white/70 transition-transform"
                :class="menuOpen ? 'rotate-180' : ''"
              />
            </button>
            <transition name="fade">
              <div
                v-if="menuOpen"
                ref="userMenuRef"
                class="absolute right-0 mt-2 w-56 rounded-md border border-white/20 bg-black/90 p-2 text-sm shadow-2xl"
              >
                <RouterLink
                  to="/profile"
                  class="flex items-center rounded px-3 py-2 text-white hover:bg-white/10"
                  @click="closeMenu"
                >
                  <Icon icon="carbon:user-profile" width="18" height="18" class="mr-2" />
                  Profile
                </RouterLink>
                <RouterLink
                  to="/settings"
                  class="flex items-center rounded px-3 py-2 text-white hover:bg-white/10"
                  @click="closeMenu"
                >
                  <Icon icon="carbon:settings" width="18" height="18" class="mr-2" />
                  Settings
                </RouterLink>
                <button
                  type="button"
                  class="mt-1 flex w-full items-center rounded px-3 py-2 text-left text-rose-300 hover:bg-rose-500/10"
                  @click="handleLogout"
                  :disabled="loggingOut"
                >
                  <Icon icon="carbon:logout" width="18" height="18" class="mr-2" />
                  <span>{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
                </button>
              </div>
            </transition>
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