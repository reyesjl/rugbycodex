<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>
<template>
  <section class="navclear bg-black text-white" data-nav-theme="dark">
    <div class="container-lg pt-50 flex flex-col gap-8 justify-end">
      <h2 class="text-5xl md:text-9xl font-bold">Coaches</h2>
      <div class="grid md:grid-cols-12 gap-6 text-xs mt-6 pb-8 uppercase">
        <div class="md:col-start-1 md:col-end-3 space-y-3">
          <p>Team Learning System</p>
          <p>[ TLS ]</p>
        </div>
        <div class="md:col-start-3 md:col-end-8">
          COACHES USE RUGBYCODEX TO BREAK DOWN MATCHES, TEACH SYSTEMS, AND BUILD A SHARED UNDERSTANDING ACROSS THEIR
          TEAMS.
          FIND PATTERNS FASTER, SEE MOMENTS IN CONTEXT, AND TURN NARRATIONS INTO CLARITY THAT YOUR PLAYERS CAN ACT ON.
        </div>
        <div class="md:col-start-8 md:col-end-13 flex justify-end">
          <!-- carbon iconify down arrow -->
          <Icon icon="carbon:chevron-down-outline" width="32" height="32" class="text-white mt-2" />
        </div>
      </div>
    </div>
  </section>

  <section class="h-screen py-20">
    <div class="container-lg">
    </div>
  </section>
</template>