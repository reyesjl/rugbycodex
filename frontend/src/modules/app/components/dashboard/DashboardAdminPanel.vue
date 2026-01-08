<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { storeToRefs } from 'pinia';
import { mediaService } from '@/modules/media/services/mediaService';
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import OrganizationsSection from './admin/OrganizationsSection.vue';
import OperationsSection from './admin/OperationsSection.vue';
import PeopleSection from './admin/PeopleSection.vue';

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const mediaAssetId = ref('');
const segmentLoading = ref(false);
const segmentMessage = ref<string | null>(null);
const segmentError = ref<string | null>(null);

const handleGenerateSegments = async () => {
  segmentLoading.value = true;
  segmentMessage.value = null;
  segmentError.value = null;

  try {
    const assetId = mediaAssetId.value.trim() || undefined;
    const result = await mediaService.generateMediaSegments(assetId);
    
    if (result.status === 'completed') {
      const parts = [`Processed ${result.assets_processed} assets`];
      if (result.total_segments_created) {
        parts.push(`created ${result.total_segments_created} segments`);
      }
      if (result.assets_skipped) {
        parts.push(`skipped ${result.assets_skipped} (already segmented)`);
      }
      segmentMessage.value = parts.join(', ');
      
      if (result.errors && result.errors.length > 0) {
        segmentError.value = `${result.errors.length} assets failed to process`;
      }
      
      mediaAssetId.value = '';
    } else if (result.status === 'created') {
      segmentMessage.value = `Successfully created ${result.count} segments`;
      mediaAssetId.value = '';
    } else if (result.status === 'skipped') {
      if (result.reason === 'no_eligible_assets') {
        segmentMessage.value = 'No eligible assets found';
      } else if (result.reason === 'already_segmented') {
        segmentMessage.value = 'Already segmented';
      } else {
        segmentMessage.value = 'Skipped';
      }
    }
  } catch (error) {
    segmentError.value = error instanceof Error ? error.message : 'Failed to generate segments';
  } finally {
    segmentLoading.value = false;
  }
};
</script>

<template>
  <section class="space-y-20 text-white">
    <div class="header space-y-5">
      <div class="text-2xl">Platform status</div>
      <CoachGuide>
        <div class="space-y-1">
          <p class="text-lg font-semibold text-white/90">All system operational.</p>
          <p class="text-sm text-white/70">TMO looks good from all angles.</p>
        </div>
      </CoachGuide>
    </div>


    <OrganizationsSection />

    <OperationsSection />
    
    <PeopleSection />

    <section v-if="isAdmin" class="space-y-5">
      <div class="text-2xl">Media Maintenance</div>
      <div class="space-y-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-start">
          <input
            v-model="mediaAssetId"
            type="text"
            placeholder="Media Asset ID (leave empty for all)"
            class="flex-1 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
            :disabled="segmentLoading"
          />
          <button
            @click="handleGenerateSegments"
            :disabled="segmentLoading"
            class="rounded-md bg-white/10 px-6 py-2 font-medium text-white transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {{ segmentLoading ? 'Generating...' : 'Generate Segments' }}
          </button>
        </div>
        
        <div v-if="segmentMessage" class="rounded-md bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          {{ segmentMessage }}
        </div>
        
        <div v-if="segmentError" class="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {{ segmentError }}
        </div>
      </div>
    </section>
      
  </section>
</template>
