<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { computeDeviceService } from '@/modules/admin/services/computeDeviceService';
import type { ComputeDevice } from '@/modules/admin/types';

const HEARTBEAT_OFFLINE_THRESHOLD_MS = 30_000;
type DeviceHealth = 'online' | 'offline' | 'degraded';

const computeDevices = ref<ComputeDevice[]>([]);
const computeDevicesError = ref<string | null>(null);
const computeDevicesLoading = ref(false);
const heartbeatNow = ref(Date.now());
const expandedDeviceId = ref<string | null>(null);

let heartbeatTicker: ReturnType<typeof setInterval> | null = null;
let deviceRefreshTimer: ReturnType<typeof setInterval> | null = null;

const computeMemoryPercent = (usedMb: number | null, totalMb: number | null): number | null => {
  if (!Number.isFinite(usedMb ?? NaN) || !Number.isFinite(totalMb ?? NaN) || (totalMb ?? 0) <= 0) {
    return null;
  }
  const percent = Math.round(((usedMb ?? 0) / (totalMb ?? 1)) * 100);
  return Math.min(100, Math.max(0, percent));
};

const formatPercent = (value: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const percent = Math.min(100, Math.max(0, Math.round(value ?? 0)));
  return `${percent}%`;
};

const formatTemperature = (value: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  return `${Math.round(value ?? 0)}°C`;
};

const formatMemoryUsage = (usedMb: number | null, totalMb: number | null): string => {
  const percent = computeMemoryPercent(usedMb, totalMb);
  if (percent === null) return '—';
  const formatter = new Intl.NumberFormat();
  return `${formatter.format(Math.round(usedMb ?? 0))} / ${formatter.format(Math.round(totalMb ?? 0))} MB (${percent}%)`;
};

const formatReportedStatus = (status: string | null) => {
  if (!status) return 'unknown';
  const normalized = status.replace(/_/g, ' ').trim();
  if (!normalized) return 'unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatLastSeen = (timestamp: Date | null, nowMs: number) => {
  if (!timestamp) return 'Never';
  const diffSeconds = Math.max(0, Math.round((nowMs - timestamp.getTime()) / 1000));
  if (diffSeconds < 5) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    const remainderSeconds = diffSeconds % 60;
    if (minutes < 5 && remainderSeconds > 0) {
      return `${minutes}m ${remainderSeconds}s ago`;
    }
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainderMinutes = minutes % 60;
    if (hours < 6 && remainderMinutes > 0) {
      return `${hours}h ${remainderMinutes}m ago`;
    }
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const computeDeviceCards = computed(() => {
  const nowMs = heartbeatNow.value;
  return [...computeDevices.value]
    .sort((a, b) => (b.lastHeartbeatAt?.getTime() ?? 0) - (a.lastHeartbeatAt?.getTime() ?? 0))
    .map((device) => {
      const heartbeatMs = device.lastHeartbeatAt?.getTime();
      const stalenessMs = heartbeatMs != null ? nowMs - heartbeatMs : Number.POSITIVE_INFINITY;
      const isOnline = stalenessMs <= HEARTBEAT_OFFLINE_THRESHOLD_MS;
      const derivedState: DeviceHealth = isOnline
        ? device.status === 'degraded'
          ? 'degraded'
          : 'online'
        : 'offline';
      const memoryPercent = computeMemoryPercent(device.memoryUsedMb, device.memoryTotalMb);

      return {
        ...device,
        deviceKey: device.id ?? device.name,
        derivedState,
        stalenessMs,
        lastSeenLabel: formatLastSeen(device.lastHeartbeatAt, nowMs),
        memoryPercent,
      };
    });
});

const stateLabel = (state: DeviceHealth) => {
  switch (state) {
    case 'online':
      return 'Online';
    case 'degraded':
      return 'Degraded';
    default:
      return 'Offline';
  }
};

const statePillClasses = (state: DeviceHealth) => {
  if (state === 'online') return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100';
  if (state === 'degraded') return 'border-amber-300/60 bg-amber-500/15 text-amber-100';
  return 'border-rose-400/50 bg-rose-500/15 text-rose-100';
};

const deviceCardClasses = (state: DeviceHealth) => {
  if (state === 'online') return 'border-emerald-400/20 bg-emerald-500/5';
  if (state === 'degraded') return 'border-amber-400/25 bg-amber-500/10';
  return 'border-rose-400/20 bg-rose-500/5';
};

const loadComputeDevices = async () => {
  computeDevicesLoading.value = true;
  computeDevicesError.value = null;
  try {
    computeDevices.value = await computeDeviceService.list();
  } catch (err) {
    computeDevicesError.value =
      err instanceof Error ? err.message : 'Unable to load compute devices.';
  } finally {
    computeDevicesLoading.value = false;
  }
};

onMounted(() => {
  void loadComputeDevices();

  heartbeatTicker = setInterval(() => {
    heartbeatNow.value = Date.now();
  }, 5_000);

  deviceRefreshTimer = setInterval(() => {
    void loadComputeDevices();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (heartbeatTicker) {
    clearInterval(heartbeatTicker);
  }
  if (deviceRefreshTimer) {
    clearInterval(deviceRefreshTimer);
  }
});

const toggleDeviceMetrics = (deviceKey: string) => {
  expandedDeviceId.value = expandedDeviceId.value === deviceKey ? null : deviceKey;
};

const isDeviceExpanded = (deviceKey: string) => expandedDeviceId.value === deviceKey;
</script>

<template>
  <div class="rounded border border-white/15 bg-black/40 text-white">
    <header
      class="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-xs uppercase tracking-wide text-white/40">Compute fleet</p>
        <p class="text-lg font-semibold text-white">Platform-owned devices</p>
        <p class="text-xs text-white/60">Heartbeat-driven health across infrastructure nodes.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 self-start rounded border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="computeDevicesLoading"
        @click="loadComputeDevices"
      >
        <Icon icon="carbon:renew" width="16" height="16" />
        Refresh
      </button>
    </header>

    <div class="px-4 pb-4 pt-3">
      <div v-if="computeDevicesError" class="text-sm text-rose-200">
        {{ computeDevicesError }}
      </div>
      <div v-else-if="computeDevicesLoading && computeDeviceCards.length === 0" class="text-sm text-white/70">
        Loading compute devices…
      </div>
      <div v-else-if="!computeDevicesLoading && computeDeviceCards.length === 0" class="text-sm text-white/70">
        No compute devices have reported in yet.
      </div>
      <div v-else class="space-y-2">
        <article
          v-for="device in computeDeviceCards"
          :key="device.deviceKey"
          class="overflow-hidden rounded border text-white shadow-sm transition hover:border-white/30"
          :class="deviceCardClasses(device.derivedState)"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-white/30"
            :aria-expanded="isDeviceExpanded(device.deviceKey)"
            @click="toggleDeviceMetrics(device.deviceKey)"
          >
            <div class="flex flex-col gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-white">{{ device.name }}</p>
                <span
                  class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                  :class="statePillClasses(device.derivedState)"
                >
                  {{ stateLabel(device.derivedState) }}
                </span>
              </div>
              <p class="text-xs text-white/60">Last seen {{ device.lastSeenLabel }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70"
              >
                Reported: {{ formatReportedStatus(device.status) }}
              </span>
              <Icon
                icon="carbon:chevron-down"
                width="18"
                height="18"
                class="text-white/60 transition"
                :class="isDeviceExpanded(device.deviceKey) ? '-rotate-180' : 'rotate-0'"
              />
            </div>
          </button>

          <transition name="fade-collapse">
            <div
              v-if="isDeviceExpanded(device.deviceKey)"
              class="border-t border-white/10 bg-black/30 px-3 pb-3 pt-2"
            >
              <div class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                <div class="rounded border border-white/8 bg-white/5 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-white/50">CPU</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {{ formatPercent(device.cpuUtilization) }}
                  </p>
                </div>
                <div class="rounded border border-white/8 bg-white/5 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-white/50">Memory</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {{ formatMemoryUsage(device.memoryUsedMb, device.memoryTotalMb) }}
                  </p>
                </div>
                <div class="rounded border border-white/8 bg-white/5 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-white/50">GPU</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {{ formatPercent(device.gpuUtilization) }}
                  </p>
                </div>
                <div class="rounded border border-white/8 bg-white/5 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-white/50">Temperature</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {{ formatTemperature(device.temperatureC) }}
                  </p>
                </div>
                <div class="rounded border border-white/8 bg-white/5 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-wide text-white/50">Last heartbeat</p>
                  <p class="mt-1 text-base font-semibold text-white">{{ device.lastSeenLabel }}</p>
                </div>
              </div>

              <div
                v-if="device.lastError"
                class="mt-3 flex items-start gap-2 rounded border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-100"
              >
                <Icon icon="carbon:warning-alt-filled" width="18" height="18" />
                <span class="leading-snug">{{ device.lastError }}</span>
              </div>
            </div>
          </transition>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-collapse-enter-active,
.fade-collapse-leave-active {
  transition: opacity 0.16s ease, max-height 0.2s ease;
}

.fade-collapse-enter-from,
.fade-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.fade-collapse-enter-to,
.fade-collapse-leave-from {
  opacity: 1;
  max-height: 700px;
}
</style>
