import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useViewport } from '@/composables/useViewport';
import { useRouter } from 'vue-router';

const STORAGE_KEY = 'rugbycodex_sidebar_state';

/**
 * Centralized store for sidebar state management
 * Handles:
 * - Open/closed state with localStorage persistence
 * - Viewport-aware defaults (desktop open, mobile closed)
 * - Auto-close on mobile navigation
 */
export const useSidebarStore = defineStore('sidebar', () => {
  const { isMobile } = useViewport();
  const router = useRouter();

  // Initialize from localStorage or use viewport-aware default
  const getInitialState = (): boolean => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    // Default: open on desktop, closed on mobile
    return !isMobile.value;
  };

  const isOpen = ref(getInitialState());

  const setOpen = (next: boolean) => {
    isOpen.value = next;
  };

  // Persist state to localStorage
  watch(isOpen, (newValue) => {
    localStorage.setItem(STORAGE_KEY, String(newValue));
  });

  // Auto-close on mobile navigation
  watch(
    () => router.currentRoute.value.path,
    () => {
      if (isMobile.value && isOpen.value) {
        setOpen(false);
      }
    }
  );

  // Actions
  const toggle = () => {
    setOpen(!isOpen.value);
  };

  const open = () => {
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
  };

  // Reset to viewport-aware default
  const reset = () => {
    setOpen(!isMobile.value);
  };

  return {
    isOpen,
    isMobile: computed(() => isMobile.value),
    setOpen,
    toggle,
    open,
    close,
    reset,
  };
});
