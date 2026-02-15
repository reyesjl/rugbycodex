<script setup lang="ts">
const acknowledgements = [
  'Tony Flay',
  'Grant Keenan',
  'Gabrielle Domina',
  'Benn Mellinger',
  'Eric Shupp',
  'Owen Lentz',
  'Alex Webb',
  'Tim Brown',
  'Simon Cross',
  'Steff Hughes',
  'Joseph Ritter',
  'Aidan Gallagher',
  'Kevin Dougherty',
  'Corey Kroboth',
  'Dom Tom',
  'Jacob Powers',
];
</script>

<template>
  <section class="bg-black text-white navclear">
    <div class="container mx-auto py-10 pb-50">
      <h1 class="text-3xl md:text-4xl text-center">Acknowledgements</h1>
      <div class="mt-6 space-y-4 text-sm text-white/70">
        <p>
          Rugbycodex exists only because of the people who believed in the idea before it was fully formed, who challenged it, improved it, and helped turn it into something real.
        </p>
        <p>
          Thank you to everyone who contributed their time, knowledge, and perspective along the way. Your feedback, conversations, and encouragement helped shape not just the product, but the thinking behind it.
        </p>
        <p>
          This project was built on shared passion for the game, curiosity about what better analysis can unlock, and the willingness of others to invest energy into something new. That support made the difficult parts possible and the wins meaningful.
        </p>
      </div>
      <div class="mt-6 flex flex-wrap gap-3 text-sm text-white font-semibold">
        <span v-for="name in acknowledgements" :key="name">{{ name }}</span>
      </div>
    </div>
  </section>
</template>
