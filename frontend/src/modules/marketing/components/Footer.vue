<script lang="ts">

</script>
<template>
  <footer class="bg-black/90 pt-40 pb-60 text-xs text-white">
      <div class="container mx-auto grid items-start gap-12 md:grid-cols-6">
        <div class="space-y-4">
          <h2 class="tracking-wide text-neutral-100">Explore</h2>
          <nav class="flex flex-col gap-2 text-neutral-300">
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing">Home</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing/coaches">Coaches</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing/players">Players</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing/unions">Unions</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing/unions">Inside the Codex</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/v2/marketing/unions">Mission</RouterLink>
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

        <div class="space-y-4 md:col-span-2">
          <h2 class="tracking-wide text-neautral-100">Credits</h2>
          <p class="leading-relaxed">
            Development <br />
            Jose Reyes <a class="text-neutral-400" href="https://www.youtube.com/watch?v=mbOP11df6QY">@reyesjl</a>
            <br />
            Benn Mellinger <a class="text-neutral-400" href="https://github.com/bennm23" target="_blank"
              rel="noreferrer">@bennm23</a>
          </p>
          <p class="leading-relaxed">
            Built by<br />
            Biasware <a class="text-neutral-400" href="https://biasware.com">Biasware.com</a>
          </p>
        </div>
      </div>
    </footer>
</template>
<style scoped>
</style>