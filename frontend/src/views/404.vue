<script setup lang="ts">
import { RouterLink } from 'vue-router';
import DarkNotFoundImage from '@/assets/404/404-dark.png';
import LightNotFoundImage from '@/assets/404/404-light.png';

type RugbyPenalty = {
  title: string;
  description: string;
  guidance: string;
};

const penalties: RugbyPenalty[] = [
  {
    title: 'Not Releasing',
    description: 'You got tackled by the URL and held on too long.',
    guidance: 'Release and try again from the homepage.',
  },
  {
    title: 'Offside',
    description: 'You wandered in front of the last link.',
    guidance: 'Back up 10 meters and realign.',
  },
  {
    title: 'Knock-On',
    description: 'You fumbled the request forward.',
    guidance: 'The ball—and this page—are now out of your hands.',
  },
  {
    title: 'High Tackle',
    description: 'Your click was a little reckless and made contact above the shoulders.',
    guidance: 'Safety first—start again from a safer angle.',
  },
  {
    title: 'Early push',
    description: 'You engaged before the page was ready.',
    guidance: 'Reset the scrum. Refresh the page.',
  },
  {
    title: 'Side Entry',
    description: 'You tried to enter this route from the side.',
    guidance: 'Use the gate (aka the navbar) properly this time.',
  },
  {
    title: 'Not Straight',
    description: 'That request didn’t come in straight.',
    guidance: 'Hand the throw-in to the homepage.',
  },
  {
    title: 'Sealing Off',
    description: 'You dove on top of the ball—now nobody else can play it.',
    guidance: 'Roll away and give the site another go.',
  },
  {
    title: 'Knock-On',
    description: 'You swatted at a link you never intended to catch.',
    guidance: 'The ref saw that. Scrum to the homepage.',
  },
  {
    title: 'Backchat',
    description: 'You questioned the ref… or at least the routing table.',
    guidance: 'Marching you back 10. Try again, politely.',
  },
];

const randomPenalty = penalties[Math.floor(Math.random() * penalties.length)];
</script>

<template>
  <section class="relative min-h-screen text-black dark:text-white px-2">
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat"
      :style="{ backgroundImage: `url(${LightNotFoundImage})` }"
      aria-hidden="true"
    />
    <div
      class="absolute inset-0 hidden bg-cover bg-center bg-no-repeat dark:block"
      :style="{ backgroundImage: `url(${DarkNotFoundImage})` }"
      aria-hidden="true"
    />

    <div class="relative flex min-h-screen items-center justify-center">
      <div class="mb-50 mx-5 w-full max-w-lg border border-black p-4 text-center backdrop-blur-xs dark:border-white">
        <div class="flex justify-between items-center md:tracking-wide">
          <p>{{ randomPenalty?.title }}</p>
          <p>404 Not Found</p>
        </div>
        <div class="mt-6 space-y-3 text-center dark:text-white text-black">
          <p class="text-base">
            {{ randomPenalty?.description }}
          </p>
          <!-- <p class="text-base">
            {{ randomPenalty?.guidance }}
          </p> -->
        </div>
        <RouterLink
          :to="{ name: 'Overview' }"
          class="mt-6 inline-block font-medium dark:text-amber-500 text-red-600 hover:underline"
        >
          home
        </RouterLink>
      </div>
    </div>
  </section>
</template>
