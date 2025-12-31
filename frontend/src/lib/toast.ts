export type ToastVariant = "success" | "info" | "error";

export type ToastPayload = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

const TOAST_EVENT = "app:toast";
const toastTarget = new EventTarget();

export function onToast(handler: (payload: ToastPayload) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<ToastPayload>).detail);
  toastTarget.addEventListener(TOAST_EVENT, listener as EventListener);
  return () => toastTarget.removeEventListener(TOAST_EVENT, listener as EventListener);
}

export function toast(payload: ToastPayload) {
  toastTarget.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}