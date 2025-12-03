<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

type Variant = "base" | "glass" | "solid" | "outline";
type Color = "primary" | "white" | "danger" | "neutral";
type Size = "sm" | "md" | "lg" | "icon";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    color?: Color;
    size?: Size;
    disabled?: boolean;
    type?: "button" | "submit";
    to?: RouteLocationRaw;
    href?: string;
    target?: "_self" | "_blank" | "_parent" | "_top";
    rel?: string;
  }>(),
  {
    variant: "base",
    color: "primary",
    size: "sm",
    disabled: false,
    type: "button",
  }
);

// Variant maps
const base = {
    primary: "bg-white text-black hover:bg-white/50",
    white: "bg-white text-black hover:bg-white hover:text-black",
    neutral: "bg-neutral-800/30 text-white hover:bg-neutral-700 hover:text",
    danger: "bg-red-500/20 text-red-200 hover:bg-red-500/30",
};

const glass = {
  primary: "bg-white/30 text-white hover:bg-white/20",
  white: "bg-white/10 text-white hover:bg-white/20",
  neutral: "bg-neutral-900/30 text-white hover:bg-neutral-700/30",
  danger: "bg-red-500/20 text-red-200 hover:bg-red-500/30",
};

const solid = {
  primary: "bg-[#C1121F] text-white hover:bg-[#d11f2c]",
  white: "bg-white text-black hover:bg-gray-200",
  neutral: "bg-neutral-800 text-white hover:bg-neutral-700",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

const outline = {
  primary: "border border-white/20 text-white hover:bg-white/10",
  white: "border border-white text-white hover:bg-white/10",
  neutral: "border border-neutral-600 text-white hover:bg-neutral-800",
  danger: "border border-red-500 text-red-500 hover:bg-red-500/10",
};

// Size map
const sizes = {
  sm: "px-2 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "p-2",
};

const variantClasses = computed(() => {
  if (props.variant === "solid") return solid[props.color];
  if (props.variant === "outline") return outline[props.color];
  if (props.variant === "glass") return glass[props.color];
  return base[props.color];
});

const resolvedRel = computed(() => {
  if (props.rel) return props.rel;
  if (props.target === "_blank") return "noreferrer noopener";
  return undefined;
});

const componentTag = computed(() => {
  if (props.to) return RouterLink;
  if (props.href) return "a";
  return "button";
});

const componentAttrs = computed(() => {
  if (props.to) {
    return {
      to: props.to,
      target: props.target,
      rel: resolvedRel.value,
    };
  }

  if (props.href) {
    return {
      href: props.href,
      target: props.target,
      rel: resolvedRel.value,
    };
  }

  return {
    type: props.type,
    disabled: props.disabled,
  };
});
</script>

<template>
  <component
    :is="componentTag"
    v-bind="componentAttrs"
    class="
      select-none
      rounded-xs
      transition-all duration-150
      disabled:opacity-50 disabled:cursor-not-allowed
    "
    :class="[sizes[size], variantClasses]"
  >
    <slot />
  </component>
</template>
