import { ref, onMounted, onUnmounted, computed } from 'vue';

/**
 * Composable for viewport detection and responsive breakpoints
 * Uses Tailwind's default md breakpoint (768px)
 */
export function useViewport() {
  const width = ref(window.innerWidth);
  const height = ref(window.innerHeight);

  const updateDimensions = () => {
    width.value = window.innerWidth;
    height.value = window.innerHeight;
  };

  onMounted(() => {
    window.addEventListener('resize', updateDimensions);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateDimensions);
  });

  // Tailwind breakpoints
  const isMobile = computed(() => width.value < 768);
  const isTablet = computed(() => width.value >= 768 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
  };
}
