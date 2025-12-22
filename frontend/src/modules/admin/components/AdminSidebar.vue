<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';

defineProps<{
  isOpen: boolean;
}>();
const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const adminLinks = [
  { to: '/admin/', label: 'Organizations', icon: 'carbon:group-presentation' },
  { to: '/admin/users', label: 'Users', icon: 'carbon:user-multiple' },
  { to: '/admin/narrations', label: 'Narrations Moderation', icon: 'carbon:microphone' },
  { to: '/admin/media', label: 'Media Review', icon: 'carbon:image-search' },
  { to: '/admin/jobs', label: 'Jobs / Pipelines', icon: 'carbon:flow' },
  { to: '/admin/billing', label: 'Billing / Metering', icon: 'carbon:finance' },
  { to: '/admin/flags', label: 'Feature Flags', icon: 'carbon:flag' },
  { to: '/admin/experiments', label: 'Experiments', icon: 'carbon:chemistry' },
  { to: '/profile', label: 'Profile', icon: 'carbon:user-profile' },
];

const handleSidebarToggle = () => emit('toggle-sidebar');

</script>

<template>
  <div
    class="fixed left-0 top-[var(--main-nav-height)] z-50 h-full w-64 border-r-1 border-white/30 bg-black/30 text-white backdrop-blur"
    :class="[isOpen ? 'translate-x-0' : '-translate-x-full']"
  >
    <div class="container-lg h-full py-5">
      <nav>
        <ul class="space-y-1">
          <li>
            <RouterLink
              to="/dashboard"
              class="flex w-full items-center rounded px-4 py-2 hover:bg-white/10"
            >
              <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5" />
              Back to Dashboard
            </RouterLink>
          </li>
          <li>
            <button
              type="button"
              class="flex w-full items-center rounded px-4 py-2 hover:bg-white/10"
              @click="handleSidebarToggle"
            >
              <Icon icon="carbon:side-panel-close" width="20" height="20" class="mr-5" />
              Collapse
            </button>
          </li>
          <li class="pt-4 pb-2 px-4 text-xs uppercase tracking-wide text-white/60">
            Admin Console
          </li>
          <li
            v-for="link in adminLinks"
            :key="link.to"
          >
            <RouterLink :to="link.to" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon :icon="link.icon" width="20" height="20" class="mr-5" />
              {{ link.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>
