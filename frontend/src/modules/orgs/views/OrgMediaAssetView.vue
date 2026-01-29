<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import HlsPlayer from '@/components/HlsPlayer.vue';
import LoadingDot from '@/components/LoadingDot.vue';
import MediaProcessingStatusBanner from '@/modules/media/components/MediaProcessingStatusBanner.vue';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { mediaService } from '@/modules/media/services/mediaService';
import { useMediaProcessingStatus } from '@/modules/media/composables/useMediaProcessingStatus';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

const DEBUG = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (!DEBUG) return;
  console.debug('[OrgMediaAssetView]', ...args);
}

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const mediaId = computed(() => String(route.params.mediaId ?? ''));
const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

const loading = ref(true);
const error = ref<string | null>(null);
const asset = ref<OrgMediaAsset | null>(null);

const playlistObjectUrl = ref<string | null>(null);

// Processing status composable
const mediaAssetRef = computed(() => asset.value);
const { processingStatus } = useMediaProcessingStatus(mediaAssetRef);

const title = computed(() => {
  if (asset.value?.title?.trim()) return asset.value.title;
  const fileName = asset.value?.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled clip';
});


function handlePlayerError(message: string) {
  error.value = message;
}

async function loadAsset() {
  debugLog('loadAsset(): start', {
    mediaId: mediaId.value,
    activeOrgId: activeOrgId.value,
  });
  loading.value = true;
  error.value = null;
  asset.value = null;
  playlistObjectUrl.value = null;

  try {
    if (!mediaId.value) {
      throw new Error('Missing media id.');
    }

    if (!activeOrgId.value) {
      // Org context is resolved by the router guard; wait until it's available.
      return;
    }

    const found = await mediaService.getById(activeOrgId.value, mediaId.value);
    asset.value = found;

    debugLog('loadAsset(): fetched asset', {
      id: found.id,
      bucket: found.bucket,
      storage_path: found.storage_path,
      base_org_storage_path: found.base_org_storage_path,
      status: found.status,
      streaming_ready: found.streaming_ready,
    });

    // Only fetch playlist if video is ready for streaming
    if (found.streaming_ready) {
      try {
        playlistObjectUrl.value = await mediaService.getPresignedHlsPlaylistUrl(
          activeOrgId.value,
          found.id,
          found.bucket
        );
      } catch (err) {
        if (err instanceof Error && 'cause' in err && err.cause) {
          debugLog('fetchPlaybackPlaylistObjectUrl(): function error', err.cause);
        }
        throw err;
      }
    } else {
      debugLog('loadAsset(): video not ready for streaming yet');
    }

    // Ensure the template swaps from loading state before playback init runs in the player.
    loading.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load clip.';
    debugLog('loadAsset(): error', err);
  } finally {
    loading.value = false;
    debugLog('loadAsset(): done', { loading: loading.value, error: error.value });
  }
}

watch([mediaId, activeOrgId], () => {
  if (!mediaId.value) return;
  if (!activeOrgId.value) return;
  void loadAsset();
}, { immediate: true });
</script>

<template>
  <div class="container space-y-4 py-6 text-white pb-20">
    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading clip…
    </div>

    <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      {{ error }}
    </div>

    <div v-else-if="asset" class="space-y-4">
      <!-- Processing Status Banner -->
      <MediaProcessingStatusBanner 
        v-if="processingStatus.isBlockingProcessing || processingStatus.isBackgroundProcessing" 
        :status="processingStatus" 
        :show-watch-message="true"
        mode="banner"
      />
      
      <div class="overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        <!-- Show player only when video is watchable -->
        <div v-if="processingStatus.isWatchable" class="relative">
          <HlsPlayer
            :src="playlistObjectUrl ?? ''"
            class="w-full h-auto"
            controls
            playsinline
            @error="handlePlayerError"
          />
        </div>
        
        <!-- Placeholder when video is not ready -->
        <div 
          v-else
          class="relative aspect-video bg-black flex items-center justify-center"
        >
          <div class="flex flex-col items-center gap-4 text-center px-6">
            <LoadingDot size="lg" color="#3B82F6" />
            <div>
              <p class="text-lg font-semibold text-white">{{ processingStatus.statusMessage }}</p>
              <p class="text-sm text-white/60 mt-1">This may take a few minutes...</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="space-y-1">
        <h1 class="text-white text-xl font-semibold">{{ title }}</h1>
        <div class="text-xs font-medium capitalize tracking-wide text-white/50">
          {{ asset.kind }}
        </div>
      </div>
    </div>
  </div>
</template>
