<script setup lang="ts">
import { Icon } from '@iconify/vue';

type FooterLink = {
  label: string;
  href: string;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

type FooterSectionWithId = FooterSection & { id: string };

const sections: FooterSection[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Early Access for Your Team', href: '#' },
      { label: 'Download Whitepaper', href: '#' },
      { label: 'Download Narration Guidelines', href: '#' },
      { label: 'The Annotation Economy Explained', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'Glossary', href: '#' },
      { label: 'Narration Guidelines', href: '#' },
      { label: 'Annotation Examples', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '#' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Cookie Policy', href: '#' },
    ],
  },
];

const footerSections: FooterSectionWithId[] = sections.map((section) => ({
  ...section,
  id: `footer-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
}));

const socialLinks = [
  { icon: 'carbon:logo-linkedin', label: 'LinkedIn', href: '#' },
  { icon: 'carbon:logo-twitter', label: 'Twitter', href: '#' },
  { icon: 'carbon:logo-youtube', label: 'YouTube', href: '#' },
];
</script>

<template>
  <footer
    class="bg-white text-neutral-600 dark:bg-black dark:text-neutral-400 border-t border-black/10 dark:border-white/10 transition-colors duration-300"
    role="contentinfo"
  >
    <div class="max-w-7xl mx-auto px-6 py-32 sm:py-24">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
        <section
          v-for="section in footerSections"
          :key="section.title"
          :aria-labelledby="section.id"
          class="space-y-6"
        >
          <h2
            :id="section.id"
            class="text-xs font-semibold tracking-[0.2em] text-neutral-800 dark:text-neutral-100"
          >
            {{ section.title }}
          </h2>
          <ul class="space-y-3">
            <li v-for="link in section.links" :key="link.label">
              <a
                :href="link.href"
                class="inline-flex items-center text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 transition-colors duration-200 hover:text-black dark:hover:text-white"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </section>
      </div>

      <div
        class="mt-16 pt-8 border-t border-black/10 dark:border-white/10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-xs text-neutral-500 dark:text-neutral-500">
          RugbyCodex 2025 - A Biasware Product. All rights reserved.
        </p>

        <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          <div class="flex items-center gap-4">
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.href"
              class="text-neutral-600 dark:text-neutral-400 transition-colors duration-200 hover:text-black dark:hover:text-white"
              :aria-label="social.label"
            >
              <Icon :icon="social.icon" class="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
