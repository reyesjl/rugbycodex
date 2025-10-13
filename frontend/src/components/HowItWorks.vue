<!-- src/components/HowItWorksSection.vue -->
<template>
  <Section id="how-it-works">
    <Container class="max-w-6xl">
      <!-- Kicker -->
      <p class="mb-3 text-xs tracking-widest font-semibold text-black/60 dark:text-white/60">
        Our Pipeline
      </p>

      <!-- Headline -->
      <h2 class="text-3xl md:text-4xl font-semibold text-black dark:text-white">
        Upload to Insight. Together.
      </h2>

      <!-- Subheadline -->
      <p class="mt-4 max-w-3xl text-balance leading-relaxed text-black/90 dark:text-white/90">
        RugbyCodex compresses a full match into searchable understanding. Players, coaches,
        and analysts tag and narrate their moments; context layers stack in seconds.
        The more perspectives you add, the richer every decision becomes.
      </p>

      <!-- Proof metric (quiet) -->
      <p class="mt-2 text-sm text-black/60 dark:text-white/60">
        Typical review time: ~3 minutes per player per match.
      </p>

      <!-- Roles -> Convergence -->
      <div class="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <!-- Player -->
        <div class="space-y-3">
          <Icon icon="carbon:person" class="h-8 w-8 text-black dark:text-white" aria-hidden="true" />
          <h3 class="text-lg font-medium text-black dark:text-white">Player Narration</h3>
          <p class="text-black/80 dark:text-white/80">
            Players review and tag their own clips, explaining choices and reactions in their voice.
          </p>
          <ul class="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
            <li class="flex items-center gap-2">
              <Icon icon="carbon:tag-edit" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Moment tags & quick notes
            </li>
            <li class="flex items-center gap-2">
              <Icon icon="carbon:microphone" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Short voice narration
            </li>
          </ul>
        </div>

        <!-- Coach -->
        <div class="space-y-3">
          <Icon icon="carbon:group-presentation" class="h-8 w-8 text-black dark:text-white" aria-hidden="true" />
          <h3 class="text-lg font-medium text-black dark:text-white">Coach Insight</h3>
          <p class="text-black/80 dark:text-white/80">
            Coaches add tactical framing and teaching points that anchor technique to game context.
          </p>
          <ul class="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
            <li class="flex items-center gap-2">
              <Icon icon="carbon:license-draft" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Cues, objectives, and standards
            </li>
            <li class="flex items-center gap-2">
              <Icon icon="carbon:analytics" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Training links & follow-ups
            </li>
          </ul>
        </div>

        <!-- Analyst -->
        <div class="space-y-3">
          <Icon icon="carbon:chart-multitype" class="h-8 w-8 text-black dark:text-white" aria-hidden="true" />
          <h3 class="text-lg font-medium text-black dark:text-white">Analyst Layering</h3>
          <p class="text-black/80 dark:text-white/80">
            Analysts connect moments across games and units, turning tags into measurable patterns.
          </p>
          <ul class="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
            <li class="flex items-center gap-2">
              <Icon icon="carbon:task-approved" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Controlled vocabulary alignment
            </li>
            <li class="flex items-center gap-2">
              <Icon icon="carbon:time" class="h-4 w-4 text-black dark:text-white" aria-hidden="true" />
              Trend & timeline mapping
            </li>
          </ul>
        </div>
      </div>

      <!-- Convergence line -->
      <div class="mt-14 flex items-center justify-center">
        <div class="h-px w-full max-w-5xl bg-black/10 dark:bg-white/10"></div>
      </div>

      <!-- Codex output -->
      <div class="mt-10 flex flex-col items-center text-center">
        <Icon icon="carbon:machine-learning" class="h-10 w-10 text-black dark:text-white" aria-hidden="true" />
        <h4 class="mt-3 text-lg font-medium text-black dark:text-white">The Codex Learns</h4>
        <p class="mt-2 max-w-2xl text-black/80 dark:text-white/80">
          Each narration and tag strengthens the shared rugby model. Search any concept,
          build sequences, and measure improvement. All in one language.
        </p>

        <!-- Optional: minimalist search mockup -->
        <div
          class="mt-6 w-full max-w-xl rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 backdrop-blur-sm"
          role="search"
          aria-label="RugbyCodex search demo"
        >
          <div class="flex items-center gap-3">
            <Icon icon="carbon:search" class="h-5 w-5 text-black/70 dark:text-white/70" aria-hidden="true" />
            <span class="text-black/70 dark:text-white/70">
              Search: <span class="text-black/90 dark:text-white/90">offloads near gainline</span>
            </span>
          </div>
        </div>
      </div>
    </Container>
  </Section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import Section from '@/components/Section.vue';
import Container from '@/components/Container.vue';
</script>