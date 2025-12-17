from dataclasses import dataclass
from uuid import UUID

from enum import Enum

class JobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SUCCEEDED = "succeeded"


@dataclass
class MediaAsset:
    id: UUID
    org_id: UUID
    bucket: str
    storage_path: str
    file_name: str
    duration_seconds: float
    status: str

    @staticmethod
    def from_row(row: dict) -> "MediaAsset":
        return MediaAsset(
            id=UUID(row["id"]),
            org_id=UUID(row["org_id"]),
            bucket=row["bucket"],
            storage_path=row["storage_path"],
            file_name=row["file_name"],
            duration_seconds=row["duration_seconds"],
            status=row["status"],
        )
    def __str__(self):
        return f"""MediaAsset(
        id               = {self.id},
        org_id           = {self.org_id},
        bucket           = {self.bucket},
        storage_path     = {self.storage_path},
        file_name        = {self.file_name},
        duration_seconds = {self.duration_seconds},
        status           = {self.status}
    )
        """
    
    def full_input_path(self) -> str:
        return f"{self.bucket}/{self.storage_path}/{self.file_name}"
    def bucketless_input_path(self) -> str:
        return f"{self.storage_path}/{self.file_name}"
    def full_output_path(self) -> str:
        return f"{self.bucket}/{self.storage_path.replace("input", "output")}/{self.file_name.replace(".mp4", "/")}"
    def bucketless_output_path(self) -> str:
        return f"{self.storage_path.replace("input", "output")}/{self.file_name.replace(".mp4", "/")}"



@dataclass
class TranscodingJob:
    job_id: UUID
    job_state: JobState
    media_asset: MediaAsset

    @staticmethod
    def from_row(row: dict) -> "TranscodingJob":
        return TranscodingJob(
            job_id=UUID(row["id"]),
            job_state=JobState(row["state"]),
            media_asset=MediaAsset.from_row(row["media_asset"]),
        )

    def __str__(self):
        return f"""
TranscodingJob(
    job_id      = {self.job_id},
    job_state   = {self.job_state},
    media_asset = {self.media_asset}
)
        """
