<script setup lang="ts">
interface Props {
  show: boolean;
  itemName: string;
  popupTitle: string;
  isDeleting?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isDeleting: false,
  error: null
});

const emit = defineEmits<Emits>();

const handleBackdropClick = () => {
  if (!props.isDeleting) {
    emit('close');
  }
};

const handleCancel = () => {
  if (!props.isDeleting) {
    emit('cancel');
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
            Are you sure you want to delete <strong>{{ itemName }}</strong>? This action cannot be undone.
          </p>
        </header>

        <!-- Error section -->
        <div v-if="error" class="p-4">
          <p class="text-xs text-red-400">{{ error }}</p>
        </div>

        <!-- Footer -->
        <div class="flex justify-between p-4 border-t border-t-white/20">
          <button
            @click="handleCancel"
            class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            :disabled="isDeleting"
          >
            Cancel
          </button>
          <button
            @click="emit('confirm')"
            class="px-2 py-1 text-xs rounded-lg border border-red-500 bg-red-500/70 hover:bg-red-700/70 transition disabled:opacity-50"
            :disabled="isDeleting"
          >
            <span v-if="isDeleting">Deleting...</span>
            <span v-else>Delete</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>
