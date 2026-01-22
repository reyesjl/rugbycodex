from typing import Dict, List
from uuid import UUID
from dotenv import load_dotenv
import os
import time
import psutil
import sys
from pathlib import Path

from supabase import create_client, Client

from models import JobState, TranscodingJob
from stream_worker import StreamWorker
sys.path.append(str(Path(__file__).resolve().parents[1]))
from utils.observability import log_event

load_dotenv()  # loads .env into environment variables

SUPABASE_URL: str = os.getenv("SUPABASE_URL")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
VERBOSE_LOGGING: bool = os.getenv("VERBOSE_LOGGING", "false").lower() == "true"

def can_add_worker(
    cpu_threshold: float = 75.0,
    min_free_mem_mb: int = 500
) -> bool:
    # CPU
    psutil.cpu_percent(interval=0.2)  # warm-up
    cpu = psutil.cpu_percent(interval=1.0)

    # Memory
    vm = psutil.virtual_memory()
    free_mb = vm.available / (1024 * 1024)

    log_event(
        severity="info",
        event_type="system_load",
        cpu_percent=cpu,
        free_memory_mb=free_mb,
    )

    return (cpu < cpu_threshold) and (free_mb > min_free_mem_mb)


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

workers: Dict[UUID, StreamWorker] = {}

def cleanup_finished_workers():
    finished_jobs = [job_id for job_id, worker in workers.items() if not worker.is_alive()]
    for job_id in finished_jobs:
        log_event(
            severity="info",
            event_type="worker_cleanup",
            job_id=str(job_id),
        )
        del workers[job_id]


while True:

    if VERBOSE_LOGGING:
        log_event(
            severity="info",
            event_type="job_poll",
            active_workers=len(workers),
        )

    response = (
    supabase
        .table("jobs")
        .select("""
            id,
            state,
            request_id,
            trace_id,
            media_asset:media_asset_id (
                id,
                org_id,
                bucket,
                storage_path,
                file_name,
                duration_seconds,
                status,
                streaming_ready,
                thumbnail_path
            )
        """)
        .eq("type", "transcode")
        .eq("state", JobState.QUEUED.value)
        .execute()
    )


    cleanup_finished_workers()

    active_jobs: List[TranscodingJob] = [TranscodingJob.from_row(row) for row in response.data]

    log_event(
        severity="info",
        event_type="metric",
        metric_name="job_queue_depth",
        metric_value=len(active_jobs),
        tags={"queue_name": "transcode"},
    )

    for job in active_jobs:
        if VERBOSE_LOGGING:
            log_event(
                severity="info",
                event_type="job_candidate",
                job_id=str(job.job_id),
                org_id=str(job.media_asset.org_id),
                media_id=str(job.media_asset.id),
                request_id=job.request_id,
                trace_id=job.trace_id,
                input_path=job.media_asset.full_input_path(),
                output_path=job.media_asset.full_output_path(),
            )

        if job.job_id not in workers and can_add_worker():
            log_event(
                severity="info",
                event_type="job_dequeue",
                job_id=str(job.job_id),
                org_id=str(job.media_asset.org_id),
                media_id=str(job.media_asset.id),
                request_id=job.request_id,
                trace_id=job.trace_id,
                state=job.job_state.value,
            )
            log_event(
                severity="info",
                event_type="metric",
                metric_name="job_dequeue_total",
                metric_value=1,
                tags={"queue_name": "transcode"},
            )
            workers[job.job_id] = StreamWorker(job, supabase)
            workers[job.job_id].start()
            log_event(
                severity="info",
                event_type="job_started",
                job_id=str(job.job_id),
                request_id=job.request_id,
                trace_id=job.trace_id,
            )


    time.sleep(5)