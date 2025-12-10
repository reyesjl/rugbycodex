<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

defineProps<{
  isOpen: boolean;
}>();

const adminLinks = [
  { to: '/v2/admin', label: 'System Overview', icon: 'carbon:analytics' },
  { to: '/v2/admin/orgs', label: 'Organizations', icon: 'carbon:group-presentation' },
  { to: '/v2/admin/users', label: 'Users', icon: 'carbon:user-multiple' },
  { to: '/v2/admin/narrations', label: 'Narrations Moderation', icon: 'carbon:microphone' },
  { to: '/v2/admin/media', label: 'Media Review', icon: 'carbon:image-search' },
  { to: '/v2/admin/jobs', label: 'Jobs / Pipelines', icon: 'carbon:flow' },
  { to: '/v2/admin/billing', label: 'Billing / Metering', icon: 'carbon:finance' },
  { to: '/v2/admin/flags', label: 'Feature Flags', icon: 'carbon:flag' },
  { to: '/v2/admin/experiments', label: 'Experiments', icon: 'carbon:chemistry' },
  { to: '/v2/profile', label: 'Profile', icon: 'carbon:user-profile' },
];

// const handleSidebarToggle = () => {
//   emit('toggle-sidebar');
// };
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
            <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5" />
              Back to Dashboard
            </RouterLink>
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
