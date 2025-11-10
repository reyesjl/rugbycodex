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
                A few days ago, I had the chance to sit down with a top coach to talk about the game we love. Every time
                I get to talk rugby, to dig into the details, hear stories, and share ideas, it
                reminds me what makes this sport so unique. <span class="text-amber-600 dark:text-amber-300">Rugby isn’t just a game; it’s a web of knowledge, history,
                and shared experiences</span> that somehow tie a global community together. Everyone seems to know everyone,
                and word travels fast. Yet even in this tight-knit world, there are still gaps in how we understand and
                communicate the game. Different regions, clubs, and even coaches use their own terms and phrases for the
                same ideas, and that <span class="text-amber-600 dark:text-amber-300">patchwork of language</span> can lead to confusion, missed connections, and lost
                opportunities for growth.
            </p>

            <p>
                I sat down with <span class="text-sky-600 dark:text-sky-300">Simon Cross</span>, the head coach of
                <span class="text-red-600 dark:text-red-300">Old Glory DC</span> and one of the most thoughtful defensive
                minds in modern rugby. A former <span class="text-orange-500 dark:text-orange-300">Edinburgh Rugby</span>
                flanker and long-time coach in both the UK and the United States, Simon brings over two decades of
                experience at the professional level, including roles with
                <span class="text-indigo-700 dark:text-indigo-400">Worcester Warriors</span>,
                <span class="text-blue-900 dark:text-blue-400">Scotland U20s</span>, and
                <span class="text-blue-600 dark:text-blue-300">Edinburgh Accies</span>.
            </p>

            <p>
                Simon’s approach to coaching is grounded in clarity. Whether he’s working with professional
                internationals or academy players, he builds from a simple idea:
                <span class="text-amber-600 dark:text-amber-300">language drives understanding</span>. The way
                a coach defines, repeats, and reinforces terminology becomes the foundation of how a team thinks and
                plays. Over time, those shared words evolve into a kind of
                <span class="text-amber-600 dark:text-amber-300">internal code</span> that shapes habits,
                decisions, and collective rhythm.
            </p>

            <p>
                As we talked, Simon pulled a napkin from the table and began sketching a simple pyramid that, for him,
                captures the rhythm of the game. It wasn’t a playbook or a tactic, but a framework built over decades of
                coaching that helps him see patterns and find clarity when things get messy. Week to week, when
                something goes wrong, he knows exactly where to look and what part of his system needs attention. It’s
                his way of <span class="text-amber-600 dark:text-amber-300">creating control in the chaos</span>, a personal language for understanding the game. That same idea
                sits at the heart of <span class="text-amber-600 dark:text-amber-300">Rugbycodex</span> and our
                <span class="text-amber-600 dark:text-amber-300">Controlled Rugby Vocabulary</span>, building a shared structure that
                helps coaches and players everywhere find meaning in complexity, see what’s working, and speak the same
                language about the game they love.
            </p>

        </section>

    </article>
</template>
