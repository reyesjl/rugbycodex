<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();

const isLogin = computed (() => route.path === '/v2/auth/login');
const isSignup = computed (() => route.path === '/v2/auth/signup');

</script>
<template>
<div class="flex justify-between py-4">
    <RouterLink to="/v2/marketing" class="navclear">
        <p class="text-white">RUGBY<span class="font-semibold">CODEX</span></p>
    </RouterLink>
    
    <div class="flex border-1 border-white">
    <RouterLink to="/v2/auth/login" 
    class="text-xs text-white p-1 px-2"
    :class="[isLogin ? 'bg-white !text-black' : 'text-white hover:bg-white/30']">
        LOGIN
    </RouterLink>
    <RouterLink to="/v2/auth/signup" class="text-xs text-white p-1 px-2"
    :class="[isSignup ? 'bg-white !text-black' : 'text-white hover:bg-white/30']">
        SIGNUP
    </RouterLink>
    </div>
</div>
</template>
<style lang="css" scoped>
</style>