<script setup lang="ts">
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { Icon } from '@iconify/vue';

defineProps<{
  canDelete: boolean;
  narrationCount?: number;
  canAddToPlaylist?: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'addNarration'): void;
  (e: 'assign'): void;
  (e: 'addToPlaylist'): void;
}>();
</script>

<template>
  <Menu as="div" class="relative inline-block text-left">
    <MenuButton
      class="inline-flex items-center justify-center rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
      @click.stop
    >
      <Icon icon="carbon:overflow-menu-vertical" class="h-5 w-5" />
    </MenuButton>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <MenuItems
        class="absolute right-0 z-50 mt-1 w-48 origin-top-right rounded-md border border-white/20 bg-black/95 backdrop-blur shadow-lg focus:outline-none"
        @click.stop
      >
        <div class="py-1">
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white"
              :class="active ? 'bg-white/10' : ''"
              @click.stop="emit('addNarration')"
            >
              <Icon icon="carbon:add-comment" class="h-4 w-4" />
              Add narration
            </button>
          </MenuItem>
          
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white"
              :class="active ? 'bg-white/10' : ''"
              @click.stop="emit('assign')"
            >
              <Icon icon="carbon:user-multiple" class="h-4 w-4" />
              Assign to players
            </button>
          </MenuItem>

          <MenuItem v-if="canAddToPlaylist" v-slot="{ active }">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-white"
              :class="active ? 'bg-white/10' : ''"
              @click.stop="emit('addToPlaylist')"
            >
              <Icon icon="carbon:playlist" class="h-4 w-4" />
              Add to playlist
            </button>
          </MenuItem>

          <div v-if="canDelete" class="border-t border-white/10 my-1"></div>
          
          <MenuItem v-if="canDelete" v-slot="{ active }">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-300"
              :class="active ? 'bg-red-500/10' : ''"
              @click.stop="emit('delete')"
            >
              <div class="flex items-center gap-2">
                <Icon icon="carbon:trash-can" class="h-4 w-4" />
                <span>Delete segment</span>
              </div>
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>
