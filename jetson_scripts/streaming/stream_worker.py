from enum import Enum
from pathlib import Path
import subprocess
from models import JobState, TranscodingJob
import os
import boto3
from dotenv import load_dotenv
from supabase import Client

load_dotenv()

s3 = boto3.client(
    "s3",
    region_name=os.getenv("WASABI_REGION"),
    endpoint_url=os.getenv("WASABI_ENDPOINT"),
    aws_access_key_id=os.getenv("WASABI_KEY"),
    aws_secret_access_key=os.getenv("WASABI_SECRET"),
)

import threading

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
    UPLOAD_OUTPUT = 3
    COMPLETE = 4

class StreamWorker(threading.Thread):

    def __init__(self, job: TranscodingJob, supabase: Client):
        super().__init__(daemon=True)
        self.job: TranscodingJob = job
        self.supabase: Client = supabase
        self.stage: _Stage = _Stage.START
        self.attempts: int = 0

    def _update_job_state(self, state: JobState):
        """
        Updates the state of the current job in the Supabase 'jobs' table.

        Args:
            state (JobState): The new state to set for the job.

        Side Effects:
            - Sends an update request to the Supabase database to change the job's state.
            - Prints a message indicating success or failure of the update operation.

        Exceptions:
            - Catches and prints any exceptions that occur during the update process.
        """
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
        """
        Downloads an input MP4 file from an S3 bucket to a specified local path.

        Args:
            input_mp4_path (str): The local file path where the downloaded MP4 file will be saved.

        Returns:
            bool: True if the file was downloaded successfully, False otherwise.

        Side Effects:
            - Prints progress and status messages to the console.
            - Handles and logs exceptions that occur during the download process.

        Raises:
            Does not raise exceptions; errors are caught and result in a False return value.
        """
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
            print(f"Downloaded file to /tmp/{self.job.media_asset.id}-input.mp4")
            return True
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

    def _transcode(self, input_mp4_path: str, output_hls_path: str) -> bool:
        """
        Transcodes an input MP4 file to HLS (HTTP Live Streaming) format using ffmpeg.

        Args:
            input_mp4_path (str): Path to the input MP4 file.
            output_hls_path (str): Directory where the HLS output (index.m3u8 and segments) will be saved.

        Returns:
            bool: True if transcoding succeeds, False otherwise.

        Side Effects:
            - Runs an external ffmpeg process.
            - Writes HLS files to the specified output directory.
            - Suppresses ffmpeg output (stdout and stderr).
            - Prints an error message if transcoding fails.
        """
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-hwaccel", "nvdec",
                "-i", input_mp4_path,
                "-c", "copy",      # requires video to be h264 and aac audio
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
        """
        Uploads all files from the specified HLS output directory to a Wasabi S3 bucket.

        Args:
            output_hls_path (str): The local directory path containing the HLS output files to upload.

        Returns:
            bool: True if all files are uploaded successfully, False otherwise.

        Side Effects:
            Prints the names of generated files and upload status to the console.

        Exceptions:
            Catches and prints any exceptions that occur during the upload process.
        """
        try:
            files_list = sorted(Path(output_hls_path).iterdir(), key=lambda x: x.name)
            for files in files_list:
                print("Generated file:", files.name)
                full_path = os.path.join(output_hls_path, files.name)
                print("Uploading to wasabi:", f"{self.job.media_asset.bucketless_output_path()}{files.name}")
                s3.upload_file(
                    Filename=full_path,
                    Bucket=self.job.media_asset.bucket,
                    Key=f"{self.job.media_asset.bucketless_output_path()}{files.name}"
                )
            return True
        except Exception as e:
            print(f"Error uploading files: {e}")
            return False

    def run(self):
        """
        Executes the streaming job workflow, managing the stages of downloading the input file,
        transcoding it, and uploading the output. The method attempts each stage up to three times
        in case of failure, and performs cleanup of temporary files upon completion or error.

        Workflow stages:
            1. DOWNLOAD_INPUT: Downloads the input MP4 file from Wasabi storage.
            2. TRANSCODE: Transcodes the downloaded file to HLS format.
            3. UPLOAD_OUTPUT: Uploads the transcoded output files.
            4. COMPLETE: Marks the job as completed.

        Retries:
            - Each stage is retried up to 3 times before aborting the job.

        Cleanup:
            - Temporary input and output files are removed after job completion or failure.

        Exceptions:
            - Catches and logs any unexpected exceptions during the workflow.
        """
        self._start_job()
        input_mp4_path = f"/tmp/{self.job.media_asset.id}-input.mp4"
        output_hls_path = f"/tmp/{self.job.media_asset.id}/"
        self.stage = _Stage.DOWNLOAD_INPUT

        os.makedirs(output_hls_path, exist_ok=True)

        try:

            while not self.stage == _Stage.COMPLETE:
                self.attempts += 1
                self._update_job_fields({
                    "attempt": self.attempts,
                })
                if self.attempts > 3:
                    print(f"Job {self.job.job_id} failed after 3 attempts.")
                    self._update_job_state(JobState.FAILED)
                    break
                # Download the input file from Wasabi
                if self.stage == _Stage.DOWNLOAD_INPUT:
                    success = self._download_input_file(input_mp4_path)
                    if success:
                        self.stage = _Stage.TRANSCODE
                    else:
                        print("Failed to download input file. Retrying...")
                        continue

                if self.stage == _Stage.TRANSCODE:
                    success = self._transcode(input_mp4_path, output_hls_path)
                    if success:
                        self.stage = _Stage.UPLOAD_OUTPUT
                    else:
                        print("Failed to transcode input file. Retrying...")
                        continue

                if self.stage == _Stage.UPLOAD_OUTPUT:
                    success = self._upload_output(output_hls_path)
                    if success:
                        self.completed = True
                    else:
                        print("Failed to upload output files. Retrying...")
                        continue        

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
            # Cleanup temporary files
            if os.path.exists(input_mp4_path):
                os.remove(input_mp4_path)
            if os.path.exists(output_hls_path):
                for f in os.listdir(output_hls_path):
                    os.remove(os.path.join(output_hls_path, f))
                os.rmdir(output_hls_path)
            print(f"Cleaned up temporary files for job {self.job.job_id}.")