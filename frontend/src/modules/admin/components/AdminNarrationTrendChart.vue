<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import type { TimeSeriesPoint } from '@/modules/admin/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props {
  data: TimeSeriesPoint[];
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
      label: 'Narrations',
      data: props.data.map(point => point.count),
      borderColor: '#60a5fa',
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      titleColor: 'rgba(255, 255, 255, 0.6)',
      bodyColor: 'white',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
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
  },
}));
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/5 p-4">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-white">Narrations Over Time</h3>
      <p class="text-xs text-white/60">Last 30 days</p>
    </div>

    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="text-white/40">Loading chart...</div>
    </div>

    <div v-else-if="data.length === 0" class="h-64 flex items-center justify-center">
      <div class="text-white/40">No data available</div>
    </div>

    <div v-else class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
