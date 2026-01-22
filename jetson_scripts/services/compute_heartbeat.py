import os
import time
import socket
from datetime import datetime, timezone
import psutil
from dotenv import load_dotenv
from supabase import create_client, Client
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from utils.observability import log_event

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DEVICE_NAME: str = os.getenv("RC_DEVICE_NAME")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Orin Nano GPU DVFS path
GPU_DEVFREQ_PATH = "/sys/class/devfreq/17000000.gpu"

# Orin Nano GPU thermal zone (confirmed)
GPU_THERMAL_ZONE = "/sys/class/thermal/thermal_zone1/temp"


def get_gpu_utilization():
    """
    GPU load inferred from DVFS state.
    This represents relative GPU demand, not instruction-level busy time.
    """
    try:
        with open(f"{GPU_DEVFREQ_PATH}/cur_freq") as c, \
             open(f"{GPU_DEVFREQ_PATH}/max_freq") as m:
            cur = int(c.read().strip())
            maxf = int(m.read().strip())

        if maxf > 0:
            return round((cur / maxf) * 100, 1)

    except Exception:
        pass

    return None


def get_gpu_temperature():
    """
    GPU temperature in Celsius from gpu-thermal zone.
    """
    try:
        with open(GPU_THERMAL_ZONE) as t:
            return round(int(t.read().strip()) / 1000.0, 1)
    except Exception:
        return None


while True:
    gpu_util = get_gpu_utilization()
    gpu_temp = get_gpu_temperature()
    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "name": DEVICE_NAME,
        "hostname": socket.gethostname(),
        "status": "online",
        "last_heartbeat_at": now,
        "cpu_cores": psutil.cpu_count(),
        "memory_total_mb": int(psutil.virtual_memory().total / 1024 / 1024),
        "cpu_utilization": psutil.cpu_percent(interval=1),
        "memory_used_mb": int(psutil.virtual_memory().used / 1024 / 1024),
        "gpu_utilization": gpu_util,      # DVFS-based load
        "temperature_c": gpu_temp,        # GPU silicon temp
        "updated_at": now,
    }

    try:
        response = (
            supabase
                .table("compute_devices")
                .upsert(payload, on_conflict="name")
                .execute()
        )
        if response.error:
            log_event(
                severity="error",
                event_type="heartbeat_failure",
                error_code="SUPABASE_WRITE_FAILED",
                error_message=str(response.error),
                device_name=DEVICE_NAME,
            )
        else:
            log_event(
                severity="info",
                event_type="heartbeat_success",
                device_name=DEVICE_NAME,
                gpu_utilization=gpu_util,
                temperature_c=gpu_temp,
            )
    except Exception as e:
        log_event(
            severity="error",
            event_type="heartbeat_failure",
            error_code="SUPABASE_WRITE_FAILED",
            error_message=str(e),
            device_name=DEVICE_NAME,
        )

    time.sleep(15)
