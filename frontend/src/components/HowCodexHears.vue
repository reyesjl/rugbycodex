<!-- HowRugbyCodexHears.vue -->
<script setup lang="ts">
import Container from '@/components/Container.vue'
import PrincipleCard from '@/components/PrincipleCard.vue'
import Section from '@/components/Section.vue'
</script>

<template>
  <Section variant="dark" class="text-center">
    <Container class="flex flex-col items-center max-w-6xl">
      <p class="mb-3 text-xs tracking-widest font-semibold text-white/60 dark:text-black/60">
        Our Philosophy
      </p>
      <h2 class="text-3xl md:text-4xl font-semibold">How RugbyCodex Hears the Game</h2>
      <p class="mt-4 max-w-3xl text-balance leading-relaxed text-white/90 dark:text-black/80">
        RugbyCodex learns from the language of the sport itself. Every clip, note, and narration builds a shared
        understanding of how rugby is played and taught.
      </p>

      <div class="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <PrincipleCard
          number="01"
          title="Controlled Vocabulary"
          body="A shared rugby language maps plays, skills, and outcomes to stable terms. That keeps clips comparable across teams and seasons."
          href="/glossary"
          linkLabel="See Glossary"
          icon="carbon:concept"
        />
        <PrincipleCard
          number="02"
          title="Narration as Data"
          body="Coaches and players speak in short, structured lines. Voice becomes metadata: who, what, why—anchored to time."
          href="/narration-guidelines"
          linkLabel="Narration Guidelines"
          icon="carbon:microphone"
        />
        <PrincipleCard
          number="03"
          title="Annotation Layers"
          body="Moments stack into patterns. Tags align to the vocabulary; sequences reveal trends and training links."
          href="/annotation-examples"
          linkLabel="Annotation Examples"
          icon="carbon:layers"
        />
      </div>
    </Container>
  </Section>
</template>
