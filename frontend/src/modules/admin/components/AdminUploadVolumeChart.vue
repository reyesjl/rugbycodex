<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import type { MediaUploadPoint } from '@/modules/admin/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
  data: MediaUploadPoint[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const chartData = computed(() => ({
  labels: props.data.map(point => {
    const date = new Date(point.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }),
  datasets: [
    {
      label: 'Uploads',
      data: props.data.map(point => point.count),
      backgroundColor: '#60a5fa',
      borderRadius: 4,
      yAxisID: 'y',
    },
    {
      label: 'Size (GB)',
      data: props.data.map(point => point.sizeGb),
      backgroundColor: '#34d399',
      borderRadius: 4,
      yAxisID: 'y1',
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: 'rgba(255, 255, 255, 0.6)',
        font: {
          size: 11,
        },
        usePointStyle: true,
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      titleColor: 'rgba(255, 255, 255, 0.6)',
      bodyColor: 'white',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      padding: 12,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
        drawBorder: false,
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.4)',
        font: {
          size: 11,
        },
      },
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
        drawBorder: false,
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.4)',
        font: {
          size: 11,
        },
      },
      beginAtZero: true,
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      grid: {
        drawOnChartArea: false,
        drawBorder: false,
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.4)',
        font: {
          size: 11,
        },
      },
      beginAtZero: true,
    },
  },
}));
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/5 p-4">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-white">Media Upload Volume</h3>
      <p class="text-xs text-white/60">Last 30 days</p>
    </div>

    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="text-white/40">Loading chart...</div>
    </div>

    <div v-else-if="data.length === 0" class="h-64 flex items-center justify-center">
      <div class="text-white/40">No data available</div>
    </div>

    <div v-else class="h-64">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
