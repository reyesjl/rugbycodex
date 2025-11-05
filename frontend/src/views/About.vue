<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';

type AboutSection = {
  id: string;
  title: string;
};

const sections: AboutSection[] = [
  { id: 'problem', title: 'The Problem with Current Rugby Systems' },
  { id: 'narration', title: 'Narration: The New Building Block of Rugby Analysis' },
  { id: 'vocabulary', title: 'A Shared Rugby Vocabulary and Quality Standards' },
  { id: 'vaults', title: 'Team Vaults: Collaborative Knowledge Hubs' },
  { id: 'opportunities', title: 'Unlocking Opportunities for Coaches and Analysts' },
  { id: 'players', title: 'Empowering Players as Active Learners' },
  { id: 'unions', title: 'Benefits for Unions and the Global Rugby Community' },
  { id: 'evolving', title: 'Evolving with the Game of Rugby' },
];

const isSidebarOpen = ref(false);
const isDesktop = ref(false);

let mediaQuery: MediaQueryList | null = null;
let mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;
let hashChangeListener: ((event: HashChangeEvent) => void) | null = null;

const syncSidebarState = (matches: boolean) => {
  isDesktop.value = matches;
  isSidebarOpen.value = matches;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const navigateToSection = (id: string) => {
  const element = document.getElementById(id);
  if (!element) return;

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!isDesktop.value) {
    isSidebarOpen.value = false;
  }

  if (window.location.hash !== `#${id}`) {
    history.replaceState(null, '', `#${id}`);
  }
};

const handleHashNavigation = () => {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;

  const element = document.getElementById(hash);
  if (!element) return;

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 1024px)');
  syncSidebarState(mediaQuery.matches);

  mediaQueryListener = (event: MediaQueryListEvent) => {
    syncSidebarState(event.matches);
  };
  mediaQuery.addEventListener('change', mediaQueryListener);

  hashChangeListener = () => {
    handleHashNavigation();
  };
  window.addEventListener('hashchange', hashChangeListener);

  if (window.location.hash) {
    window.setTimeout(() => {
      handleHashNavigation();
    }, 50);
  }
});

onBeforeUnmount(() => {
  if (mediaQuery && mediaQueryListener) {
    mediaQuery.removeEventListener('change', mediaQueryListener);
  }

  if (hashChangeListener) {
    window.removeEventListener('hashchange', hashChangeListener);
  }
});
</script>
<template>
  <!-- About hero section -->
  <section class="hero container flex flex-col justify-center items-center min-h-screen">
    <div class="mt-auto text-5xl md:text-8xl text-amber-600 dark:text-amber-300">About</div>
    <p class="mb-auto text-center text-xl md:text-2xl mt-20 text-neutral-600 dark:text-neutral-300">
      A special group of the game’s best thinkers and most grounded people are building Rugbycodex. Coaches, union
      leaders, and people who believe rugby knowledge should be shared.
    </p>
  </section>

  <!-- About content section -->
  <section class="container relative my-20 pt-24 lg:pt-0">
    <button
      type="button"
      class="fixed right-4 top-24 z-40 inline-flex items-center gap-2 rounded-full border border-neutral-200/70 bg-white/60 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur-sm transition hover:bg-white/70 dark:border-neutral-800/60 dark:bg-neutral-950/70 dark:text-neutral-200 dark:hover:bg-neutral-900 lg:static lg:mb-6"
      :aria-expanded="isSidebarOpen"
      aria-controls="about-sidebar"
      @click="toggleSidebar"
    >
      <Icon :icon="isSidebarOpen ? 'carbon:side-panel-close' : 'carbon:side-panel-open'" class="h-4 w-4" />
      <span>{{ isSidebarOpen ? 'Hide outline' : 'Show outline' }}</span>
    </button>

    <div
      v-if="isSidebarOpen && !isDesktop"
      class="fixed inset-0 z-20 bg-neutral-950/40 backdrop-blur-[2px]"
      aria-hidden="true"
      @click="toggleSidebar"
    />

    <div class="lg:flex lg:items-start lg:gap-12">
      <aside
        v-if="isSidebarOpen"
        id="about-sidebar"
        class="fixed left-4 right-4 top-28 z-30 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-neutral-200/40 bg-white/60 p-6 shadow-xl backdrop-blur-sm dark:border-neutral-800/60 dark:bg-neutral-950/70 lg:sticky lg:top-32 lg:left-auto lg:right-auto lg:max-h-[calc(100vh-8rem)] lg:w-72 lg:shadow-none"
      >
        <nav class="space-y-2 text-sm font-medium text-neutral-700 dark:text-neutral-200" aria-label="About outline">
          <button
            v-for="section in sections"
            :key="section.id"
            type="button"
            class="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/70 dark:hover:bg-neutral-900"
            @click="navigateToSection(section.id)"
          >
            {{ section.title }}
          </button>
        </nav>
      </aside>

      <div class="flex-1 space-y-16">
        <div id="problem" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">The Problem with Current Rugby Systems</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Modern rugby teams heavily use video analysis, yet most systems lean on rigid tagging and manual coding of events. Traditional performance analysis still means logging discrete actions—who did what, when, and where—in strict sequence, a tedious process highlighted in Sports Medicine Open. Hours spent breaking down a single match leave coaches stuck in data entry instead of teaching, echoing concerns raised by RugbySmarts. Analysts churn out coded clips and spreadsheets, but real tactical insight often stays locked within small team silos.
            </p>
            <p>
              For a sport that continues to grow, rugby is playing catch-up on data and education infrastructure. Rugby Union only turned fully professional in 1995, and its coaching technology trails other sports. Elite clubs may employ performance analysts, yet broader knowledge-sharing remains limited. Regions such as the United States still lack the systems needed to spread even foundational rugby concepts. Compared with football or basketball’s entrenched coaching pipelines, rugby frequently struggles with thin programs and qualified coaches at the grassroots—Therugbyrant.com points out how the sport lags in players, clubs, and mentors who can nurture talent.
            </p>
            <p>
              This gap in coaching and analysis pipelines stunts talent identification and player development. Even in rugby-rich nations, advanced insights stay locked inside professional environments, while up-and-coming coaches and players rarely access the latest tools or teaching methods. In emerging markets like the United States, core rugby principles often go untaught despite pockets of high rugby IQ. The sport has lacked a modern, accessible platform to share knowledge globally—and that is the problem Rugbycodex is designed to solve.
            </p>
          </div>
        </div>

        <div id="narration" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Narration: The New Building Block of Rugby Analysis</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Rugbycodex’s core innovation is the use of narrations as the foundation of analysis. Instead of solely tagging events with codes or stats, coaches, players, and analysts can record voice or text commentary synchronized with video clips. In practice, adding a narration is as simple as speaking one’s observations while the footage plays. This approach captures not just the what of a play, but the why and how—the coach’s insight, emphasis, and teaching points—in real time. It transforms video analysis from a dry, coded spreadsheet into a living storytelling of the game.
            </p>
            <p>
              Why is narration a game-changer? First, it dramatically eases the burden of manual coding. Coaches no longer need to painstakingly input dozens of tags for every scrum, ruck, or tackle; they can simply talk through the sequence. This saves time and allows analysts to focus on providing insight rather than bookkeeping, as RugbySmarts notes. Second, narrations make analysis more accessible and personal. An MLR coach, for example, can use his own voice and style to explain a defensive pattern or a training drill. Hearing the intonation and emphasis helps players and other coaches grasp nuances that a flat tag or text label might miss. The narration carries the coach’s teaching style—whether that’s an encouraging tone or a firm correction—making the learning experience more engaging, almost as if that coach is in the room delivering one-on-one feedback.
            </p>
            <p>
              Moreover, narrations allow multiple perspectives to be layered on the same footage. Different experts can contribute their own voiceovers on a single clip, each highlighting a distinct angle—for example, a forwards coach noting scrum body shape while a backs coach discusses the subsequent backline move. These multi-angled narrations enrich learning content, capturing the collective intelligence of a coaching staff. Rugbycodex supports both voice and text narrations, so users can choose whichever fits the situation, but the narration-first approach always shifts rugby analysis from rigid tagging to a fluid, context-rich commentary that turns video into a powerful teaching and learning tool.
            </p>
          </div>
        </div>

        <div id="vocabulary" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">A Shared Rugby Vocabulary and Quality Standards</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Underpinning Rugbycodex’s narration system is a controlled rugby vocabulary—a common language for describing the game. Rugby is notorious for its jargon and varied terminology; different coaches might use different words for the same concept. Rugbycodex tackles this by establishing a standardized vocabulary curated by some of the sport’s best minds. By encouraging users to tag and describe plays with this shared lexicon, the platform ensures that narrations speak the same language across the board. Rugbycodex imagines a shared language for the sport where video, narration, and context meet, aligning everyone on terminology and meaning.
            </p>
            <p>
              This consistency doesn’t stifle individual style—coaches naturally have their own flair—but it provides a common framework so that analysis stays clear and unambiguous. A controlled vocabulary enables more powerful indexing and search: if every coach labels a certain pattern as “drift defense,” you can surface all relevant clips without worrying that someone called it “slide defense.” Beyond search, standardized terms let Rugbycodex leverage technology such as speech-to-text and AI to recognize key points in narrations. Over time, the system can learn from the narrations themselves; if many top coaches mention “quick ball” in positive contexts, the platform can start identifying what “good” looks like in those sequences versus when “slow ball” shows up with concern. Shared vocabulary makes it possible to determine what’s bad, good, and great in more objective fashion because everyone references the same concepts.
            </p>
            <p>
              Rugbycodex pairs vocabulary with narration guidelines to uphold quality. Coaches and analysts follow best practices—being concise, focusing on key points, and providing context—shaped by top rugby educators. A reputation system then rewards narrators whose contributions align with these standards. As coaches share helpful narrations that use the shared language well, their reputation grows, creating a meritocracy of insight. Trust signals help users evaluate narrations from coaches they may not know personally, while incentivizing contributors to provide thoughtful, clear analysis that elevates the overall quality of the platform.
            </p>
          </div>
        </div>

        <div id="vaults" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Team Vaults: Collaborative Knowledge Hubs</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              All Rugbycodex content is organized into vaults that serve as collaborative knowledge hubs for teams and organizations. A team vault is a secure, shared space where video footage, narrations, and discussion threads are collected—essentially a living library of rugby knowledge. Every narrated game or training session is stored here, capturing the team’s style of play, emphasis areas, and learning progress over time.
            </p>
            <p>
              Vaults can be public or private. Private vaults keep strategy, analysis, and candid feedback confidential so professional environments can speak freely. Public vaults, or selected public content, let organizations share material with the wider rugby community—think national unions posting educational modules or pro teams releasing narrated highlights. This flexibility preserves competitive secrecy when needed while enabling global knowledge-sharing when desired.
            </p>
            <p>
              Vaults also power collaboration. Because Rugbycodex is cloud-based, coaches and analysts can be invited into one another’s vaults to provide consultancy or mentorship, even across continents. A club might open parts of its vault to showcase how it teaches core skills, or temporarily grant access to an external expert whose narrations later become public learning case studies. By making content easy to preserve, protect, or publish, Rugbycodex ensures that rugby knowledge is either safely stored for the team or amplified to the world—never lost in a notebook or hard drive.
            </p>
          </div>
        </div>

        <div id="opportunities" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Unlocking Opportunities for Coaches and Analysts</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              By rethinking how rugby analysis gets done, Rugbycodex opens new opportunities for coaches, analysts, and even retired experts. Elite-level insight that once stayed locked within team walls can now travel globally. A former international coach might join the platform and offer remote film reviews, giving developing clubs access to feedback that would previously have been unimaginable. Reputation scores and community feedback help teams identify trusted voices whose narrations deliver proven value.
            </p>
            <p>
              For in-house analysts, Rugbycodex shifts the workload from data entry to teaching. Automation and voice narrations reduce the grind of manual coding—echoing RugbySmarts’ emphasis on cutting the busywork—so analysts can invest time in detailed explanations that players actually absorb. Instead of producing spreadsheets, they build rich narrated packages that turn analysis into a direct coaching asset, elevating their profile within the staff.
            </p>
            <p>
              The platform also mirrors modern coaching structures by enabling multiple coaches to contribute narrations to the same game. Attack, defense, and unit specialists each add their perspective, creating a comprehensive, timely analysis bundle. The end result is higher-quality insight delivered faster—and a broader marketplace for rugby knowledge where experienced coaches extend their influence and emerging analysts make their mark.
            </p>
          </div>
        </div>

        <div id="players" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Empowering Players as Active Learners</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Rugbycodex empowers players to take charge of their development instead of remaining passive in film sessions. Players can record their own narrations on personal clips, articulating what they saw and why they acted the way they did. This self-analysis builds rugby IQ by forcing clarity of thought and creating a record coaches can respond to. When players share narrations in the vault, coaches and teammates gain a window into the player’s perspective and can add feedback or supplemental voiceovers.
            </p>
            <p>
              Each narrated clip can spark threaded discussions that turn review into collaborative problem-solving. A player might ask whether a decision was correct; coaches reply with guidance, and teammates add context from their vantage point. Coach-logic.com cautions against one-way monologues in video review, and Rugbycodex addresses that by encouraging two-way dialogue that keeps players engaged and accountable for their learning.
            </p>
            <p>
              Players also benefit from exposure to diverse coaching styles. Public vaults or invited experts let them hear from renowned coaches worldwide, sometimes unlocking understanding that local phrasing didn’t provide. By making analysis interactive and social—complete with comments, likes, and on-demand access—Rugbycodex turns film study into an engaging habit. Players evolve into active learners who continuously refine their understanding of the game.
            </p>
          </div>
        </div>

        <div id="unions" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Benefits for Unions and the Global Rugby Community</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Rugbycodex scales beyond teams to support unions, coach educators, and the broader rugby ecosystem. National governing bodies can create public vaults stocked with narrated coaching modules, ensuring grassroots coaches access consistent, high-quality guidance. Majorleague.rugby has highlighted the push for better coach education; Rugbycodex delivers it through rich media and ongoing interaction that far outpaces static manuals.
            </p>
            <p>
              Unions can embed Rugbycodex into certification pathways by asking candidates to upload narrated training sessions for feedback, a model already hinted at in World Rugby Level 3 programs documented by Coach Logic. This turns coach development into a continuous digital mentorship loop. Shared vocabulary keeps terminology aligned across regions, while narrated vaults enable scouts to evaluate talent more objectively by reviewing standardized, contextualized clips.
            </p>
            <p>
              Globally, the platform helps emerging rugby nations bridge expertise gaps. Coaches in traditional powerhouses can publish analyses that others adapt, addressing challenges such as the shortage of experienced mentors noted by Therugbyrant.com. As clubs, unions, and educators share insights, Rugbycodex fosters a worldwide rugby conversation where great ideas flow freely and no coach or player is left behind due to geography or resources.
            </p>
          </div>
        </div>

        <div id="evolving" class="space-y-6 scroll-mt-32">
          <h2 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Evolving with the Game of Rugby</h2>
          <div class="space-y-6 text-lg text-neutral-700 dark:text-neutral-300">
            <p>
              Rugby is a living sport, constantly changing through new laws and tactical trends, so Rugbycodex is designed to evolve alongside it. An adaptive vocabulary keeps the lexicon current as fresh terminology enters the game, ensuring narrations stay relevant while capturing a running history of rugby’s progression.
            </p>
            <p>
              Community feedback loops allow the platform to spot effective coaching practices and elevate them, turning innovation from individual experiments into shared guidelines. Technologically, Rugbycodex can incorporate emerging tools—automated tagging, data overlays, AI suggestions—always keeping the coach’s narration at the center while enhancing it with smart assistance.
            </p>
            <p>
              For unions and teams alike, investing in Rugbycodex means embracing a platform that remains future-proof. As rugby advances, so does the collective knowledge stored within Rugbycodex, ensuring coaches and players have the latest insights and tools at their fingertips.
            </p>
            <p>
              Ultimately, Rugbycodex is more than software; it’s a comprehensive approach to rugby learning, analysis, and communication. By replacing rigid tagging with rich narrations, breaking down silos through shared vaults, and leveraging a global community, it invites everyone in rugby to raise the sport’s collective IQ. When a teenage player in a new market can learn directly from an international coach’s narration, or a club’s season-long lessons are preserved for future squads, Rugbycodex’s vision becomes reality: a world where rugby knowledge flows freely, guided by the community and evolving in lockstep with the game itself.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <p class="text-center text-sm text-neutral-500 dark:text-neutral-400">
    Stay updated—visit the
    <RouterLink to="/releases"
      class="underline decoration-dotted underline-offset-4 transition hover:text-neutral-900 dark:hover:text-neutral-100">
      Releases page
    </RouterLink>
    often to read about the latest updates.
  </p>
</template>
<style lang="css" scoped></style>
