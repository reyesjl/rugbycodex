from enum import Enum
from pathlib import Path
import subprocess
from models import JobState, TranscodingJob
import os
import boto3
from dotenv import load_dotenv
from supabase import Client
import threading

load_dotenv()

s3 = boto3.client(
    "s3",
    region_name=os.getenv("WASABI_REGION"),
    endpoint_url=os.getenv("WASABI_ENDPOINT"),
    aws_access_key_id=os.getenv("WASABI_KEY"),
    aws_secret_access_key=os.getenv("WASABI_SECRET"),
)


class TransferProgress:
    def __init__(self, total_bytes: int, label: str):
        self.total = total_bytes
        self.label = label
        self.seen = 0
        self.lock = threading.Lock()
        self.notify_threshold = total_bytes // 10  # Notify every 10%

    def __call__(self, bytes_amount):
        with self.lock:
            self.seen += bytes_amount
            percent = (self.seen / self.total) * 100
            if self.seen >= self.notify_threshold:
                self.notify_threshold += self.total // 10
                print(f"{self.label}: {percent:6.2f}% ({self.seen}/{self.total})")


class _Stage(Enum):
    START = 0
    DOWNLOAD_INPUT = 1
    TRANSCODE = 2
    GENERATE_THUMBNAIL = 3
    UPLOAD_OUTPUT = 4
    COMPLETE = 5


class StreamWorker(threading.Thread):
    def __init__(self, job: TranscodingJob, supabase: Client):
        super().__init__(daemon=True)
        self.job: TranscodingJob = job
        self.supabase: Client = supabase
        self.stage: _Stage = _Stage.START
        self.attempts: int = 0

    def _update_job_state(self, state: JobState):
        try:
            (
                self.supabase
                .table("jobs")
                .update({"state": state.value})
                .eq("id", str(self.job.job_id))
                .execute()
            )
        except Exception as e:
            print(f"Exception while updating job state for {self.job.job_id}: {e}")

    def _update_job_fields(self, fields: dict):
        try:
            (
                self.supabase
                .table("jobs")
                .update(fields)
                .eq("id", str(self.job.job_id))
                .execute()
            )
        except Exception as e:
            print(f"Exception while updating job fields for {self.job.job_id}: {e}")

    def _start_job(self):
        self._update_job_fields({
            "state": JobState.RUNNING.value,
            "started_at": "now()"
        })

    def _complete_job(self):
        self.stage = _Stage.COMPLETE
        self._update_job_fields({
            "state": JobState.SUCCEEDED.value,
            "finished_at": "now()",
            "progress": 1.0
        })

    def _download_input_file(self, input_mp4_path: str) -> bool:
        key: str = f"{self.job.media_asset.bucketless_input_path()}"
        try:
            head = s3.head_object(
                Bucket=self.job.media_asset.bucket,
                Key=key,
            )

            total_size = head["ContentLength"]
            progress = TransferProgress(total_size, f"Downloading {self.job.media_asset.id}-input.mp4")

            s3.download_file(
                Bucket=self.job.media_asset.bucket,
                Key=key,
                Filename=input_mp4_path,
                Callback=progress
            )
            print(f"Downloaded file to {input_mp4_path}")
            return True
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def _get_video_duration(self, input_mp4_path: str) -> float:
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                input_mp4_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())
        except Exception as e:
            print(f"Error getting video duration: {e}")
            return 0.0

    def _transcode(self, input_mp4_path: str, output_hls_path: str) -> bool:
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-hwaccel", "nvdec",
                "-i", input_mp4_path,
                "-c", "copy",  # requires video to be h264 and aac audio
                "-f", "hls",
                "-hls_time", "6",
                "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
                os.path.join(output_hls_path, "index.m3u8"),
            ]

            subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            return True
        except Exception as e:
            print(f"Error during transcoding: {e}")
            return False

    def _upload_output(self, output_hls_path: str) -> bool:
        try:
            files_list = sorted(Path(output_hls_path).iterdir(), key=lambda x: x.name)
            for files in files_list:
                print("Generated file:", files.name)
                full_path = os.path.join(output_hls_path, files.name)
                dest_key = f"{self.job.media_asset.bucketless_output_path()}{files.name}"
                print("Uploading to wasabi:", dest_key)
                s3.upload_file(
                    Filename=full_path,
                    Bucket=self.job.media_asset.bucket,
                    Key=dest_key
                )
            return True
        except Exception as e:
            print(f"Error uploading files: {e}")
            return False

    def _generate_thumbnail(self, input_mp4_path: str, output_path: str) -> bool:
        try:
            duration = self._get_video_duration(input_mp4_path)
            if duration <= 0:
                print("Could not determine video duration, skipping thumbnail.")
                return False

            if duration >= 30:
                seek_time = 30
            else:
                seek_time = max(0.1, duration * 0.3)

            seek_ts = f"{seek_time:.2f}"

            cmd = [
                "ffmpeg",
                "-y",
                "-i", input_mp4_path,
                "-ss", seek_ts,  # accurate seek AFTER input
                "-vframes", "1",
                "-q:v", "2",
                output_path
            ]

            subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
            print(f"Thumbnail generated at {output_path} (t={seek_ts}s)")
            return True
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            return False

    def _update_media_asset_derivatives(self):
        """
        Marks the media asset as having streaming output and records thumbnail location.
        DOES NOT modify media_assets.status to avoid interfering with existing triggers/semantics.
        """
        try:
            thumbnail_path = f"{self.job.media_asset.bucketless_output_path()}thumbnail.jpg"

            (
                self.supabase
                .table("media_assets")
                .update({
                    "streaming_ready": True,
                    "thumbnail_path": thumbnail_path
                })
                .eq("id", str(self.job.media_asset.id))
                .execute()
            )
            print(f"Updated media_assets derivatives for {self.job.media_asset.id}")
        except Exception as e:
            print(f"Failed to update media_assets derivatives for {self.job.media_asset.id}: {e}")

    def run(self):
        self._start_job()
        input_mp4_path = f"/tmp/{self.job.media_asset.id}-input.mp4"
        output_hls_path = f"/tmp/{self.job.media_asset.id}/"
        self.stage = _Stage.DOWNLOAD_INPUT

        os.makedirs(output_hls_path, exist_ok=True)

        try:
            while self.stage != _Stage.COMPLETE:
                self.attempts += 1
                self._update_job_fields({"attempt": self.attempts})

                if self.attempts > 3:
                    print(f"Job {self.job.job_id} failed after 3 attempts.")
                    self._update_job_state(JobState.FAILED)
                    break

                if self.stage == _Stage.DOWNLOAD_INPUT:
                    if self._download_input_file(input_mp4_path):
                        self.stage = _Stage.TRANSCODE
                    else:
                        print("Failed to download input file. Retrying...")
                        continue

                if self.stage == _Stage.TRANSCODE:
                    if self._transcode(input_mp4_path, output_hls_path):
                        self.stage = _Stage.GENERATE_THUMBNAIL
                    else:
                        print("Failed to transcode input file. Retrying...")
                        continue

                if self.stage == _Stage.GENERATE_THUMBNAIL:
                    thumb_path = os.path.join(output_hls_path, "thumbnail.jpg")
                    if not self._generate_thumbnail(input_mp4_path, thumb_path):
                        print("Warning: failed to generate thumbnail, continuing without it.")
                    self.stage = _Stage.UPLOAD_OUTPUT

                if self.stage == _Stage.UPLOAD_OUTPUT:
                    if not self._upload_output(output_hls_path):
                        print("Failed to upload output files. Retrying...")
                        continue

                    # NEW: record derivatives once upload succeeds
                    self._update_media_asset_derivatives()

                    self._complete_job()
                    print(f"Job {self.job.job_id} completed successfully.")
        except Exception as e:
            print(f"Unexpected error in job {self.job.job_id}: {e}")
            self._update_job_fields({
                "state": JobState.FAILED.value,
                "error_code": self.stage.name,
                "error_message": str(e)
            })
        finally:
            if os.path.exists(input_mp4_path):
                os.remove(input_mp4_path)
            if os.path.exists(output_hls_path):
                for f in os.listdir(output_hls_path):
                    os.remove(os.path.join(output_hls_path, f))
                os.rmdir(output_hls_path)
            print(f"Cleaned up temporary files for job {self.job.job_id}.")