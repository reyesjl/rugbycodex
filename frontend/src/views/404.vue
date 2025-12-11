<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

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
    guidance: 'Reset the scrum. Back to home.',
  },
  {
    title: 'Side Entry',
    description: 'You tried to enter this route from the side.',
    guidance: 'Use the gate properly this time.',
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

const randomPenalty = ref(getRandomPenalty());

function getRandomPenalty() {
  return penalties[Math.floor(Math.random() * penalties.length)];
}

function refreshPenalty() {
  randomPenalty.value = getRandomPenalty();
}
</script>

<template>
  <section class="bg-black h-screen">
    <div class="w-full lg:w-1/4 md:w-1/2 px-8 mx-auto h-full flex flex-col space-y-10 justify-center items-center text-white">
      <div class="text-3xl font-semibold tracking-widest">404 Sinbin</div>
      
      <div class="flex flex-col w-full space-y-2">
        <div class="text-xl">{{ randomPenalty?.title }}</div>
        <div>{{ randomPenalty?.description }}</div>
        <div class="text-xs text-yellow-300">{{ randomPenalty?.guidance }}</div>
      </div>

      <div class="flex w-full items-center justify-between">
        <RouterLink to="/" class="underline text-xs text-gray-300">Return Home</RouterLink>
        <button type="button" class="underline text-xs text-gray-300" @click="refreshPenalty">Another Penalty</button>
        <a href="mailto:contact@biasware.com" class="underline text-xs text-gray-300">Contact support</a>
      </div>
    </div>
  </section>
</template>
