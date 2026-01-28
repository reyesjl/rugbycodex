<script setup lang="ts">
interface Props {
  show: boolean;
  popupTitle: string;
  message: string;
  buttonLabel?: string;
  isWorking?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  buttonLabel: 'Okay',
  isWorking: false,
  error: null,
});

const emit = defineEmits<Emits>();

const handleBackdropClick = () => {
  if (!props.isWorking) {
    emit('close');
  }
};

const handleClose = () => {
  if (!props.isWorking) {
    emit('close');
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      @click.self="handleBackdropClick"
    >
      <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
        <!-- Header -->
        <header class="p-4 border-b border-b-white/20">
          <h2>{{ popupTitle }}</h2>
          <p class="text-sm text-gray-400">
            {{ message }}
          </p>
        </header>

        <!-- Error section -->
        <div v-if="error" class="p-4">
          <p class="text-xs text-red-400">{{ error }}</p>
        </div>

        <!-- Footer -->
        <div class="flex justify-end p-4 border-t border-t-white/20">
          <button
            @click="handleClose"
            class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            :disabled="isWorking"
          >
            {{ buttonLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>
