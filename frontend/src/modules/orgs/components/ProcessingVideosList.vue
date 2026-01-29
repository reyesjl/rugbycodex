<script setup lang="ts">
import ProcessingVideoItem from './ProcessingVideoItem.vue';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { UploadState } from '@/modules/media/types/UploadStatus';

defineProps<{
  processingAssets: OrgMediaAsset[];
  uploadMetricsByAssetId: Map<string, {
    state: UploadState;
    progress: number;
    uploadSpeedBps?: number;
  }>;
  canManage?: boolean;
}>();

const emit = defineEmits(['delete']);

function handleDelete(assetId: string) {
  emit('delete', assetId);
}
</script>

<template>
  <div v-if="processingAssets.length > 0" class="space-y-1">
    <ProcessingVideoItem
      v-for="asset in processingAssets"
      :key="asset.id"
      :asset="asset"
      :upload-metrics="uploadMetricsByAssetId.get(asset.id)"
      :can-manage="canManage"
      @delete="handleDelete(asset.id)"
    />
  </div>
</template>
