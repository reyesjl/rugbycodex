<script lang="ts">

</script>
<template>
  <footer class="bg-black/90 pt-40 pb-60 text-xs text-white">
      <div class="container mx-auto grid items-start gap-12 md:grid-cols-6">
        <div class="space-y-4">
          <h2 class="tracking-wide text-neutral-100">Explore</h2>
          <nav class="flex flex-col gap-2 text-neutral-300">
            <RouterLink class="transition-colors hover:text-white" to="/">Home</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/roles">Roles</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/mission">Mission</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/acknowledgements">Acknowledgements</RouterLink>
          </nav>
        </div>

        <div class="space-y-4 text-neutral-300 md:col-span-3">
          <h2 class="tracking-wide text-neutral-100">About</h2>
          <p class="leading-relaxed">
            Rugbycodex imagines a shared language for the sport; where video, narration, and context meet.
            We’re building a platform that lets clubs and coaches preserve ideas, experiment with tactics,
            and keep institutional knowledge alive for the next season and beyond. Questions? Reach us at
            <a class="underline transition-colors hover:text-white"
              href="mailto:contact@biasware.com">contact@biasware.com</a>
          </p>
        </div>
      </div>
    </footer>
</template>
<style scoped>
</style>
