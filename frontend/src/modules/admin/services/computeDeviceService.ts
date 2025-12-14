import { supabase } from '@/lib/supabaseClient';
import type { ComputeDevice } from '@/modules/admin/types';

type ComputeDeviceRow = {
  id?: string;
  name: string;
  status: string | null;
  last_heartbeat_at: string | Date | null;
  cpu_utilization: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  gpu_utilization: number | null;
  temperature_c: number | null;
  last_error: string | null;
};

const toDateOrNull = (value: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toComputeDevice = (row: ComputeDeviceRow): ComputeDevice => ({
  id: row.id,
  name: row.name,
  status: row.status,
  lastHeartbeatAt: toDateOrNull(row.last_heartbeat_at),
  cpuUtilization: row.cpu_utilization,
  memoryUsedMb: row.memory_used_mb,
  memoryTotalMb: row.memory_total_mb,
  gpuUtilization: row.gpu_utilization,
  temperatureC: row.temperature_c,
  lastError: row.last_error,
});

export const computeDeviceService = {
  async list(): Promise<ComputeDevice[]> {
    const { data, error } = await supabase
      .from('compute_devices')
      .select(
        `
          name,
          status,
          last_heartbeat_at,
          cpu_utilization,
          memory_used_mb,
          memory_total_mb,
          gpu_utilization,
          temperature_c,
          last_error
        `
      )
      .order('last_heartbeat_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(toComputeDevice);
  },
};
