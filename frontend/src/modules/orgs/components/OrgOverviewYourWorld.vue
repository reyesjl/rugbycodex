<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

type SignalItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
  tag?: string;
  to?: RouteLocationRaw;
};

const props = defineProps<{
  title: string;
  description?: string;
  eyebrow?: string;
  items: SignalItem[];
  isLoading?: boolean;
  emptyLabel?: string;
  variant?: 'default' | 'command' | 'personal';
}>();

const isCommand = computed(() => props.variant === 'command');
const isPersonal = computed(() => props.variant === 'personal');

const sectionClass = computed(() => {
  if (isCommand.value) return 'space-y-5 border-t border-white/20 pt-7';
  if (isPersonal.value) return 'space-y-5 border-t border-white/10 pt-9';
  return 'space-y-5 border-t border-white/10 pt-7';
});

const listItemClass = (index: number) => {
  const borderTone = isCommand.value ? 'border-white/10' : 'border-white/5';
  const basePadding = isCommand.value ? 'pb-3' : 'pb-4';
  const topPadding = index === 0 ? '' : `border-t ${borderTone} ${isCommand.value ? 'pt-3' : 'pt-4'}`;
  const extraBeat = (index + 1) % 4 === 0 ? (isCommand.value ? 'pt-5' : 'pt-6') : '';
  return [basePadding, topPadding, extraBeat].filter(Boolean).join(' ');
};

const tagTone = (tag?: string) => {
  if (!tag) return 'text-white/40';
  const normalized = tag.toLowerCase();
  if (normalized.includes('assignment')) return 'text-white/60';
  if (normalized.includes('group')) return 'text-white/45';
  return 'text-white/50';
};

const linkClass = computed(() =>
  [
    'group flex min-w-0 flex-1 items-start justify-between transition hover:text-white',
    isCommand.value ? 'gap-3' : 'gap-4',
  ].join(' ')
);
</script>

<template>
  <section :class="sectionClass">
    <div>
      <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.3em] text-white/45">{{ eyebrow }}</p>
      <h2 class="text-xl font-semibold text-white">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-xs text-white/45">{{ description }}</p>
    </div>

    <div v-if="isLoading" class="text-sm text-white/50">Loading context...</div>

    <div v-else>
      <div v-if="items.length">
        <div v-for="(item, index) in items" :key="item.id" :class="listItemClass(index)">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            :class="linkClass"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                <span v-if="item.tag" :class="tagTone(item.tag)">{{ item.tag }}</span>
                <span v-if="item.status" class="text-white/35">{{ item.status }}</span>
              </div>
              <div class="mt-1 text-sm font-semibold text-white">{{ item.title }}</div>
              <div v-if="item.meta" class="mt-1 text-xs text-white/40">{{ item.meta }}</div>
            </div>
          </RouterLink>
          <div v-else :class="linkClass">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                <span v-if="item.tag" :class="tagTone(item.tag)">{{ item.tag }}</span>
                <span v-if="item.status" class="text-white/35">{{ item.status }}</span>
              </div>
              <div class="mt-1 text-sm font-semibold text-white">{{ item.title }}</div>
              <div v-if="item.meta" class="mt-1 text-xs text-white/40">{{ item.meta }}</div>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-white/50">{{ emptyLabel ?? 'No items logged yet.' }}</p>
    </div>
  </section>
</template>
