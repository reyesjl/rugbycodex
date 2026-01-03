<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

type Variant = 'horizontal' | 'grid';

const props = withDefaults(
  defineProps<{
    name: string;
    slug: string;
    to?: string;
    bio?: string | null;
    type?: string | null;
    role?: string | null;
    variant?: Variant;
    prominent?: boolean;
  }>(),
  {
    bio: null,
    type: null,
    role: null,
    variant: 'grid',
    prominent: false,
  },
);

const linkTo = computed(() => props.to ?? `/organizations/${props.slug}`);

const cardClass = computed(() => {
  const base = 'rounded-lg bg-white/5 transition';
  const border = props.prominent
    ? 'border border-white/15 hover:border-white/25'
    : 'border border-white/10 hover:border-white/15';
  const motion = props.prominent
    ? 'transition-[transform,background-color,border-color] hover:bg-white/10'
    : 'transition-[background-color,border-color] hover:bg-white/10';
  const snap = props.variant === 'horizontal' ? 'snap-start' : '';

  return props.variant === 'horizontal'
    ? `${base} ${border} ${motion} ${snap} w-72 shrink-0 p-4`
    : `${base} ${border} ${motion} p-6`;
});

const descriptionClass = computed(() => {
  return props.variant === 'horizontal'
    ? 'mt-2 line-clamp-3 whitespace-pre-line text-xs text-white/70'
    : 'mt-2 line-clamp-3 whitespace-pre-line text-xs text-white/70';
});

const typeBadgeClass = computed(() => {
  return 'rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50';
});
</script>

<template>
  <RouterLink :to="linkTo" :class="cardClass">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-start gap-2">
          <h3 class="truncate text-base">{{ name }}</h3>
        </div>

        <div v-if="role" class="mt-1 text-xs font-medium text-white/50">
          {{ role }}
        </div>
      </div>

      <span :class="typeBadgeClass">
        {{ type || 'ORG' }}
      </span>
    </div>

    <p :class="descriptionClass">
      {{ bio ?? 'No description yet.' }}
    </p>
  </RouterLink>
</template>
