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
                The <span class="text-amber-600 dark:text-amber-300">semi-open beta</span> marks the next chapter in the evolution of Rugbycodex. We are moving very fast to bring it
                into the hands of the rugby community. For the first time, users can <span class="text-amber-600 dark:text-amber-300">register for beta accounts</span> and join
                us in shaping the platform as it comes to life.
            </p>

            <p>
                We are onboarding <span class="text-amber-600 dark:text-amber-300">two major clubs</span> to lead this phase, one professional and one at the club level, to
                represent both ends of the rugby spectrum. Their experiences will help us understand how Rugbycodex
                performs in real-world environments, from elite setups to grassroots systems. We are also accepting
                inquiries from other clubs interested in joining as we expand access.
            </p>

            <p>
                During the beta, we are testing the full system internally while preparing to launch a <span class="text-amber-600 dark:text-amber-300">public vault</span> where
                all registered members can interact with live content, explore new features, and follow the progress of
                our build in real time. This shared space will offer an early glimpse into how <span class="text-amber-600 dark:text-amber-300">narrations, vaults, and
                threads</span> work together to preserve and organize rugby knowledge.
            </p>

            <p>
                With the help of the rugby community, this stage is about more than debugging or polishing features. It
                is about <span class="text-amber-600 dark:text-amber-300">listening to workflows</span>, understanding what players need
                most, and refining the experience until it truly fits the people who live this game every day. For the
                first time, we are giving rugby what it deserves: <span class="text-amber-600 dark:text-amber-300">front row seats and a voice</span> in shaping the technology
                that will carry its lessons forward.
            </p>

        </section>

    </article>
</template>
