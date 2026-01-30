"""
SQS Visibility Timeout Heartbeat Manager

Extends message visibility timeout during long-running job processing
to prevent duplicate message processing.
"""
import threading
import time
from typing import Optional, Callable
from observability import log_event


class VisibilityHeartbeat:
    """
    Manages automatic extension of SQS message visibility timeout.
    
    The heartbeat runs in a background thread and extends the visibility
    timeout at regular intervals to ensure the message remains invisible
    while processing continues.
    
    Usage:
        heartbeat = VisibilityHeartbeat(
            sqs_client=sqs,
            queue_url="https://...",
            receipt_handle="...",
            extension_seconds=300,  # Extend by 5 minutes each time
            heartbeat_interval=240,  # Beat every 4 minutes
            job_id="uuid"
        )
        heartbeat.start()
        try:
            # Do long-running work...
            process_video()
        finally:
            heartbeat.stop()  # Always stop to cleanup thread
    """
    
    def __init__(
        self,
        sqs_client,
        queue_url: str,
        receipt_handle: str,
        extension_seconds: int = 300,
        heartbeat_interval: int = 240,
        job_id: Optional[str] = None,
        on_failure: Optional[Callable[[Exception], None]] = None
    ):
        """
        Initialize heartbeat manager.
        
        Args:
            sqs_client: Boto3 SQS client
            queue_url: Full SQS queue URL
            receipt_handle: Message receipt handle from receive_message
            extension_seconds: How many seconds to extend timeout by (default: 300 = 5 min)
            heartbeat_interval: Seconds between heartbeat extensions (default: 240 = 4 min)
            job_id: Optional job ID for logging
            on_failure: Optional callback when heartbeat fails
        """
        self.sqs = sqs_client
        self.queue_url = queue_url
        self.receipt_handle = receipt_handle
        self.extension_seconds = extension_seconds
        self.heartbeat_interval = heartbeat_interval
        self.job_id = job_id
        self.on_failure = on_failure
        
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.extension_count = 0
        self.last_error: Optional[str] = None
        
    def start(self) -> None:
        """Start the heartbeat thread."""
        if self.thread is not None and self.thread.is_alive():
            log_event(
                severity="warn",
                event_type="heartbeat_already_running",
                job_id=self.job_id,
            )
            return
            
        self.stop_event.clear()
        self.thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True,
            name=f"heartbeat-{self.job_id or 'unknown'}"
        )
        self.thread.start()
        
        log_event(
            severity="info",
            event_type="heartbeat_started",
            job_id=self.job_id,
            extension_seconds=self.extension_seconds,
            heartbeat_interval=self.heartbeat_interval,
        )
        
    def stop(self, timeout: float = 5.0) -> None:
        """
        Stop the heartbeat thread.
        
        Args:
            timeout: Max seconds to wait for thread to stop
        """
        if self.thread is None:
            return
            
        self.stop_event.set()
        self.thread.join(timeout=timeout)
        
        if self.thread.is_alive():
            log_event(
                severity="warn",
                event_type="heartbeat_stop_timeout",
                job_id=self.job_id,
                timeout_seconds=timeout,
            )
        else:
            log_event(
                severity="info",
                event_type="heartbeat_stopped",
                job_id=self.job_id,
                total_extensions=self.extension_count,
            )
            
    def _heartbeat_loop(self) -> None:
        """Main heartbeat loop - runs in background thread."""
        while not self.stop_event.wait(self.heartbeat_interval):
            try:
                # Extend visibility timeout
                self.sqs.change_message_visibility(
                    QueueUrl=self.queue_url,
                    ReceiptHandle=self.receipt_handle,
                    VisibilityTimeout=self.extension_seconds
                )
                
                self.extension_count += 1
                
                log_event(
                    severity="info",
                    event_type="heartbeat_extended",
                    job_id=self.job_id,
                    extension_count=self.extension_count,
                    extension_seconds=self.extension_seconds,
                    total_extended_seconds=self.extension_count * self.extension_seconds,
                )
                
            except Exception as e:
                error_msg = str(e)
                self.last_error = error_msg
                
                log_event(
                    severity="error",
                    event_type="heartbeat_extension_failed",
                    job_id=self.job_id,
                    error_message=error_msg,
                    extension_count=self.extension_count,
                )
                
                # Call failure callback if provided
                if self.on_failure:
                    try:
                        self.on_failure(e)
                    except Exception as callback_error:
                        log_event(
                            severity="error",
                            event_type="heartbeat_callback_failed",
                            job_id=self.job_id,
                            error_message=str(callback_error),
                        )
                
                # Stop heartbeat on error (receipt handle may be invalid)
                break
                
    def get_stats(self) -> dict:
        """Get heartbeat statistics."""
        return {
            "extension_count": self.extension_count,
            "total_extended_seconds": self.extension_count * self.extension_seconds,
            "is_running": self.thread is not None and self.thread.is_alive(),
            "last_error": self.last_error,
        }


def calculate_initial_timeout(file_size_bytes: int) -> int:
    """
    Calculate initial visibility timeout based on video file size.
    
    Processing time estimates (for AWS g4dn.xlarge with T4 GPU):
    - Download: ~30 seconds per GB (network dependent)
    - Transcode: ~8 minutes per GB of video (5-8x realtime for typical 2-hour matches)
    - Upload: ~45 seconds per GB (network dependent)
    
    Formula: (size_gb * 10 minutes) + 5 minute buffer
    
    Args:
        file_size_bytes: Size of video file in bytes
        
    Returns:
        Recommended initial visibility timeout in seconds
    """
    size_gb = file_size_bytes / (1024 ** 3)
    
    if size_gb < 0.1:  # < 100MB (very short clips)
        return 300  # 5 minutes
    elif size_gb < 0.5:  # < 500MB (short clips)
        return 600  # 10 minutes
    elif size_gb < 2:  # < 2GB (medium videos)
        return 1200  # 20 minutes
    elif size_gb < 4:  # < 4GB (typical match)
        return 2100  # 35 minutes
    elif size_gb < 6:  # < 6GB (long match)
        return 3000  # 50 minutes
    else:  # > 6GB (very long matches)
        return 3600  # 60 minutes (max practical timeout)


def estimate_processing_time(file_size_bytes: int) -> int:
    """
    Estimate total processing time in seconds based on file size.
    
    Returns:
        Estimated seconds to complete processing
    """
    size_gb = file_size_bytes / (1024 ** 3)
    
    # Conservative estimates
    download_time = size_gb * 30  # 30 seconds per GB
    transcode_time = size_gb * 480  # 8 minutes per GB
    upload_time = size_gb * 45  # 45 seconds per GB
    overhead = 60  # 1 minute for initialization, thumbnail, etc.
    
    total = download_time + transcode_time + upload_time + overhead
    return int(total)
