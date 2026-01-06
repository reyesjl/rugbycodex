from typing import Dict, List
from uuid import UUID
from dotenv import load_dotenv
import os
import time
import psutil

from supabase import create_client, Client

from models import JobState, TranscodingJob
from stream_worker import StreamWorker

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

    print(f"System load: CPU {cpu}%, Free Memory: {free_mb} MB")

    return (cpu < cpu_threshold) and (free_mb > min_free_mem_mb)


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

workers: Dict[UUID, StreamWorker] = {}

def cleanup_finished_workers():
    finished_jobs = [job_id for job_id, worker in workers.items() if not worker.is_alive()]
    for job_id in finished_jobs:
        print(f"Cleaning up finished worker for job: {job_id}")
        del workers[job_id]


while True:

    if VERBOSE_LOGGING:
        print(f"Checking for new jobs... Active workers: {len(workers)}")

    response = (
    supabase
        .table("jobs")
        .select("""
            id,
            state,
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

    for job in active_jobs:
        if VERBOSE_LOGGING:
            print(job)
            print("Full media asset path:", job.media_asset.full_input_path())
            print("Output media asset path:", job.media_asset.full_output_path())

        if job.job_id not in workers and can_add_worker():
            print(f"Starting new job: {job.job_id}, state: {job.job_state}")
            workers[job.job_id] = StreamWorker(job, supabase)
            workers[job.job_id].start()
            print("Job Running")


    time.sleep(5)