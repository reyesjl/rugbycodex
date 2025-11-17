<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

interface Option {
  value: number | string;
  label: string;
}

interface Props {
  modelValue: number | string;
  options: readonly Option[];
  placeholder?: string;
}

interface Emits {
  (e: 'update:modelValue', value: number | string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isOpen = ref(false);
const selectRef = ref<HTMLDivElement | null>(null);

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue);
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const selectOption = (value: number | string) => {
  emit('update:modelValue', value);
  isOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="selectRef" class="relative w-full">
    <button type="button" @click="toggleDropdown"
      class="mt-2 w-full cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20">
      <span class="flex items-center justify-between">
        <span>{{ selectedOption?.label || placeholder || 'Select an option' }}</span>
        <svg :class="['h-5 w-5 transition-transform', isOpen ? 'rotate-180' : '']" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>

    <Transition enter-active-class="transition duration-100 ease-out" enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100" leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100" leave-to-class="transform scale-95 opacity-0">
      <div v-if="isOpen"
        class="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-950">
        <ul class="max-h-60 overflow-auto py-1">
          <li v-for="option in options" :key="option.value" @click="selectOption(option.value)" :class="[
            'cursor-pointer px-4 py-3 text-neutral-900 transition dark:text-neutral-100',
            option.value === modelValue
              ? 'bg-neutral-200 font-semibold dark:bg-neutral-800'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
          ]">
            {{ option.label }}
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>