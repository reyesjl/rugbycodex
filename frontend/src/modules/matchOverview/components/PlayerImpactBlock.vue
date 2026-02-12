<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerImpactDTO } from '@/modules/matchOverview/types/MatchOverview';

const props = defineProps<{
  players: PlayerImpactDTO[];
}>();

const players = computed(() => props.players ?? []);
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 space-y-4">
    <div class="text-sm font-semibold text-white/80">Player impact</div>

    <div v-if="players.length === 0" class="text-sm text-white/50">
      Add identity tags to highlight player impact.
    </div>

    <div v-else class="space-y-3 text-sm text-white/70">
      <div
        v-for="player in players"
        :key="player.identity_tag_key"
        class="rounded-md border border-white/10 bg-black/30 px-3 py-2"
      >
        <div class="flex items-center justify-between">
          <div class="font-medium text-white/80">{{ player.player_name || player.identity_tag_key }}</div>
          <div class="text-xs text-white/50">Impact {{ player.impact_score }}</div>
        </div>
        <div class="mt-1 text-xs text-white/50">
          {{ player.segment_count }} segments · {{ player.narration_count }} narrations
        </div>
        <div v-if="player.top_actions.length > 0" class="mt-1 text-xs text-white/50">
          Top actions: {{ player.top_actions.join(', ') }}
        </div>
      </div>
    </div>
  </section>
</template>
