<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => emit('toggle-sidebar');

const myOrgsStore = useMyOrganizationsStore();
const { fallbackOrg, loading, hasOrganizations } = storeToRefs(myOrgsStore);
</script>

<template>
  <div
    class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-50 border-r-1 border-white/30"
    :class="[isOpen ? 'translate-x-0' : '-translate-x-full']"
  >
    <div class="container-lg h-full py-5">
      <nav>
        <ul class="space-y-1">
          <!-- collapse -->
          <li>
            <button
              type="button"
              class="flex w-full items-center px-4 py-2 rounded hover:bg-white/10"
              @click="handleSidebarToggle"
            >
              <Icon icon="carbon:side-panel-close" width="20" height="20" class="mr-5" />
              Collapse
            </button>
          </li>

          <!-- global -->
          <li>
            <RouterLink to="/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
              <Icon icon="carbon:dashboard" width="20" height="20" class="mr-5" />
              Dashboard
            </RouterLink>
          </li>

          <!-- org context -->
          <li v-if="hasOrganizations" class="pt-4">
            <div class="px-4 text-xs uppercase tracking-wide text-white/60">
              Organization
            </div>

            <div class="px-4 py-2 font-semibold truncate">
              {{ loading ? 'Loading…' : fallbackOrg?.organization.name }}
            </div>

            <RouterLink
              to="/media"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
            >
              <Icon icon="carbon:image" width="20" height="20" class="mr-5" />
              Media
            </RouterLink>

            <RouterLink
              to="/organizations"
              class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
            >
              <Icon icon="carbon:user-multiple" width="20" height="20" class="mr-5" />
              Members
            </RouterLink>
          </li>

          <!-- no org state -->
          <li v-else class="pt-4 px-4 text-sm text-white/60">
            You’re not in an organization yet.
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>
