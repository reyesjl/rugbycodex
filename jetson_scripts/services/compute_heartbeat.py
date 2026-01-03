import os
import time
import socket
import requests
import psutil

EDGE_URL = os.getenv("RC_EDGE_URL")
EDGE_SECRET = os.getenv("ORIN_NANO_SECRET")
DEVICE_NAME = os.getenv("RC_DEVICE_NAME")

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

    payload = {
        "name": DEVICE_NAME,
        "hostname": socket.gethostname(),
        "cpu_cores": psutil.cpu_count(),
        "memory_total_mb": int(psutil.virtual_memory().total / 1024 / 1024),
        "cpu_utilization": psutil.cpu_percent(interval=1),
        "memory_used_mb": int(psutil.virtual_memory().used / 1024 / 1024),
        "gpu_utilization": gpu_util,      # DVFS-based load
        "temperature_c": gpu_temp,        # GPU silicon temp
    }

    try:
        r = requests.post(
            EDGE_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {EDGE_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=5,
        )
        print(
            "Heartbeat:",
            r.status_code,
            "GPU load:",
            gpu_util,
            "GPU temp:",
            gpu_temp,
        )
    except Exception as e:
        print("Heartbeat failed:", e)

    time.sleep(15)