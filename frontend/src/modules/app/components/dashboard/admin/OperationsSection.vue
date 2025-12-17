<script setup lang="ts">
import ComputeDevicesWidget from '@/modules/app/components/ComputeDevicesWidget.vue';
</script>
<template>
  <!-- Operations -->
  <div class="operations-wrapper space-y-10">
    <div class="header">
      <hr class="text-white/30 mb-1"></hr>
      <div class="text-xl font-semibold mb-3">Operations</div>
      
      <!-- Metrics cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
            <div class="text-xs font-semibold">Active Jobs</div>
            <div class="text-3xl">14</div>
          </div>
        </div>

        <div>
          <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
            <div class="text-xs font-semibold">Failed Jobs</div>
            <div class="text-3xl">3</div>
          </div>
        </div>

        <div>
          <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
            <div class="text-xs font-semibold">Total Storage Used</div>
            <div class="text-3xl">256GB <span class="text-xs text-white/30">/ 1TB</span></div>
          </div>
        </div>
      </div>  <!-- End of metrics cards-->
    </div> <!-- End of operations header -->

    <!-- Rugbycodex Devices -->
    <div>
      <ComputeDevicesWidget class="mb-5"/>
    </div>

    <div class="space-y-2">
      <div class="text-lg">Recent activity</div>
      <div class="flex flex-col gap-4 text-sm">
        <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
          <div>HLS processing for <span class="text-blue-500">"media name file name"</span></div>
          <div class="flex">
            <div>[org link]</div>
            <Icon icon="carbon:link" width="16" height="16" />
          </div>
          <div class="text-gray-300">
            12/15/2025 1:35 AM
          </div>
        </div>

        <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
          <div>Transcription for <span class="text-blue-500">"media name file name"</span></div>
          <div class="flex">
            <div>[org link]</div>
            <Icon icon="carbon:link" width="16" height="16" />
          </div>
          <div class="text-gray-300">
            12/15/2025 1:35 AM
          </div>
        </div>

        <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
          <div>Transcription for <span class="text-blue-500">"media name file name"</span></div>
          <div class="flex">
            <div>[org link]</div>
            <Icon icon="carbon:link" width="16" height="16" />
          </div>
          <div class="text-gray-300">
            12/15/2025 1:35 AM
          </div>
        </div>
      </div> <!-- end of activity container -->
    </div> <!-- end of recent activity wrapper -->
  </div> <!-- End of operations section -->   
</template>
<style scoped>
</style>