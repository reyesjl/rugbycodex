<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { onToast, type ToastPayload } from "@/lib/toast";

type ToastItem = Required<ToastPayload> & { id: string };

const toasts = ref<ToastItem[]>([]);
let off: null | (() => void) = null;

function addToast(payload: ToastPayload) {
  const item: ToastItem = {
    id: crypto.randomUUID(),
    message: payload.message,
    variant: payload.variant ?? "info",
    durationMs: payload.durationMs ?? 3000,
  };

  toasts.value = [...toasts.value, item];

  window.setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== item.id);
  }, item.durationMs);
}

function variantClasses(v: ToastItem["variant"]) {
  switch (v) {
    case "success":
      return "border-green-500/40 bg-green-500/15 text-white";
    case "error":
      return "border-rose-500/40 bg-rose-500/15 text-white";
    default:
      return "border-sky-500/40 bg-sky-500/15 text-white";
  }
}

onMounted(() => {
  off = onToast(addToast);
});

onBeforeUnmount(() => {
  off?.();
});
</script>

<template>
  <div class="fixed top-5 left-0 right-0 z-100 pointer-events-none">
    <TransitionGroup
      name="toast"
      tag="div"
      class="mx-auto mt-3 flex w-full max-w-2xl flex-col gap-2 px-4"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto rounded-md border px-3 py-2 shadow-lg backdrop-blur"
        :class="variantClasses(t.variant)"
        role="status"
        aria-live="polite"
      >
        <div class="text-sm">{{ t.message }}</div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-14px);
}

.toast-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.toast-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-move {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
