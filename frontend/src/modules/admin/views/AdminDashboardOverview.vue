<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import RefreshButton from '@/components/RefreshButton.vue';
import AdminMetricCard from '@/modules/admin/components/AdminMetricCard.vue';
import AdminNarrationTrendChart from '@/modules/admin/components/AdminNarrationTrendChart.vue';
import AdminUploadVolumeChart from '@/modules/admin/components/AdminUploadVolumeChart.vue';
import AdminAttentionPanel from '@/modules/admin/components/AdminAttentionPanel.vue';
import AdminActivityFeed from '@/modules/admin/components/AdminActivityFeed.vue';
import { getAdminDashboardOverview } from '@/modules/admin/services/stats_service';
import type { AdminDashboardOverview } from '@/modules/admin/types';

const dashboardData = ref<AdminDashboardOverview | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const pipelineFailuresStatus = computed(() => {
  if (!dashboardData.value) return 'normal';
  const failures = dashboardData.value.metrics.pipelineFailures;
  if (failures >= 10) return 'danger';
  if (failures > 0) return 'warning';
  return 'normal';
});

const loadDashboard = async () => {
  loading.value = true;
  error.value = null;

  try {
    dashboardData.value = await getAdminDashboardOverview();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load dashboard data';
    console.error('Dashboard error:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <section class="container-lg text-white py-6 space-y-8">
    <!-- Header -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-3xl text-white">
          Platform Overview
        </h2>
      </div>
      <RefreshButton
        class="self-start"
        :refresh="loadDashboard"
        :loading="loading"
        title="Refresh dashboard data"
      />
    </div>

    <!-- Error State -->
    <div
      v-if="error"
      class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
    >
      {{ error }}
    </div>

    <!-- Metric Cards Row -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AdminMetricCard
        label="Active Orgs"
        description="Last 30 days"
        :value="dashboardData?.metrics.activeOrgs ?? 0"
        icon="carbon:enterprise"
        :loading="loading"
      />
      <AdminMetricCard
        label="Active Users"
        description="Last 30 days"
        :value="dashboardData?.metrics.activeUsers30d ?? 0"
        icon="carbon:user-multiple"
        :loading="loading"
      />
      <AdminMetricCard
        label="Narrations"
        description="Generated (30d)"
        :value="dashboardData?.metrics.narrations30d ?? 0"
        icon="carbon:microphone"
        :loading="loading"
      />
      <AdminMetricCard
        label="Pipeline Failures"
        description="Last 72 hours"
        :value="dashboardData?.metrics.pipelineFailures ?? 0"
        icon="carbon:warning-alt"
        :loading="loading"
        :status="pipelineFailuresStatus"
      />
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AdminNarrationTrendChart
        :data="dashboardData?.charts.narrationsOverTime ?? []"
        :loading="loading"
      />
      <AdminUploadVolumeChart
        :data="dashboardData?.charts.mediaUploadVolume ?? []"
        :loading="loading"
      />
    </div>

    <!-- Attention Items & Activity Feed -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AdminAttentionPanel
        :attention-items="dashboardData?.attentionItems ?? { failedJobs: [], processingFailures: [] }"
        :loading="loading"
      />
      <AdminActivityFeed
        :activities="dashboardData?.recentActivity ?? []"
        :loading="loading"
      />
    </div>

    <!-- Footer Info -->
    <div v-if="dashboardData && !loading" class="text-center text-xs text-white/40">
      Last updated: {{ new Date(dashboardData.generatedAt).toLocaleString() }}
    </div>
  </section>
</template>
