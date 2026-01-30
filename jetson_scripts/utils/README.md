# Shared Utilities

Shared modules used by both Jetson workers (transcoding and cleanup).

## Modules

### observability.py

Centralized logging with optional Axiom integration.

**Purpose**: Structured event logging to stdout and Axiom cloud.

**Key Features**:
- JSON-formatted log output
- Automatic timestamp and environment tagging
- Falls back to stdout if Axiom unavailable
- Flush after each log for immediate visibility

**Usage**:
```python
from utils.observability import log_event

# Simple event
log_event(
    severity="info",
    event_type="job_started",
    job_id="123"
)

# Event with multiple fields
log_event(
    severity="error",
    event_type="transcode_failed",
    job_id="456",
    error_code="FFMPEG_ERROR",
    error_message="Failed to decode video"
)
```

**Environment Variables**:
```bash
AXIOM_API_TOKEN=your_token      # Optional - enables Axiom
AXIOM_DATASET=rugbycodex-logs   # Optional - default shown
AXIOM_ENVIRONMENT=jetson        # Optional - default "production"
```

**Behavior**:
- If `AXIOM_API_TOKEN` is set: Logs to stdout AND Axiom
- If token missing: Logs to stdout only
- If Axiom ingest fails: Logs error to stderr, continues

**Log Format**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456Z",
  "environment": "jetson",
  "severity": "info",
  "event_type": "job_completed",
  "job_id": "abc-123",
  "duration_seconds": 125.5
}
```

---

### visibility_heartbeat.py

SQS message visibility timeout manager for long-running jobs.

**Purpose**: Prevents duplicate processing by keeping SQS messages invisible during transcoding.

**Problem Solved**:
- Video transcoding can take 5-60 minutes
- Fixed SQS timeouts cause issues:
  - Too short → Message becomes visible mid-job → duplicate processing
  - Too long → Failed jobs wait unnecessarily before retry

**Solution**: Dynamic heartbeat that extends timeout during processing.

**How It Works**:
1. Calculate initial timeout based on file size (5-60 minutes)
2. Start background thread that extends timeout every 4 minutes
3. Worker processes video
4. Stop heartbeat when done (or on error)
5. Delete message from queue

**Usage**:
```python
from utils.visibility_heartbeat import VisibilityHeartbeat, calculate_initial_timeout

# Get message from SQS
response = sqs.receive_message(QueueUrl=queue_url, WaitTimeSeconds=20)
message = response['Messages'][0]
receipt_handle = message['ReceiptHandle']

# Get file size and calculate initial timeout
file_size = s3.head_object(Bucket=bucket, Key=key)['ContentLength']
initial_timeout = calculate_initial_timeout(file_size)

# Start heartbeat
heartbeat = VisibilityHeartbeat(
    sqs_client=sqs,
    queue_url=queue_url,
    receipt_handle=receipt_handle,
    extension_seconds=300,      # Extend by 5 min each time
    heartbeat_interval=240,     # Beat every 4 min
    job_id="abc-123"            # Optional for logging
)
heartbeat.start()

try:
    # Process video (takes long time)
    transcode_video()
    
    # Success - delete message
    sqs.delete_message(
        QueueUrl=queue_url,
        ReceiptHandle=receipt_handle
    )
finally:
    # Always stop heartbeat
    heartbeat.stop()
```

**VisibilityHeartbeat Class**:
- Runs in background daemon thread
- Extends visibility timeout every 4 minutes by 5 minutes
- Stops automatically when `.stop()` called
- Logs extension count and errors

**calculate_initial_timeout() Function**:
```python
def calculate_initial_timeout(file_size_bytes: int) -> int:
    """
    Returns initial SQS visibility timeout in seconds.
    
    Based on file size:
    - < 100MB: 5 minutes
    - < 500MB: 10 minutes
    - < 1GB: 15 minutes
    - < 2GB: 25 minutes
    - < 4GB: 45 minutes
    - >= 4GB: 60 minutes (max SQS allows)
    """
```

**estimate_processing_time() Function**:
```python
def estimate_processing_time(file_size_gb: float) -> float:
    """
    Estimates video processing time in minutes.
    
    Formula:
    - Download: file_size_gb * 0.5 min/GB
    - Transcode: file_size_gb * 8 min/GB (varies by codec/resolution)
    - Upload: file_size_gb * 0.75 min/GB
    """
```

**Key Benefits**:
- ✅ No duplicate processing (timeout extends automatically)
- ✅ Faster retries on failure (starts at 5-10 min, not fixed 20 min)
- ✅ Handles any video size (timeout grows as needed)
- ✅ Better resource utilization (accurate processing time tracking)

**Error Handling**:
- If heartbeat extension fails, thread stops and logs error
- Worker can optionally provide `on_failure` callback
- Original timeout remains if extensions fail
- Message becomes visible when timeout expires

**Logging Events**:
- `heartbeat_started` - Background thread started
- `heartbeat_extended` - Visibility timeout extended
- `heartbeat_stopped` - Heartbeat stopped cleanly
- `heartbeat_failed` - Extension API call failed
- `heartbeat_stats` - Final statistics (extension count, errors)

**Thread Safety**:
- Uses threading.Event for clean shutdown
- Daemon thread (won't block Python exit)
- join() with timeout prevents hanging
- Thread-safe stop mechanism

---

## Integration

Both workers import these utilities:

**Transcoding Worker** (`streaming/stream_worker_sqs.py`):
```python
from utils.observability import log_event
from utils.visibility_heartbeat import VisibilityHeartbeat, calculate_initial_timeout
```

**Cleanup Worker** (`cleanup/cleanup_worker.py`):
```python
from utils.observability import log_event
```

Note: Cleanup worker doesn't use heartbeat (not SQS-based).

---

## Dependencies

Install required packages:
```bash
pip3 install axiom-py boto3
```

Axiom is optional:
```bash
# Without Axiom - logs to stdout only
pip3 install boto3

# With Axiom - logs to stdout + Axiom
pip3 install boto3 axiom-py
```

---

## Monitoring

### Axiom Queries

**All Jetson logs**:
```
['environment'] == 'jetson'
```

**Heartbeat activity**:
```
['environment'] == 'jetson' and ['event_type'] starts-with 'heartbeat_'
```

**Errors only**:
```
['environment'] == 'jetson' and ['severity'] == 'error'
```

**Specific worker**:
```
['environment'] == 'jetson' and ['event_type'] starts-with 'transcode_'
['environment'] == 'jetson' and ['event_type'] starts-with 'cleanup_'
```

### Systemd Logs

Both workers log to systemd journal:
```bash
# Transcoding worker logs
sudo journalctl -u rugbycodex-transcoder-sqs -f

# Cleanup worker logs
sudo journalctl -u rugbycodex-cleanup -f

# All Jetson worker logs
sudo journalctl -u "rugbycodex-*" -f
```

---

## Development

### Testing observability.py

```bash
cd /home/scribe/rugbycodex/jetson_scripts/utils

# Test without Axiom
python3 -c "
from observability import log_event
log_event(severity='info', event_type='test', message='Hello')
"

# Test with Axiom (set token first)
export AXIOM_API_TOKEN=your_token
export AXIOM_DATASET=rugbycodex-logs
python3 -c "
from observability import log_event
log_event(severity='info', event_type='test', message='Hello Axiom')
"
```

### Testing visibility_heartbeat.py

See `../../aws_workers/shared/tests/test_visibility_heartbeat.py` for unit tests.

Quick manual test:
```bash
cd /home/scribe/rugbycodex/jetson_scripts/utils

# Test timeout calculation
python3 -c "
from visibility_heartbeat import calculate_initial_timeout
print(f'100MB: {calculate_initial_timeout(100 * 1024**2)} seconds')
print(f'1GB: {calculate_initial_timeout(1 * 1024**3)} seconds')
print(f'4GB: {calculate_initial_timeout(4 * 1024**3)} seconds')
"
```

---

## File Organization

```
utils/
├── README.md (this file)
├── observability.py          # Logging module
└── visibility_heartbeat.py   # SQS heartbeat module
```

---

## Related Documentation

- [Parent README](../README.md) - Overall Jetson architecture
- [Transcoding Worker](../streaming/README.md) - Uses both modules
- [Cleanup Worker](../cleanup/README.md) - Uses observability only
- [Environment Guide](../ENV_GUIDE.md) - Configuration setup
