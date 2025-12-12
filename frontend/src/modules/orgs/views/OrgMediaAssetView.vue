<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { supabase } from '@/lib/supabaseClient';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { orgService } from '@/modules/orgs/services/orgService';
import type { OrgMediaAsset } from '@/modules/orgs/types';

const props = defineProps<{ slug?: string | string[]; assetId?: string | string[] }>();

const normalizedSlug = computed(() => {
  if (!props.slug) return null;
  return Array.isArray(props.slug) ? props.slug[0] : props.slug;
});

const normalizedAssetId = computed(() => {
  if (!props.assetId) return null;
  return Array.isArray(props.assetId) ? props.assetId[0] : props.assetId;
});

const activeOrgStore = useActiveOrgStore();
const { activeOrg } = storeToRefs(activeOrgStore);

const asset = ref<OrgMediaAsset | null>(null);
const signedUrl = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const orgMediaLink = computed(() => {
  const slug = normalizedSlug.value;
  return slug ? `/v2/orgs/${slug}/media` : '/v2/orgs';
});

const canRenderPlayer = computed(() => {
  if (!asset.value) return false;
  return asset.value.mime_type.startsWith('video/') || asset.value.mime_type === 'application/mp4' || asset.value.mime_type === 'video/mp4';
});

const signUrl = async (nextAsset: OrgMediaAsset) => {
  const { data, error: signedError } = await supabase.storage
    .from(nextAsset.bucket)
    .createSignedUrl(nextAsset.storage_path, 60 * 60);

  if (signedError) throw signedError;
  if (!data?.signedUrl) throw new Error('Unable to create a signed URL.');
  signedUrl.value = data.signedUrl;
};

const load = async () => {
  const slug = normalizedSlug.value;
  const id = normalizedAssetId.value;
  if (!slug || !id) return;

  loading.value = true;
  error.value = null;
  asset.value = null;
  signedUrl.value = null;

  try {
    await activeOrgStore.ensureLoaded(slug);
    if (!activeOrg.value?.id) {
      throw new Error('No organization selected.');
    }

    const nextAsset = await orgService.mediaAssets.getById(activeOrg.value.id, id);
    asset.value = nextAsset;
    await signUrl(nextAsset);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load media.';
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async () => {
  await load();
};

watch(
  [normalizedSlug, normalizedAssetId],
  async () => {
    await load();
  },
  { immediate: true }
);
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <RouterLink
          :to="orgMediaLink"
          class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
        >
          <Icon icon="carbon:arrow-left" class="h-4 w-4" />
          Back to media
        </RouterLink>
        <h1 class="text-3xl font-semibold">Media Viewer</h1>
        <p class="text-white/70">Stream and review the selected upload.</p>
      </div>

      <RefreshButton size="sm" :refresh="handleRefresh" :loading="loading" title="Refresh media" />
    </header>

    <div v-if="loading" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading media…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="text-sm text-white/80">Check access, then try refreshing.</p>
    </div>

    <div v-else-if="asset" class="space-y-4">
      <div class="rounded border border-white/10 bg-white/5 p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-white/50">File</p>
            <p class="text-lg font-semibold">{{ asset.file_name }}</p>
            <p class="mt-1 font-mono text-xs text-white/60">{{ asset.bucket }}/{{ asset.storage_path }}</p>
          </div>
          <a
            v-if="signedUrl"
            :href="signedUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
          >
            <Icon icon="carbon:launch" class="h-4 w-4" />
            Open in new tab
          </a>
        </div>
      </div>

      <div class="overflow-hidden rounded border border-white/10 bg-black/30">
        <div v-if="signedUrl && canRenderPlayer" class="aspect-video bg-black">
          <video
            :src="signedUrl"
            class="h-full w-full"
            controls
            playsinline
          />
        </div>
        <div v-else class="p-4 text-white/70">
          This file type can’t be previewed in the browser right now.
        </div>
      </div>
    </div>
  </section>
</template>
