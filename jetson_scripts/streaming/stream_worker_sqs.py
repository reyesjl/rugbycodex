"""
Jetson Transcoding Worker - SQS Polling Version
Polls SQS queue for transcode jobs (competes with AWS ECS workers)
Updates processing_stage through all stages for proper frontend polling
"""

from enum import Enum
from pathlib import Path
import sys
import subprocess
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from supabase import create_client, Client
import time
import json
from datetime import datetime
from typing import Any, Optional

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent.parent / "utils"))
from visibility_heartbeat import VisibilityHeartbeat, estimate_processing_time
from observability import log_event

load_dotenv()

# AWS/Wasabi Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
SQS_QUEUE_URL = os.getenv("SQS_TRANSCODE_QUEUE_URL")
POLL_WAIT_TIME = 20  # SQS long polling
VISIBILITY_TIMEOUT = 600  # 10 minutes
MAX_RETRIES = 3

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# S3/Wasabi client
s3 = boto3.client(
    "s3",
    region_name=os.getenv("WASABI_REGION"),
    endpoint_url=os.getenv("WASABI_ENDPOINT"),
    aws_access_key_id=os.getenv("WASABI_KEY"),
    aws_secret_access_key=os.getenv("WASABI_SECRET"),
)

# SQS client
sqs = boto3.client("sqs", region_name=AWS_REGION)

# Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Work directory
WORK_DIR = Path("/tmp/transcode")
WORK_DIR.mkdir(parents=True, exist_ok=True)


def update_media_asset_processing_stage(
    media_id: str,
    org_id: str,
    processing_stage: str,
    status: str = None
) -> bool:
    """
    Update media_assets.processing_stage (and optionally status).
    Returns True if update succeeded, False otherwise.
    """
    try:
        update_data = {"processing_stage": processing_stage}
        if status:
            update_data["status"] = status
        
        response = (
            supabase
            .table("media_assets")
            .update(update_data)
            .eq("id", media_id)
            .eq("org_id", org_id)
            .execute()
        )
        
        updated_count = len(response.data) if response.data else 0
        
        log_event(
            severity="info",
            event_type="media_asset_processing_stage_updated",
            media_id=media_id,
            stage=processing_stage,
            updated_count=updated_count,
        )
        
        if updated_count == 0:
            log_event(
                severity="warn",
                event_type="media_asset_update_no_rows",
                media_id=media_id,
                org_id=org_id,
                processing_stage=processing_stage,
            )
            return False
        
        return True
        
    except Exception as e:
        log_event(
            severity="error",
            event_type="processing_stage_update_failed",
            media_id=media_id,
            processing_stage=processing_stage,
            error_message=str(e),
        )
        return False


def update_job_state(job_id: str, state: str):
    """Update job state"""
    try:
        supabase.table("jobs").update({"state": state}).eq("id", job_id).execute()
    except Exception as e:
        log_event(
            severity="error",
            event_type="job_update_failed",
            job_id=job_id,
            state=state,
            error_message=str(e),
        )


def update_job_fields(job_id: str, fields: dict):
    """Update multiple job fields"""
    try:
        supabase.table("jobs").update(fields).eq("id", job_id).execute()
    except Exception as e:
        log_event(
            severity="error",
            event_type="job_update_failed",
            job_id=job_id,
            fields=fields,
            error_message=str(e),
        )


def update_media_asset_derivatives(media_id: str, streaming_ready: bool, thumbnail_path: str = None):
    """Update streaming_ready and thumbnail_path"""
    try:
        update_data = {"streaming_ready": streaming_ready}
        if thumbnail_path:
            update_data["thumbnail_path"] = thumbnail_path
        
        supabase.table("media_assets").update(update_data).eq("id", media_id).execute()
        
        log_event(
            severity="info",
            event_type="media_derivatives_updated",
            media_id=media_id,
            streaming_ready=streaming_ready,
        )
    except Exception as e:
        log_event(
            severity="error",
            event_type="media_update_failed",
            media_id=media_id,
            error_message=str(e),
        )


def get_job_details(job_id: str) -> dict:
    """Fetch job details from Supabase"""
    try:
        response = (
            supabase
            .table("jobs")
            .select("""
                id,
                state,
                org_id,
                media_asset_id,
                media_assets:media_asset_id (
                    id,
                    org_id,
                    bucket,
                    storage_path,
                    file_name,
                    base_org_storage_path
                )
            """)
            .eq("id", job_id)
            .single()
            .execute()
        )
        return response.data
    except Exception as e:
        log_event(
            severity="error",
            event_type="job_fetch_failed",
            job_id=job_id,
            error_message=str(e),
        )
        return None


def download_from_wasabi(bucket: str, key: str, local_path: Path, job_id: str, media_id: str) -> bool:
    """Download file from Wasabi"""
    try:
        stage_start = time.perf_counter()
        
        log_event(
            severity="info",
            event_type="stage_start",
            stage="download",
            job_id=job_id,
            media_id=media_id,
            key=key,
        )
        
        s3.download_file(Bucket=bucket, Key=key, Filename=str(local_path))
        
        stage_duration = round((time.perf_counter() - stage_start) * 1000)
        log_event(
            severity="info",
            event_type="stage_complete",
            stage="download",
            job_id=job_id,
            media_id=media_id,
            duration_ms=stage_duration,
        )
        return True
        
    except Exception as e:
        log_event(
            severity="error",
            event_type="download_failed",
            job_id=job_id,
            media_id=media_id,
            error_code="WASABI_DOWNLOAD_FAILED",
            error_message=str(e),
        )
        return False


def transcode_video(input_path: Path, output_dir: Path, job_id: str, media_id: str) -> bool:
    """Transcode video to HLS using FFmpeg with Jetson hardware decode and software encode"""
    try:
        stage_start = time.perf_counter()
        output_manifest = output_dir / "index.m3u8"
        
        log_event(
            severity="info",
            event_type="stage_start",
            stage="transcode",
            job_id=job_id,
            media_id=media_id,
        )
        
        # FFmpeg with Jetson nvv4l2dec hardware decode and libx264 software encode
        # Optimized for Orin Nano hardware profile
        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-c:v", "h264_nvv4l2dec",
            "-i", str(input_path),
            
            # Video encoding with libx264
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-b:v", "2000k",
            "-maxrate", "2500k",
            "-bufsize", "4000k",
            
            # Keyframe settings for HLS alignment
            "-g", "180",
            "-keyint_min", "180",
            "-sc_threshold", "0",
            
            # Audio encoding
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "48000",
            
            # HLS settings with 6-second segments
            "-f", "hls",
            "-hls_time", "6",
            "-hls_list_size", "0",
            "-hls_segment_filename", f"{output_dir}/segment%03d.ts",
            str(output_manifest)
        ]
        
        log_event(
            severity="info",
            event_type="transcode_starting",
            job_id=job_id,
            media_id=media_id,
            decoder="h264_nvv4l2dec",
            encoder="libx264",
            encoder_preset="ultrafast",
            encoder_tune="zerolatency",
            hardware_decode=True,
            hardware_encode=False,
            hardware_profile="orin_nano",
        )
        
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        # Verify output
        if not output_manifest.exists():
            raise FileNotFoundError(f"Output manifest not created: {output_manifest}")
        
        segment_count = len(list(output_dir.glob("segment*.ts")))
        
        stage_duration = round((time.perf_counter() - stage_start) * 1000)
        log_event(
            severity="info",
            event_type="stage_complete",
            stage="transcode",
            job_id=job_id,
            media_id=media_id,
            duration_ms=stage_duration,
            segment_count=segment_count,
        )
        return True
        
    except subprocess.CalledProcessError as e:
        log_event(
            severity="error",
            event_type="transcode_failed",
            job_id=job_id,
            media_id=media_id,
            error_code="FFMPEG_FAILED",
            error_message=e.stderr if e.stderr else str(e),
        )
        return False
    except Exception as e:
        log_event(
            severity="error",
            event_type="transcode_failed",
            job_id=job_id,
            media_id=media_id,
            error_code="FFMPEG_FAILED",
            error_message=str(e),
        )
        return False


def generate_thumbnail(input_path: Path, output_path: Path, job_id: str) -> bool:
    """Generate thumbnail from video"""
    try:
        # Get duration
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(input_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        duration = float(result.stdout.strip())
        
        if duration <= 0:
            return False
        
        # Seek to 30s or 30% of video
        seek_time = 30 if duration >= 30 else max(0.1, duration * 0.3)
        
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(input_path),
            "-ss", f"{seek_time:.2f}",
            "-vframes", "1",
            "-q:v", "2",
            str(output_path)
        ]
        
        subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        
        log_event(
            severity="info",
            event_type="thumbnail_generated",
            job_id=job_id,
        )
        return True
        
    except Exception as e:
        log_event(
            severity="warn",
            event_type="thumbnail_failed",
            job_id=job_id,
            error_message=str(e),
        )
        return False


def upload_to_wasabi(local_dir: Path, bucket: str, base_key: str, job_id: str, media_id: str) -> bool:
    """Upload HLS files to Wasabi"""
    try:
        stage_start = time.perf_counter()
        
        log_event(
            severity="info",
            event_type="stage_start",
            stage="upload",
            job_id=job_id,
            media_id=media_id,
        )
        
        files = sorted(local_dir.iterdir(), key=lambda x: x.name)
        for file_path in files:
            if file_path.is_file():
                dest_key = f"{base_key}{file_path.name}"
                s3.upload_file(
                    Filename=str(file_path),
                    Bucket=bucket,
                    Key=dest_key
                )
        
        stage_duration = round((time.perf_counter() - stage_start) * 1000)
        log_event(
            severity="info",
            event_type="stage_complete",
            stage="upload",
            job_id=job_id,
            media_id=media_id,
            duration_ms=stage_duration,
            file_count=len(files),
        )
        return True
        
    except Exception as e:
        log_event(
            severity="error",
            event_type="upload_failed",
            job_id=job_id,
            media_id=media_id,
            error_code="WASABI_UPLOAD_FAILED",
            error_message=str(e),
        )
        return False


def process_job(
    job_id: str, 
    media_id: str, 
    org_id: str,
    sqs_client=None,
    receipt_handle: Optional[str] = None
):
    """
    Process a transcode job.
    
    Args:
        job_id: Job UUID
        media_id: Media asset UUID
        org_id: Organization UUID
        sqs_client: SQS client for heartbeat visibility extension
        receipt_handle: Message receipt handle for heartbeat
    """
    start_time = time.perf_counter()
    
    log_event(
        severity="info",
        event_type="job_start",
        job_id=job_id,
        media_id=media_id,
        org_id=org_id,
        worker_type="jetson",
    )
    
    # Get job details
    job_data = get_job_details(job_id)
    if not job_data:
        log_event(
            severity="error",
            event_type="job_not_found",
            job_id=job_id,
        )
        return False
    
    # Check if already processed
    if job_data["state"] in ["succeeded", "failed"]:
        log_event(
            severity="info",
            event_type="job_already_finished",
            job_id=job_id,
            state=job_data["state"],
        )
        return True
    
    media_asset = job_data.get("media_assets")
    if not media_asset:
        log_event(
            severity="error",
            event_type="media_asset_not_found",
            job_id=job_id,
        )
        return False
    
    bucket = media_asset["bucket"]
    storage_path = media_asset["storage_path"]
    base_org_storage_path = media_asset["base_org_storage_path"]
    
    # Set job to running
    update_job_fields(job_id, {
        "state": "running",
        "started_at": "now()"
    })
    
    # Update processing_stage to 'transcoding'
    log_event(
        severity="info",
        event_type="processing_stage_transition",
        job_id=job_id,
        media_id=media_id,
        from_stage="uploaded",
        to_stage="transcoding",
    )
    update_media_asset_processing_stage(media_id, org_id, "transcoding")
    
    # Prepare paths
    input_file = WORK_DIR / f"{media_id}-input.mp4"
    output_dir = WORK_DIR / f"{media_id}-output"
    output_dir.mkdir(exist_ok=True)
    thumbnail_file = output_dir / "thumbnail.jpg"
    
    # Initialize heartbeat (will start after we estimate processing time)
    heartbeat: Optional[VisibilityHeartbeat] = None
    
    try:
        # Download
        if not download_from_wasabi(bucket, storage_path, input_file, job_id, media_id):
            raise Exception("Download failed")
        
        # Log file size for performance tracking
        file_size_bytes = input_file.stat().st_size
        file_size_mb = round(file_size_bytes / 1024 / 1024, 2)
        
        # Estimate processing time and start heartbeat
        estimated_time_seconds = estimate_processing_time(file_size_bytes)
        
        log_event(
            severity="info",
            event_type="file_size_detected",
            job_id=job_id,
            media_id=media_id,
            file_size_bytes=file_size_bytes,
            file_size_mb=file_size_mb,
            estimated_processing_seconds=estimated_time_seconds,
        )
        
        # Start heartbeat if we have SQS client and receipt handle
        if sqs_client and receipt_handle:
            # Extend by 5 minutes every 4 minutes
            heartbeat = VisibilityHeartbeat(
                sqs_client=sqs_client,
                queue_url=SQS_QUEUE_URL,
                receipt_handle=receipt_handle,
                extension_seconds=300,  # Extend by 5 minutes
                heartbeat_interval=240,  # Beat every 4 minutes
                job_id=job_id,
            )
            heartbeat.start()
        
        # Transcode
        if not transcode_video(input_file, output_dir, job_id, media_id):
            raise Exception("Transcode failed")
        
        # Generate thumbnail
        generate_thumbnail(input_file, thumbnail_file, job_id)
        
        # Upload HLS files
        base_key = f"orgs/{org_id}/uploads/{media_id}/streaming/"
        if not upload_to_wasabi(output_dir, bucket, base_key, job_id, media_id):
            raise Exception("Upload failed")
        
        # Update media_assets with derivatives
        log_event(
            severity="info",
            event_type="updating_media_derivatives",
            job_id=job_id,
            media_id=media_id,
        )
        thumbnail_path = f"{base_key}thumbnail.jpg" if thumbnail_file.exists() else None
        update_media_asset_derivatives(media_id, streaming_ready=True, thumbnail_path=thumbnail_path)
        
        # Update processing_stage to 'transcoded'
        log_event(
            severity="info",
            event_type="processing_stage_transition",
            job_id=job_id,
            media_id=media_id,
            from_stage="transcoding",
            to_stage="transcoded",
        )
        update_media_asset_processing_stage(media_id, org_id, "transcoded")
        
        # Mark job as succeeded
        log_event(
            severity="info",
            event_type="updating_job_state",
            job_id=job_id,
            media_id=media_id,
            state="succeeded",
        )
        update_job_fields(job_id, {
            "state": "succeeded",
            "finished_at": "now()",
            "progress": 1.0
        })
        
        # Final processing_stage to 'complete' and status to 'ready'
        log_event(
            severity="info",
            event_type="processing_stage_transition",
            job_id=job_id,
            media_id=media_id,
            from_stage="transcoded",
            to_stage="complete",
        )
        success = update_media_asset_processing_stage(
            media_id=media_id,
            org_id=org_id,
            processing_stage="complete",
            status="ready"
        )
        
        if not success:
            log_event(
                severity="error",
                event_type="final_status_update_failed",
                job_id=job_id,
                media_id=media_id,
            )
        else:
            log_event(
                severity="info",
                event_type="processing_complete",
                job_id=job_id,
                media_id=media_id,
            )
        
        total_duration = round((time.perf_counter() - start_time) * 1000)
        log_event(
            severity="info",
            event_type="job_success",
            job_id=job_id,
            media_id=media_id,
            total_duration_ms=total_duration,
            file_size_bytes=file_size_bytes,
            file_size_mb=file_size_mb,
            worker_type="jetson",
        )
        
        return True
        
    except Exception as e:
        log_event(
            severity="error",
            event_type="job_failure",
            job_id=job_id,
            media_id=media_id,
            error_message=str(e),
            worker_type="jetson",
        )
        
        update_job_fields(job_id, {
            "state": "failed",
            "finished_at": "now()",
            "error_message": str(e)
        })
        
        return False
    
    finally:
        # Stop heartbeat
        if heartbeat:
            heartbeat.stop()
            stats = heartbeat.get_stats()
            log_event(
                severity="info",
                event_type="heartbeat_stats",
                job_id=job_id,
                **stats
            )
        
        # Cleanup
        if input_file.exists():
            input_file.unlink()
        if output_dir.exists():
            import shutil
            shutil.rmtree(output_dir)


def main():
    """Main worker loop - polls SQS queue"""
    log_event(
        severity="info",
        event_type="worker_initializing",
        worker_type="jetson_sqs",
        hardware_profile="orin_nano",
    )
    
    # Verify FFmpeg availability
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        log_event(severity="info", event_type="ffmpeg_available")
    except FileNotFoundError:
        log_event(
            severity="error",
            event_type="ffmpeg_not_found",
            error_message="ffmpeg not available. Install: sudo apt-get install ffmpeg",
        )
        sys.exit(1)
    
    # Verify h264_nvv4l2dec decoder support
    try:
        result = subprocess.run(
            ["ffmpeg", "-decoders"],
            capture_output=True,
            text=True,
            check=True
        )
        if "h264_nvv4l2dec" in result.stdout:
            log_event(
                severity="info",
                event_type="hardware_decoder_available",
                decoder="h264_nvv4l2dec"
            )
        else:
            log_event(
                severity="warn",
                event_type="hardware_decoder_not_found",
                decoder="h264_nvv4l2dec",
                message="Hardware decoder not available, will use software decode"
            )
    except Exception as e:
        log_event(
            severity="warn",
            event_type="decoder_check_failed",
            error_message=str(e)
        )
    
    log_event(
        severity="info",
        event_type="worker_started",
        queue_url=SQS_QUEUE_URL,
        region=AWS_REGION,
        worker_type="jetson",
    )
    
    while True:
        try:
            # Poll SQS
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=POLL_WAIT_TIME,
                VisibilityTimeout=VISIBILITY_TIMEOUT,
            )
            
            messages = response.get("Messages", [])
            
            if not messages:
                # No messages - continue polling
                continue
            
            for message in messages:
                receipt_handle = message["ReceiptHandle"]
                body = json.loads(message["Body"])
                
                job_id = body.get("job_id")
                media_id = body.get("media_id")
                org_id = body.get("org_id")
                
                if not job_id or not media_id or not org_id:
                    log_event(
                        severity="error",
                        event_type="invalid_message",
                        message_body=body,
                    )
                    sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
                    continue
                
                log_event(
                    severity="info",
                    event_type="message_received",
                    job_id=job_id,
                    media_id=media_id,
                )
                
                # Process the job (pass sqs and receipt_handle for heartbeat)
                success = process_job(
                    job_id, 
                    media_id, 
                    org_id,
                    sqs_client=sqs,
                    receipt_handle=receipt_handle
                )
                
                # Delete message from queue if successful
                if success:
                    sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt_handle)
                    log_event(
                        severity="info",
                        event_type="message_deleted",
                        job_id=job_id,
                    )
                else:
                    # Let message return to queue for retry
                    log_event(
                        severity="warn",
                        event_type="message_retry",
                        job_id=job_id,
                    )
        
        except KeyboardInterrupt:
            log_event(severity="info", event_type="worker_shutdown")
            break
        
        except Exception as e:
            log_event(
                severity="error",
                event_type="worker_error",
                error_message=str(e),
            )
            time.sleep(5)  # Back off on error


if __name__ == "__main__":
    main()
