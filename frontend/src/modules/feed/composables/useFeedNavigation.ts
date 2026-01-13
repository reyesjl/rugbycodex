import { computed, ref } from 'vue';

export function useFeedNavigation(options: { length: () => number }) {
  const activeIndex = ref(0);

  const hasPrev = computed(() => activeIndex.value > 0);
  const hasNext = computed(() => activeIndex.value < Math.max(0, options.length() - 1));

  function clamp(index: number): number {
    const max = Math.max(0, options.length() - 1);
    return Math.min(max, Math.max(0, index));
  }

  function setActive(index: number) {
    activeIndex.value = clamp(index);
  }

  function goPrev() {
    setActive(activeIndex.value - 1);
  }

  function goNext() {
    setActive(activeIndex.value + 1);
  }

  return {
    activeIndex,
    hasPrev,
    hasNext,
    setActive,
    goPrev,
    goNext,
  };
}
