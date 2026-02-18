<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

type Props = {
  headline: string;
  subtext: string;
  primaryLabel: string;
  primaryTo: string | RouteLocationRaw;
  learnMoreTo?: string | RouteLocationRaw;
  learnMoreLabel?: string;
  bgColor?: string;
  buttonColor?: string;
  shimmerPrimary?: boolean;
};

const props = defineProps<Props>();

const isExternalDestination = (to: string | RouteLocationRaw | undefined) => {
  if (!to || typeof to !== 'string') return false;
  return to.startsWith('mailto:') || to.startsWith('http://') || to.startsWith('https://');
};

const primaryIsExternal = computed(() => isExternalDestination(props.primaryTo));
const primaryHref = computed(() => (typeof props.primaryTo === 'string' ? props.primaryTo : ''));

const learnMoreIsExternal = computed(() => isExternalDestination(props.learnMoreTo));
const learnMoreHref = computed(() =>
  typeof props.learnMoreTo === 'string' ? props.learnMoreTo : '',
);

const hasBgColorProp = computed(() => props.bgColor != null);

const resolvedBgColor = computed(() => props.bgColor ?? 'bg-white');
const resolvedTextColor = computed(() => (hasBgColorProp.value ? 'text-white' : 'text-black'));

const resolvedButtonColor = computed(() => {
  if (props.buttonColor) return props.buttonColor;
  return hasBgColorProp.value ? resolvedBgColor.value : 'bg-black';
});

const sectionClass = computed(
  () => `${resolvedBgColor.value} ${resolvedTextColor.value} md:py-40 py-20`,
);

const themeBorderClass = computed(() => (hasBgColorProp.value ? 'border-white' : 'border-black'));
const themeHoverClass = computed(() => {
  return hasBgColorProp.value
    ? 'hover:bg-white hover:text-black hover:border-black'
    : 'hover:bg-transparent hover:text-black hover:border-black';
});

const buttonTextClass = computed(() => {
  if (resolvedButtonColor.value?.startsWith('bg-white')) return 'text-black';
  return 'text-white';
});

const primaryButtonClass = computed(() => {
  if (props.shimmerPrimary) {
    return 'w-fit px-6 py-3 rounded-full font-semibold transition-colors bg-black text-white hover:bg-white hover:text-black';
  }

  return [
    'w-fit px-6 py-3 border-2 transition-colors rounded',
    resolvedButtonColor.value,
    themeBorderClass.value,
    buttonTextClass.value,
    themeHoverClass.value,
  ].join(' ');
});

const learnMoreClass = computed(() => {
  return hasBgColorProp.value
    ? 'w-fit underline underline-offset-4 text-white/70 hover:text-white transition-colors'
    : 'w-fit underline underline-offset-4 text-gray-500 hover:text-gray-800 transition-colors';
});

const resolvedLearnMoreLabel = computed(() => props.learnMoreLabel ?? 'Learn more');
</script>

<template>
  <section :class="sectionClass">
    <div class="container-lg">
      <div class="grid md:grid-cols-4 items-center grid-cols-1 gap-30 md:gap-0">
        <div class="md:col-span-2 flex flex-col space-y-4">
          <h2 class="text-6xl" data-role-motion>{{ headline }}</h2>
          <p data-role-motion>{{ subtext }}</p>
        </div>

        <div class="md:col-start-4 flex flex-col space-y-4 md:items-start items-end" data-role-motion>
          <span
            v-if="shimmerPrimary"
            class="cta-shell shadow-[0_0_40px_rgba(59,130,246,0.35)]"
          >
            <a
              v-if="primaryIsExternal"
              :href="primaryHref"
              :class="primaryButtonClass"
            >
              {{ primaryLabel }}
            </a>
            <RouterLink
              v-else
              :to="primaryTo"
              :class="primaryButtonClass"
            >
              {{ primaryLabel }}
            </RouterLink>
          </span>
          <template v-else>
            <a
              v-if="primaryIsExternal"
              :href="primaryHref"
              :class="primaryButtonClass"
            >
              {{ primaryLabel }}
            </a>
            <RouterLink
              v-else
              :to="primaryTo"
              :class="primaryButtonClass"
            >
              {{ primaryLabel }}
            </RouterLink>
          </template>

          <template v-if="learnMoreTo">
            <a
              v-if="learnMoreIsExternal"
              :href="learnMoreHref"
              :class="learnMoreClass"
            >
              {{ resolvedLearnMoreLabel }}
            </a>
            <RouterLink
              v-else
              :to="learnMoreTo"
              :class="learnMoreClass"
            >
              {{ resolvedLearnMoreLabel }}
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-shell {
  position: relative;
  display: inline-flex;
  padding: 2px;
  border-radius: 9999px;
  overflow: hidden;
  background: linear-gradient(120deg, rgba(30, 64, 175, 0.95), rgba(96, 165, 250, 0.9), rgba(30, 64, 175, 0.95));
}

.cta-shell::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.9) 50%, transparent 58%);
  transform: translateX(-120%) rotate(10deg);
  animation: cta-shine-sweep 2.4s linear infinite;
}

.cta-shell :deep(a) {
  position: relative;
  z-index: 1;
  border-radius: 9999px;
}

@keyframes cta-shine-sweep {
  to {
    transform: translateX(120%) rotate(10deg);
  }
}
</style>
