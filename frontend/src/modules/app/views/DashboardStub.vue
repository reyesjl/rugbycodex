<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';

const profileStore = useProfileStore();
const { profile } = storeToRefs(profileStore);

</script>
<template>
  <div class="container-lg py-6">
    <div class="text-white">Welcome back, {{ profile?.name }}</div>
  </div>
</template>
