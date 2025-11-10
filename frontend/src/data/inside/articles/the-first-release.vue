<script setup lang="ts">
import type { InsideEntry } from '../index';
import ShareLinkButton from '@/components/ShareLinkButton.vue';

const { entry } = defineProps<{
    entry: InsideEntry;
}>();
</script>

<template>
    <article class="mt-20 text-neutral-800 dark:text-neutral-100">
        <header class="space-y-3 pb-20 border-b-2 border-neutral-400/50">
            <div class="text-xs flex flex-col md:flex-row justify-center items-center mb-10 md:gap-3">
                <div>{{ entry.date }}</div>
                <div class="flex items-center gap-3 text-neutral-500">
                    <div v-for="tag in entry.tags" :key="tag">{{ tag }}</div>
                </div>
            </div>
            <h1 class="text-3xl md:text-4xl text-center mb-10">{{ entry.title }}</h1>
            <p class="text-lg md:w-3/4 mx-auto text-center">{{ entry.summary }}</p>
        </header>

        <ShareLinkButton />

        <section class="space-y-8 antialiased text-lg">
            <p>The <span class="text-amber-600 dark:text-amber-300">first major release of Rugbycodex</span> marked the moment it transformed from a technical demo into a
                living, breathing platform. <span class="text-amber-600 dark:text-amber-300">Version 1.0.0 introduced a foundation</span> for how
                Rugbycodex feels, moves, and communicates its purpose to the rugby world.</p>

            <p>The public site launched with a clear visual rhythm and storytelling flow, designed to help players and
                coaches immediately understand the ideas behind <span class="text-amber-600 dark:text-amber-300">Narrations, Threads, and Vaults</span>. The new hero visuals
                and navigation gave the platform a distinct identity, turning complex technology into something human
                and approachable.
            </p>

            <p>
                Under the surface, this release established a <span class="text-amber-600 dark:text-amber-300">consistent typography and layout system</span> to unify every
                future page. It also brought full support for light and dark themes, ensuring Rugbycodex feels at home
                whether on a laptop in the clubhouse or a phone on the sideline.
            </p>

            <p>While mostly just a design oriented update, it set the stage for everything that follows. It
                prepared the interface for <span class="text-amber-600 dark:text-amber-300">live data, user interactions, and evolving stories</span> that will define
                Rugbycodex as it grows.
            </p>
        </section>
    </article>
</template>
