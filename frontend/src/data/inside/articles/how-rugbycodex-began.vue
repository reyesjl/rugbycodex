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
            <p>
                Every coach knows the feeling. You are out on the field, the sun is low, and the boys are running
                through drills that look simple on the surface but demand real attention to detail. The session is
                flowing, the voices are sharp, and every little cue matters. <span class="text-amber-600 dark:text-amber-300">That is where Rugbycodex began.</span>
            </p>

            <p>
                One day I reached out to an old coach out of the blue. He was connected to the <span class="text-red-700 dark:text-red-400">Crusaders International
                Academy</span>, and I knew he would bring the experience and precision I wanted. He had always taught me about
                the finer points of rugby, the details that separate good players from great ones. I asked him to come
                out to Washington DC, where I was running preseason with some of the boys from my club.
            </p>

            <p>
                I wanted him to teach them what he once taught me: the best amateurs make the best pros. Stealing a
                look,
                front foot loading, catching early, and staying square off the line. We call them <span class="text-amber-600 dark:text-amber-300">first touch
                principles</span>, and they're among the most fundamental skills that top teams and players still obsess
                over. They are evident in every aspect of the game and separate the best from the rest.
            </p>

            <p>
                I watched him run the session and it struck me how clearly he could reach the players. Every cue landed,
                every correction made sense, and the energy on the field shifted. I filmed everything, about forty clips
                in total with a camcorder I got from a good friend.
            </p>

            <p>
                That night, watching the footage back, I realized something simple but powerful. Every great session,
                every lesson, every voice from the sideline disappears once the cones are packed away. <span class="text-amber-600 dark:text-amber-300">But it doesn’t
                have to.</span>
            </p>

            <p>
                <span class="text-amber-600 dark:text-amber-300">Rugbycodex began with that idea, that rugby knowledge could live on.</span>
            </p>

            <p>
                With his permission, I started experimenting with the footage. I ran the clips through transcription and
                summarization tools I had been building, then created a <span class="text-amber-600 dark:text-amber-300">simple search interface</span> that could find and
                assemble insights automatically. If I wanted to see the top three drills we ran and his cues for each, I
                could just type the question, and the system would generate a sequence of clips, perfectly timed and
                stitched together from the original footage.
            </p>

            <p>
                It surprised me how powerful it felt.
            </p>

            <p>
                If I could do that with a secondhand camcorder and a few noisy clips, what were coaches and players
                everywhere missing out on?
            </p>

            <p>
                I started reaching out to old friends and coaches who I thought might see the value in it. That is when
                <span class="text-amber-600 dark:text-amber-300">Rugbycodex truly began</span>, with a belief that the knowledge shared on the pitch should never fade once the
                session ends.
            </p>

            <p>
                Today that same idea drives everything we build. <span class="text-amber-600 dark:text-amber-300">Rugbycodex is for every coach and player</span> who knows the
                beauty of this game lives in its details and believes those details deserve to be remembered.
            </p>
        </section>
    </article>
</template>
