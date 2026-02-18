<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { animateMini, inView } from 'motion';
import type { DOMKeyframesDefinition } from 'motion';
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import { CDN_BASE } from '@/lib/cdn';

type RoleKey = 'coaches' | 'players' | 'unions';

const route = useRoute();
const router = useRouter();
const roleOrder: RoleKey[] = ['unions', 'players', 'coaches'];

const roleConfig: Record<RoleKey, {
  tabLabel: string;
  roleLabel: string;
  heroHeadline: string;
  heroSubhead: string;
  heroBgClass: string;
  systemTitle: string;
  systemCode: string;
  outcomes: string[];
  outcomesImage: string;
  outcomesGlowClass: string;
  supportingParagraph: string;
  heroCtaLabel: string;
  heroCtaTo: string;
  cta: {
    headline: string;
    subtext: string;
    primaryLabel: string;
    primaryTo: string;
    bgColor: string;
    buttonColor: string;
  };
  seoTitle: string;
  seoDescription: string;
}> = {
  coaches: {
    tabLabel: 'Coaches',
    roleLabel: 'Coaches',
    heroHeadline: 'Turn Match Insight Into Coaching Clarity.',
    heroSubhead: 'From scattered clips to one tactical system your squad understands.',
    heroBgClass: 'bg-gradient-to-b from-zinc-800/80 via-zinc-900/80 to-black',
    systemTitle: 'Tactical Learning System',
    systemCode: 'TLS',
    outcomes: [
      'Break down matches faster without losing context.',
      'Spot patterns and system breakdowns across games.',
      'Standardize tactical language across your squad.',
      'Turn match narration into actionable teaching moments.',
    ],
    outcomesImage: `${CDN_BASE}/static/assets/modules/marketing/simon.jpg`,
    outcomesGlowClass: 'shadow-[0_0_50px_rgba(161,161,170,0.35)]',
    supportingParagraph: 'Coaches move from isolated reviews to repeatable team learning, with every clip tied to clear language and next actions.',
    heroCtaLabel: 'Join the Waitlist',
    heroCtaTo: '/auth/waitlist',
    cta: {
      headline: 'Build a smarter rugby brain for your team.',
      subtext: 'Turn match footage into shared understanding. Teach faster. Align everyone.',
      primaryLabel: 'Join the Waitlist',
      primaryTo: '/auth/waitlist',
      bgColor: 'bg-gradient-to-b from-black via-zinc-900/80 to-zinc-800/80',
      buttonColor: 'bg-zinc-800',
    },
    seoTitle: 'Rugbycodex for Coaches | Roles',
    seoDescription: 'Break down matches faster with searchable narrations, layered clip insights, and shared coaching workflows.',
  },
  players: {
    tabLabel: 'Players',
    roleLabel: 'Players',
    heroHeadline: 'Know Exactly What to Improve.',
    heroSubhead: 'From raw performance to targeted development priorities.',
    heroBgClass: 'bg-gradient-to-b from-red-800/90 via-red-900/80 to-black',
    systemTitle: 'Personal Insight Engine',
    systemCode: 'Pie',
    outcomes: [
      'Identify your strengths and expose improvement areas instantly.',
      'Search every moment you’ve played using real rugby terminology.',
      'Turn voice-led analysis into structured, trackable development.',
      'Train with clarity instead of guessing what to fix.',
    ],
    outcomesImage: `${CDN_BASE}/static/assets/modules/marketing/corey.png`,
    outcomesGlowClass: 'shadow-[0_0_50px_rgba(239,68,68,0.35)]',
    supportingParagraph: 'Players get a direct line from performance moments to practical work-ons, so development becomes specific, measurable, and faster.',
    heroCtaLabel: 'Join the Waitlist',
    heroCtaTo: '/auth/waitlist',
    cta: {
      headline: 'See your game. Understand your impact.',
      subtext: 'Your footage, your actions, your development. Structured and searchable.',
      primaryLabel: 'Join the Waitlist',
      primaryTo: '/auth/waitlist',
      bgColor: 'bg-gradient-to-b from-black via-red-900/80 to-red-800/80',
      buttonColor: 'bg-red-800',
    },
    seoTitle: 'Rugbycodex for Players | Roles',
    seoDescription: 'Track your growth with searchable clips, coach context, and role-specific work-ons from your own footage.',
  },
  unions: {
    tabLabel: 'Unions',
    roleLabel: 'Unions',
    heroHeadline: 'Unify Regional Rugby Intelligence.',
    heroSubhead: 'From fragmented regional signals to unified intelligence for development and growth.',
    heroBgClass: 'bg-gradient-to-b from-blue-800/70 via-blue-900/80 to-black',
    systemTitle: 'Rugby Growth Framework',
    systemCode: 'RGF',
    outcomes: [
      'See regional strengths and development gaps in real time.',
      'Track player pathway progression across clubs and age grades.',
      'Benchmark coaching standards with shared performance language.',
      'Generate elite-quality highlights to power marketing and sponsorship.',
    ],
    outcomesImage: `${CDN_BASE}/static/assets/modules/marketing/usaw.jpg`,
    outcomesGlowClass: 'shadow-[0_0_50px_rgba(59,130,246,0.35)]',
    supportingParagraph: 'Unions can prioritize resources with confidence, align standards across environments, and communicate progress with credible evidence.',
    heroCtaLabel: 'Talk With Us',
    heroCtaTo: '/auth/waitlist',
    cta: {
      headline: 'Build a clearer pathway. Raise the standard.',
      subtext: 'Unify analysis, develop coaches, and surface talent across your region.',
      primaryLabel: 'Talk With Us',
      primaryTo: '/auth/waitlist',
      bgColor: 'bg-gradient-to-b from-black via-blue-900/80 to-blue-800/80',
      buttonColor: 'bg-blue-800',
    },
    seoTitle: 'Rugbycodex for Unions | Roles',
    seoDescription: 'Unify coaching standards, benchmark pathways, and surface regional talent with shared rugby intelligence.',
  },
};

const normalizeRole = (value: unknown): RoleKey | null => {
  if (typeof value !== 'string') return null;
  if (value === 'coaches' || value === 'players' || value === 'unions') return value;
  return null;
};

const activeRole = computed<RoleKey>(() => normalizeRole(route.query.role) ?? 'coaches');
const activeConfig = computed(() => roleConfig[activeRole.value]);

const runScrollAnimations = async () => {
  await nextTick();

  const keyframes: DOMKeyframesDefinition = {
    opacity: [0, 1],
    transform: ['translateY(16px)', 'translateY(0px)'],
  };

  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-role-motion]'));
  elements.forEach((element) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(16px)';
    delete element.dataset.motionDone;
  });

  inView(
    elements,
    (element) => {
      const target = element as HTMLElement;
      if (target.dataset.motionDone === 'true') return;
      animateMini(target, keyframes, { duration: 0.6, ease: 'easeOut' });
      target.dataset.motionDone = 'true';
    },
    { amount: 0.2 },
  );
};

const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector<globalThis.HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const syncSeoMeta = (role: RoleKey) => {
  const config = roleConfig[role];
  if (typeof document === 'undefined') return;
  document.title = config.seoTitle;
  setMetaTag('name', 'description', config.seoDescription);
  setMetaTag('property', 'og:title', config.seoTitle);
  setMetaTag('property', 'og:description', config.seoDescription);
};

const setRole = (role: RoleKey) => {
  if (role === activeRole.value) return;
  router.push({
    name: 'MarketingRoles',
    query: { ...route.query, role },
  });
};

onMounted(() => {
  if (!normalizeRole(route.query.role)) {
    router.replace({
      name: 'MarketingRoles',
      query: { ...route.query, role: 'coaches' },
    });
  }
  void runScrollAnimations();
});

watch(activeRole, (role) => {
  syncSeoMeta(role);
}, { immediate: true });

watch(activeRole, () => {
  void runScrollAnimations();
});
</script>

<template>
  <section class="navclear bg-black text-white border-b border-white/10" data-role-motion>
    <div class="container-lg pt-10 pb-6">
      <div class="flex items-center gap-3">
        <button
          v-for="role in roleOrder"
          :key="role"
          type="button"
          class="px-4 py-2 text-sm md:text-base border rounded-full transition-colors"
          :class="activeRole === role
            ? 'border-white bg-white text-black'
            : 'border-white/40 text-white hover:border-white'"
          @click="setRole(role)"
        >
          {{ roleConfig[role].tabLabel }}
        </button>
      </div>
    </div>
  </section>

  <div data-role-motion>
    <LandingThreeColumnSection
      :key="`landing-${activeRole}`"
      :role-label="activeConfig.roleLabel"
      :hero-headline="activeConfig.heroHeadline"
      :hero-subhead="activeConfig.heroSubhead"
      :hero-bg-class="activeConfig.heroBgClass"
      :primary-cta-label="activeConfig.heroCtaLabel"
      :primary-cta-to="activeConfig.heroCtaTo"
      :system-title="activeConfig.systemTitle"
      icon="carbon:chevron-down-outline"
    />
  </div>

  <section :key="`outcomes-${activeRole}`" class="bg-black text-white py-20">
    <div class="container-lg grid items-stretch gap-8 md:gap-14 md:grid-cols-2">
      <div class="h-full min-h-[260px] md:min-h-[440px] rounded-xl" :class="activeConfig.outcomesGlowClass" data-role-motion>
        <img
          :src="activeConfig.outcomesImage"
          :alt="`${activeConfig.roleLabel} audience`"
          class="h-full w-full rounded-xl object-cover"
        />
      </div>
      <div class="space-y-6" data-role-motion>
      <h2 class="text-4xl md:text-6xl">What You Gain</h2>
      <ul class="space-y-4">
        <li
          v-for="outcome in activeConfig.outcomes"
          :key="outcome"
          class="border border-white/20 bg-white/5 p-4 text-base md:text-lg"
          data-role-motion
        >
          {{ outcome }}
        </li>
      </ul>
      <p class="text-base md:text-lg text-white/80 max-w-4xl">{{ activeConfig.supportingParagraph }}</p>
      </div>
    </div>
  </section>

  <AudienceCTA
    :key="`cta-${activeRole}`"
    :headline="activeConfig.cta.headline"
    :subtext="activeConfig.cta.subtext"
    :primary-label="activeConfig.cta.primaryLabel"
    :primary-to="activeConfig.cta.primaryTo"
    learn-more-to="/mission"
    :bg-color="activeConfig.cta.bgColor"
    :button-color="activeConfig.cta.buttonColor"
  />
</template>
