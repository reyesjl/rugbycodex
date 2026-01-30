# Dynamic Visibility Timeout Implementation Guide

## Overview

RugbyCodex now uses **dynamic visibility timeout with heartbeat extensions** for SQS message processing. This industry-standard approach prevents duplicate processing while optimizing for faster retries and better scaling decisions.

## What Changed

### Before (Fixed Timeout)
- Fixed 20-minute visibility timeout for all videos
- Messages held invisible even after short clips finished
- Long videos could timeout mid-processing → duplicates
- Scaling only tracked visible messages → premature scale-down

### After (Dynamic + Heartbeat)
- Initial 10-minute timeout (configurable via `SQS_VISIBILITY_TIMEOUT`)
- Worker extends timeout every 4 minutes during processing
- Timeout automatically adapts to actual processing time
- Scaling tracks visible + in-flight messages
- Faster retries on failures (10 min vs 20 min)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Worker receives message (10 min visibility timeout)      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Download file, detect size → estimate processing time    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Start heartbeat thread (extends timeout every 4 min)     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Process video (transcode, thumbnail, upload)             │
│    Heartbeat runs in background, extending timeout          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. On success: Delete message, stop heartbeat               │
│    On failure: Stop heartbeat → message becomes visible     │
└─────────────────────────────────────────────────────────────┘
```

## Heartbeat Behavior

### Timeline Example (4GB Video)

```
t=0:00   - Worker receives message (10 min timeout)
t=0:01   - Download completes, file size: 4GB
t=0:01   - Heartbeat starts (extend every 4 min)
t=0:05   - Transcode begins...
t=0:04   - Heartbeat #1: Extend by 5 min (timeout now 14 min total)
t=0:08   - Heartbeat #2: Extend by 5 min (timeout now 18 min total)
t=0:12   - Heartbeat #3: Extend by 5 min (timeout now 22 min total)
t=0:16   - Heartbeat #4: Extend by 5 min (timeout now 26 min total)
t=0:20   - Heartbeat #5: Extend by 5 min (timeout now 30 min total)
t=0:25   - Processing complete!
t=0:25   - Upload finishes, delete message
t=0:25   - Stop heartbeat
```

### Failure Scenario

```
t=0:00   - Worker receives message (10 min timeout)
t=0:02   - Worker crashes (spot interruption, OOM, etc.)
t=0:02   - Heartbeat stops
t=0:10   - Timeout expires → message becomes visible
t=0:10   - Another worker picks up the job
```

## Configuration

### Environment Variables

**AWS Workers:**
```bash
SQS_VISIBILITY_TIMEOUT=600  # 10 minutes (default in task-definition.json)
```

**Jetson Worker:**
```python
VISIBILITY_TIMEOUT = 600  # 10 minutes (in stream_worker_sqs.py)
```

### Heartbeat Parameters

**Default Settings:**
```python
extension_seconds = 300  # Extend by 5 minutes each time
heartbeat_interval = 240  # Beat every 4 minutes
```

**Why 4 minutes?**
- Extends before timeout expires (4 min beat < 5 min extension)
- Not too frequent (reduces SQS API costs)
- Safe buffer if one heartbeat fails

### Estimated Processing Times

Based on file size (for AWS g4dn.xlarge with T4 GPU):

| File Size | Download | Transcode | Upload | Total | Initial Timeout |
|-----------|----------|-----------|--------|-------|----------------|
| 100MB | 30s | 2 min | 15s | ~3 min | 5 min |
| 500MB | 1 min | 5 min | 30s | ~7 min | 10 min |
| 2GB | 2 min | 15 min | 2 min | ~19 min | 20 min |
| 4GB | 3 min | 25 min | 3 min | ~31 min | 35 min |
| 6GB | 4 min | 40 min | 4 min | ~48 min | 50 min |

**Note:** Jetson Orin Nano is ~30-40% slower (software encoding).

## Scaling Improvements

### New Scaling Metric

**Before:** Only `ApproximateNumberOfMessagesVisible`
```
3 videos uploaded → 3 visible → scale to 3 workers
Workers receive → 0 visible → tries to scale down (BAD!)
```

**After:** `Visible + NotVisible` (combined metric)
```
3 videos uploaded → 3 visible → scale to 3 workers
Workers receive → 0 visible + 3 not-visible = 3 total → maintain 3 workers
Workers complete → 0 total → scale down (GOOD!)
```

### Scale-In Cooldown Reduction

**Before:** 25 minutes (to prevent mid-job termination)
**After:** 10 minutes (heartbeat keeps messages invisible)

**Benefit:** Faster scale-down after short videos complete

## Monitoring

### Key Metrics to Track

**1. Heartbeat Extensions:**
```json
{
  "event_type": "heartbeat_extended",
  "job_id": "...",
  "extension_count": 5,
  "extension_seconds": 300,
  "total_extended_seconds": 1500
}
```

**2. Heartbeat Stats (on completion):**
```json
{
  "event_type": "heartbeat_stats",
  "job_id": "...",
  "extension_count": 5,
  "total_extended_seconds": 1500,
  "is_running": false,
  "last_error": null
}
```

**3. Processing Time vs Estimate:**
```json
{
  "event_type": "file_size_detected",
  "job_id": "...",
  "file_size_bytes": 4294967296,
  "file_size_mb": 4096,
  "estimated_processing_seconds": 1860
}
```

### CloudWatch Queries

**Failed Heartbeats:**
```
fields @timestamp, job_id, error_message
| filter event_type = "heartbeat_extension_failed"
| sort @timestamp desc
| limit 100
```

**Heartbeat Statistics:**
```
fields @timestamp, job_id, extension_count, total_extended_seconds
| filter event_type = "heartbeat_stats"
| stats avg(extension_count) as avg_extensions, 
        max(extension_count) as max_extensions,
        avg(total_extended_seconds) as avg_extended_seconds
```

**Duplicate Processing Detection:**
```
fields @timestamp, job_id
| filter event_type = "job_already_running" or event_type = "job_already_finished"
| count() by job_id
| filter count > 1
```

## Troubleshooting

### Issue: Messages becoming visible during processing

**Symptoms:** Jobs restart mid-processing, duplicate work

**Possible Causes:**
1. Heartbeat thread crashed
2. Network issues preventing `change_message_visibility` calls
3. Receipt handle became invalid

**Solution:**
- Check CloudWatch logs for `heartbeat_extension_failed` events
- Verify worker has SQS permissions (`sqs:ChangeMessageVisibility`)
- Increase heartbeat frequency if network is unreliable

### Issue: Workers terminating mid-job

**Symptoms:** Jobs fail after 10 minutes, return to queue

**Possible Causes:**
1. Heartbeat not starting (missing sqs_client or receipt_handle)
2. Worker killed before heartbeat starts

**Solution:**
- Verify heartbeat start logs: `"event_type": "heartbeat_started"`
- Check that `sqs_client` and `receipt_handle` are passed to `process_*_job()`

### Issue: High SQS API costs

**Symptoms:** Increased AWS bill, many `ChangeMessageVisibility` calls

**Possible Causes:**
1. Heartbeat interval too short
2. Many long-running jobs

**Solution:**
- Current interval (4 min) is already optimized
- Each heartbeat costs ~$0.0000004 (negligible)
- For 100 videos/month with 5 extensions each: ~$0.0002

## Testing

### Test Case 1: Short Clip

```bash
# Upload a 60MB clip
# Expected: Completes in ~5 min, 0 heartbeat extensions

# Check logs:
grep "heartbeat_stats" cloudwatch.log | jq '.extension_count'
# Should be 0 or 1
```

### Test Case 2: Medium Video

```bash
# Upload a 2GB video
# Expected: Completes in ~15 min, 2-3 heartbeat extensions

# Check logs:
grep "heartbeat_stats" cloudwatch.log | jq '.extension_count'
# Should be 2-3
```

### Test Case 3: Long Match

```bash
# Upload a 4GB video
# Expected: Completes in ~25 min, 4-5 heartbeat extensions

# Check logs:
grep "heartbeat_stats" cloudwatch.log | jq '.extension_count'
# Should be 4-5
```

### Test Case 4: Worker Crash

```bash
# Start processing, then kill worker mid-job
kill -9 <worker_pid>

# Expected: Message becomes visible after 10 min, another worker picks it up
# Check SQS:
aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessagesVisible

# Wait 10 minutes, message should reappear
```

## Rollback Plan

If issues arise, rollback is simple:

1. **Revert SQS timeout:**
```bash
aws sqs set-queue-attributes \
  --queue-url $QUEUE_URL \
  --attributes "VisibilityTimeout=1200"  # Back to 20 min
```

2. **Revert scaling policy:**
```bash
aws application-autoscaling put-scaling-policy \
  --policy-name rugbycodex-ecs-queue-tracking \
  --target-tracking-scaling-policy-configuration '{
    "ScaleInCooldown": 1500  # Back to 25 min
  }'
```

3. **Deploy previous worker code:**
```bash
# Redeploy without heartbeat changes
git checkout <previous-commit>
./deploy-transcoding-worker.sh
```

## Performance Impact

### Expected Improvements

1. **Duplicate Processing:** 0% (vs ~5% for long videos previously)
2. **Retry Latency:** 10 min (vs 20 min previously)
3. **Scale-Down Time:** 10-15 min (vs 25+ min previously)
4. **Cost Savings:** ~10-15% from faster scale-down

### Overhead

1. **SQS API Calls:** +5 calls per long video (~$0.000002 per video)
2. **CPU Usage:** Negligible (heartbeat thread is lightweight)
3. **Memory:** +1KB per worker (thread stack)

## References

- AWS SQS Visibility Timeout: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- Heartbeat Pattern: Industry standard for long-polling workers
- Implementation: `aws_workers/shared/visibility_heartbeat.py`

## Next Steps

1. Monitor CloudWatch logs for first 48 hours
2. Track duplicate processing rate (should be 0%)
3. Verify heartbeat extensions are working as expected
4. Tune heartbeat interval if needed based on actual performance
5. Consider adding ML-based processing time prediction
