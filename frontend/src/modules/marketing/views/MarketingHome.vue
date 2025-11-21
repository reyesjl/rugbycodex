<script setup lang="ts">
import heroAnimatedLight from '@/assets/logos/animated/logo-animation-light.mp4';
import heroAnimatedDark from '@/assets/logos/animated/logo-animation-dark.mp4';
</script>
<template>
  <!-- Hero section -->
  <section class="hero container flex min-h-screen flex-col overflow-x-hidden">
    <div class="flex flex-1 flex-col items-center justify-center space-y-8 text-center">
      <div class="w-full max-w-md overflow-hidden">
        <div class="dark:hidden">
          <div class="mx-auto max-w-lg md:max-w-xl w-full">
            <video
              :src="heroAnimatedLight"
              class="mx-auto w-full"
              playsinline
              autoplay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
        <div class="hidden dark:block">
          <div class="mx-auto max-w-lg md:max-w-xl w-full">
            <video
              :src="heroAnimatedDark"
              class="mx-auto w-full"
              playsinline
              autoplay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-auto mb-20 flex flex-col items-center justify-end md:mb-8">
      <Icon icon="carbon:arrow-down" class="w-16 h-16 animate-bounce text-neutral-400" />
    </div>
  </section>
</template>
