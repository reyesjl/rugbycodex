export type ComputeDevice = {
  id?: string;
  name: string;
  status: string | null;
  lastHeartbeatAt: Date | null;
  cpuUtilization: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  gpuUtilization: number | null;
  temperatureC: number | null;
  lastError: string | null;
};
