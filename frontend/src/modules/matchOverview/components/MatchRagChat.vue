<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { EffectCoverflow } from 'swiper/modules';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import { analysisService } from '@/modules/analysis/services/analysisService';
import type { MatchRagClip, MatchRagResponse } from '@/modules/analysis/types/MatchRag';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { CDN_BASE } from '@/lib/cdn';
import 'swiper/swiper.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  response?: MatchRagResponse;
  error?: string;
  pending?: boolean;
};

const props = defineProps<{
  mediaAssetId: string;
}>();

const input = ref('');
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
let messageCounter = 0;
const route = useRoute();
const router = useRouter();
const orgSlug = computed(() => String(route.params.slug ?? '').trim());
const { displayName } = useProfileDisplay();
const hasInput = computed(() => input.value.trim().length > 0);
const swiperModules = [EffectCoverflow];

const allPrompts = [
  'What defensive patterns repeated most in this match?',
  'Where did our line speed or spacing break down?',
  'What were the recurring breakdown issues?',
  'Where and how did we lose territory?',
  'How effective was our exit strategy under pressure?',
  'How did our kicking decisions impact field position?',
  'Where did our kick chase connect or disconnect?',
  'Which attacking structures created the most advantage?',
  'Where did our attacking shape break down?',
  'What themes emerged in our set piece work?',
  'Where did we lose momentum and why?',
  'What recurring issues should shape this week’s training?'
];

const visiblePrompts = ref<string[]>([]);

function formatSeconds(value: number | null | undefined): string {
  const total = Math.max(0, Number(value ?? 0));
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTimeRange(start: number | null | undefined, end: number | null | undefined): string {
  return `${formatSeconds(start)}-${formatSeconds(end)}`;
}

function pushMessage(msg: ChatMessage) {
  messages.value = [...messages.value, msg];
}

function updateMessage(id: string, patch: Partial<ChatMessage>) {
  messages.value = messages.value.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg));
}

function nextMessageId() {
  messageCounter += 1;
  return `${Date.now()}-${messageCounter}`;
}

function refreshPrompts() {
  const shuffled = [...allPrompts].sort(() => Math.random() - 0.5);
  visiblePrompts.value = shuffled.slice(0, 4);
}

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
});

function clipTitle(clip: MatchRagClip): string {
  if (clip.segment_title) return clip.segment_title;
  if (clip.segment_index !== null && clip.segment_index !== undefined) {
    return `Segment ${clip.segment_index + 1}`;
  }
  return 'Segment clip';
}

function clipSentence(clip: MatchRagClip): string {
  return clip.segment_sentence || clip.reason;
}

function clipThumbnailUrl(clip: MatchRagClip): string | null {
  if (!clip.media_asset_thumbnail_path) return null;
  return `${CDN_BASE}/${clip.media_asset_thumbnail_path}`;
}

function openClip(clip: MatchRagClip) {
  if (!clip.media_segment_id || !orgSlug.value) return;
  router.push({
    name: 'MediaAssetSegment',
    params: {
      slug: orgSlug.value,
      segmentId: clip.media_segment_id,
    },
  });
}

async function sendQuery(query: string) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed || sending.value) return;
  sending.value = true;
  messages.value = [];
  pushMessage({ id: nextMessageId(), role: 'user', text: trimmed });
  input.value = '';
  const pendingId = nextMessageId();
  pushMessage({ id: pendingId, role: 'assistant', pending: true });
  try {
    const response = await analysisService.askMatchRag(props.mediaAssetId, trimmed);
    updateMessage(pendingId, { pending: false, response });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not analyze right now. Try again.';
    updateMessage(pendingId, { pending: false, error: message });
  } finally {
    sending.value = false;
  }
}

function handleSubmit() {
  void sendQuery(input.value);
}

refreshPrompts();
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 text-white space-y-6">
    <div class="text-center space-y-2">
      <div class="text-3xl">{{ greeting }}, {{ displayName }}</div>
      <div class="text-xl text-white/70">Can we help you with this match?</div>
    </div>

    <div class="space-y-2">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          v-for="prompt in visiblePrompts"
          :key="prompt"
          type="button"
          class="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
          :disabled="sending"
          @click="sendQuery(prompt)"
        >
          {{ prompt }}
        </button>
      </div>
      <button
        type="button"
        class="text-xs text-white/40 hover:text-white/60"
        :disabled="sending"
        @click="refreshPrompts"
      >
        Refresh prompts
      </button>
    </div>

    <div class="relative w-full">
      <textarea
        v-model="input"
        rows="2"
        placeholder="Ask about this match..."
        class="w-full min-h-[56px] resize-none rounded-md border border-white/10 bg-black/30 px-3 py-3 pr-12 text-sm text-white/90 placeholder:text-white/40 focus:border-blue-400/60 focus:outline-none"
        :disabled="sending"
        @keydown.enter.prevent="handleSubmit"
      />
      <button
        v-if="hasInput"
        type="button"
        class="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm hover:bg-blue-500/90 disabled:opacity-60"
        :disabled="sending"
        @click="handleSubmit"
      >
        <Icon icon="carbon:arrow-up" class="h-4 w-4" />
      </button>
    </div>

    <div class="text-xs text-white/40">
      Rugbycodex derives insight from match summaries and coaching notes. Validate before making performance decisions.
    </div>

    <div v-if="messages.length > 0" class="space-y-3">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="rounded-md border border-white/10 bg-black/30 px-3 py-2"
      >
        <div v-if="msg.role === 'user'" class="text-sm text-white">
          {{ msg.text }}
        </div>
        <div v-else class="space-y-3 text-sm text-white/90">
          <div v-if="msg.error" class="text-red-200">
            {{ msg.error }}
          </div>
          <div v-else-if="msg.pending" class="flex items-center gap-3 text-white/70">
            <LoadingDot />
            <div class="flex flex-col gap-1">
              <ShimmerText as="span">Reviewing coach notes and narrations</ShimmerText>
            </div>
          </div>
          <template v-else-if="msg.response">
            <div class="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span class="rounded-full border border-white/10 px-2 py-0.5">Assistant</span>
              <span v-if="msg.response.confidence">
                Confidence: {{ msg.response.confidence }}
              </span>
            </div>
            <div>
              {{ msg.response.answer || 'No answer returned.' }}
            </div>
            <div v-if="msg.response.insufficient_evidence" class="text-white/60">
              Not enough coach notes yet to answer confidently.
            </div>
            <div v-if="msg.response.key_points.length > 0">
              <div class="text-xs uppercase tracking-wide text-white/50">Key points</div>
              <ul class="mt-2 space-y-2">
                <li v-for="point in msg.response.key_points" :key="point.point" class="text-white/80">
                  <div>{{ point.point }}</div>
                </li>
              </ul>
            </div>
            <div v-if="msg.response.recommended_clips.length > 0">
              <div class="text-xs uppercase tracking-wide text-white/50">Recommended clips</div>
              <Swiper
                :modules="swiperModules"
                effect="coverflow"
                :slides-per-view="1.2"
                :centered-slides="true"
                :grab-cursor="true"
                :space-between="12"
                :breakpoints="{
                  640: { slidesPerView: 2.2, spaceBetween: 14 },
                  1024: { slidesPerView: 3.2, spaceBetween: 16 },
                }"
                :coverflow-effect="{ rotate: 12, stretch: 0, depth: 140, modifier: 1, slideShadows: false }"
                class="mt-3 overflow-visible"
              >
                <SwiperSlide
                  v-for="clip in msg.response.recommended_clips"
                  :key="clip.media_segment_id"
                >
                  <button
                    type="button"
                    class="w-full rounded-md border border-white/10 bg-black/20 p-3 text-left transition hover:border-blue-400/40 hover:bg-white/5"
                    @click="openClip(clip)"
                  >
                    <div class="h-[120px] w-full overflow-hidden rounded-md bg-black/40 sm:h-[140px]">
                      <img
                        v-if="clipThumbnailUrl(clip)"
                        :src="clipThumbnailUrl(clip)!"
                        :alt="clipTitle(clip)"
                        class="h-full w-full object-cover"
                      />
                      <div v-else class="flex h-full w-full items-center justify-center text-xs text-white/50">
                        No preview
                      </div>
                    </div>
                    <div class="mt-3 space-y-1">
                      <div class="text-sm font-medium text-white/90">
                        {{ clipTitle(clip) }}
                      </div>
                      <div class="text-xs text-white/60">
                        {{ clipSentence(clip) }}
                      </div>
                      <div class="text-xs text-white/50">
                        <span v-if="clip.segment_index !== null && clip.segment_index !== undefined">
                          Segment {{ clip.segment_index + 1 }}
                        </span>
                        <span v-if="clip.start_seconds !== null && clip.end_seconds !== null">
                          {{ clip.segment_index !== null && clip.segment_index !== undefined ? ' • ' : '' }}
                          {{ formatTimeRange(clip.start_seconds, clip.end_seconds) }}
                        </span>
                      </div>
                    </div>
                  </button>
                </SwiperSlide>
              </Swiper>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
@import 'swiper/css/effect-coverflow';
</style>
