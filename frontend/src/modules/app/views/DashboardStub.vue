<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';

const profileStore = useProfileStore();
const { profile } = storeToRefs(profileStore);

</script>
<template>
  <div class="container py-6">
    <div>
      <div class="text-white font-semibold text-2xl">
        Welcome back, {{ profile?.name }}
      </div>
    </div>

    <div class="mt-6 border-1 border-white/30 p-2 rounded-md">
      <form class="h-12">
        <input
          type="text"
          placeholder="Find anything"
          class="w-full p-2 rounded border outline-none border-none text-white"
        />
      </form>
        <div class="flex justify-between items-center mt-4 px-2">
          <RouterLink to="/v2/dashboard" class="p-2 hover:bg-white/20 bg-white/10 rounded-sm text-xs text-white font-medium">
            Learn how to find rugby players, actions, & events.
          </RouterLink>
          <button
            type="button"
            class="flex p-2 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <Icon icon="carbon:send" width="20" height="20" class="text-white" />
          </button>
        </div>
    </div>

    <!-- Generic metrics -->
    <div class="flex flex-col space-y-10 mt-20">
      
      <!-- narrations section -->
      <div class="flex flex-col space-y-4">
        <!-- section title -->
        <div class="text-gray-300 text-sm font-semibold">
          Narrations
        </div>
        <div class="flex items-center p-4 border-1 border-white/30 rounded-md">
          <div class="text-white/40 text-sm">No narrations yet. Join an org and voice over footage!</div>
        </div>
      </div>

      <!-- pending review section -->
      <div class="flex flex-col space-y-4">
        <!-- section title -->
        <div class="text-gray-300 text-sm font-semibold">
          Pending Reviews
        </div>
        <div class="flex items-center p-4 border-1 border-white/30 rounded-md">
          <div class="text-white/40 text-sm">No pending reviews.</div>
        </div>
      </div>

    </div>
  </div>
</template>
