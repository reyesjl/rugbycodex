<script setup lang="ts">
</script>
<template>
    <!-- Organizations -->
    <div class="organizations-wrapper space-y-10">
      <div class="header">
        <hr class="text-white/30 mb-1"></hr>
        <div class="text-xl font-semibold mb-3">Organizations</div>
        
        <!-- Metrics cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
              <div class="text-xs font-semibold">All Organizations</div>
              <div class="text-3xl">27</div>
            </div>
          </div>

          <div>
            <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
              <div class="text-xs font-semibold">Pending Approval</div>
              <div class="text-3xl">5</div>
            </div>
          </div>

          <div>
            <div class="flex flex-col gap-2 p-2 border-1 border-white/30 rounded">
              <div class="text-xs font-semibold">Near Storage Limit</div>
              <div class="text-3xl">5</div>
            </div>
          </div>
        </div> <!-- End of metrics cards -->
      </div> <!-- End of organizations header -->

      <!-- Display recent activity -->
      <div class="space-y-2">
        <div class="text-lg">Recent activity</div>
        <div class="flex flex-col gap-4 text-sm">
          <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
            <div>Uploaded <span class="text-blue-500">"media name file name"</span></div>
            <div class="flex">
              <div>[org link]</div>
              <Icon icon="carbon:link" width="16" height="16" />
            </div>
            <div class="text-gray-300">
              12/15/2025 1:35 AM
            </div>
          </div>

          <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
            <div>Uploaded <span class="text-blue-500">"media name file name"</span></div>
            <div class="flex">
              <div>[org link]</div>
              <Icon icon="carbon:link" width="16" height="16" />
            </div>
            <div class="text-gray-300">
              12/15/2025 1:35 AM
            </div>
          </div>

          <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
            <div>Uploaded <span class="text-blue-500">"media name file name"</span></div>
            <div class="text-xs flex">
              <div>[org link]</div>
              <Icon icon="carbon:link" width="16" height="16" />
            </div>
            <div class="text-xs text-gray-300">
              12/15/2025 1:35 AM
            </div>
          </div>

          <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
            <div>New workspace requested <span class="text-blue-500">"New organization name"</span></div>
            <div class="flex">
              <div>[org link]</div>
              <Icon icon="carbon:link" width="16" height="16" />
            </div>
            <div class="text-gray-300">
              12/15/2025 1:35 AM
            </div>
          </div>

          <div class="activity-item text-xs border-l-4 pl-2 border-white/30">
            <div>New workspace requested <span class="text-blue-500">"New organization name"</span></div>
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
    </div> <!-- End of organizations section -->   
</template>
<style scoped>
</style>