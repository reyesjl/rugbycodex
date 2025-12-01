import { ref } from "vue";

export function useTypewriter() {
  const value = ref("");
  const typing = ref(false);

  async function typeText(text: string, delay_ms = 50) {
    value.value = "";
    typing.value = true;

    for (let i = 0; i < text.length; i++) {
      value.value += text[i];
      await new Promise((resolve) => setTimeout(resolve, delay_ms));
    }

    typing.value = false;
  }

  return { value, typing, typeText };
}
