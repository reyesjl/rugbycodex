import { onBeforeUnmount, onMounted, type ComponentPublicInstance } from 'vue';

interface StaggerOptions {
  delay?: number;
  threshold?: number;
}

export const useStaggeredFade = (options: StaggerOptions = {}) => {
  const { delay = 80, threshold = 0.1 } = options;
  const elements: HTMLElement[] = [];
  let observer: IntersectionObserver | null = null;

  const register = (el: Element | ComponentPublicInstance | null) => {
    let element: HTMLElement | null = null;

    if (el instanceof HTMLElement) {
      element = el;
    } else if (el && '$el' in el) {
      const componentElement = el.$el;
      element = componentElement instanceof HTMLElement ? componentElement : null;
    }

    if (element && !elements.includes(element)) {
      element.classList.add('fade-item');
      elements.push(element);
    }
  };

  onMounted(() => {
    if (!elements.length) return;

    const firstElement = elements[0];
    if (!firstElement) return;

    observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        elements.forEach((el, index) => {
          setTimeout(() => el.classList.add('visible'), index * delay);
        });
        observer?.disconnect();
      }
    }, { threshold });

    observer.observe(firstElement);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { register };
};
