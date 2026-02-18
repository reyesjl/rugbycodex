<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();

const isLogin = computed (() => route.path === '/auth/login');
const isWaitlist = computed (() => route.path === '/auth/waitlist');

</script>
<template>
<div class="flex justify-between py-4">
    <RouterLink to="/" class="navclear">
        <p class="text-white">RUGBY<span class="font-semibold">CODEX</span></p>
    </RouterLink>
    
    <div class="flex border-1 border-white">
    <RouterLink to="/auth/login" 
    class="text-xs text-white p-1 px-2"
    :class="[isLogin ? 'bg-white !text-black' : 'text-white hover:bg-white/30']">
        LOGIN
    </RouterLink>
    <RouterLink to="/auth/waitlist" class="text-xs text-white p-1 px-2"
    :class="[isWaitlist ? 'bg-white !text-black' : 'text-white hover:bg-white/30']">
        WAITLIST
    </RouterLink>
    </div>
</div>
</template>
<style lang="css" scoped>
</style>
