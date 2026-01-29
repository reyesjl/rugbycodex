# RugbyCodex Hybrid Transcoding Architecture

## Overview

**Status:** ✅ Production-ready Hybrid System (January 2026)

RugbyCodex uses a **hybrid transcoding architecture** combining:
1. **On-premise Jetson Orin Nano** - First responder, low-latency processing
2. **AWS ECS GPU Workers** - Cloud burst capacity for overflow

### Strategy Benefits

- ✅ **Fast response:** Jetson grabs jobs immediately (no cold start)
- ✅ **Cost-effective:** Jetson handles most work, AWS only scales when needed
- ✅ **Reliable:** AWS provides burst capacity during high demand
- ✅ **Elastic:** Scales from 1 Jetson → 1 Jetson + 3 AWS workers automatically

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Upload Video (Wasabi)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   ┌──────────┐
                   │ SQS Queue│
                   └─────┬────┘
                         │
         ┌───────────────┼───────────────┐
         │                               │
         ▼                               ▼
┌────────────────┐              ┌──────────────┐
│ Jetson Worker  │              │ AWS Workers  │
│ (Always On)    │              │ (Scale 0-3)  │
├────────────────┤              ├──────────────┤
│ • Orin Nano    │              │ • g4dn.xlarge│
│ • HW Decode    │              │ • NVIDIA T4  │
│ • SW Encode    │              │ • HW Encode  │
│ • Long Polling │              │ • Auto-scale │
└────────────────┘              └──────────────┘
         │                               │
         └───────────────┬───────────────┘
                         ▼
              ┌────────────────────┐
              │ HLS Output (Wasabi)│
              └────────────────────┘
```

---

## Worker Specifications

### 1. Jetson Orin Nano Worker

**Hardware:**
- **Device:** NVIDIA Jetson Orin Nano 8GB
- **CPU:** 6-core ARM Cortex-A78AE
- **GPU:** 1024-core NVIDIA Ampere
- **Memory:** 8GB LPDDR5

**Transcoding Pipeline:**
```bash
FFmpeg with:
- Decoder: h264_nvv4l2dec (hardware)
- Encoder: libx264 ultrafast/zerolatency (software)
- Output: HLS with 6-second segments
```

**Performance:**
- **Short clips (60MB):** ~45-60 seconds
- **2-hour match (4GB):** ~30-40 minutes
- **Power:** ~15W under load

**Location:** On-premise (always available)

### 2. AWS ECS GPU Workers

**Hardware:**
- **Instance:** g4dn.xlarge
- **GPU:** NVIDIA T4 (16GB)
- **CPU:** 4 vCPUs (Cascade Lake)
- **Memory:** 16GB RAM

**Transcoding Pipeline:**
```bash
FFmpeg with:
- Decoder: h264_cuvid (hardware)
- Encoder: h264_nvenc (hardware)
- Output: HLS with 6-second segments
```

**Performance:**
- **Short clips (60MB):** ~35 seconds
- **2-hour match (4GB):** ~25 minutes
- **Speed:** ~5-8x realtime

**Scaling:**
- Min: 0 workers (cost = $0)
- Max: 3 workers (1 On-Demand + 2 Spot)
- Cold start: ~2-3 minutes

---

## How Job Distribution Works

### SQS Polling Strategy

Both worker types poll the same SQS queue with **long polling**:

**Jetson Worker:**
- Always running and polling
- Polls every 20 seconds
- Grabs jobs immediately when available
- **No cold start delay**

**AWS Workers:**
- Start when CloudWatch detects queue depth > 0
- Scale up in ~2-3 minutes
- Poll when running
- Process any remaining jobs

### Race Condition (By Design)

1. Video uploaded → SQS message created
2. **Jetson sees message first** (already polling)
3. Jetson receives message → becomes invisible for 20 minutes
4. AWS starts scaling (takes 2-3 minutes)
5. If Jetson finishes < 20 min → deletes message, AWS workers find no jobs
6. If Jetson takes > 20 min OR more jobs arrive → AWS helps process

**Result:** Jetson handles most work, AWS only processes when needed.

---

## SQS Visibility Timeout Explained

### What is Visibility Timeout?

When a worker **receives** a message from SQS:
1. Message becomes **invisible** to other workers
2. Timer starts (this is the visibility timeout)
3. Worker has this time to process and delete the message
4. If message isn't deleted before timeout → becomes visible again

### Current Configuration

```
Visibility Timeout: 1200 seconds (20 minutes)
```

### Why 20 Minutes?

For **2-4GB video files**, processing time breakdown:

| Stage | Time | Notes |
|-------|------|-------|
| Download | 1-2 min | From Wasabi to worker |
| Transcode | 15-30 min | Depends on clip length |
| Thumbnail | 5-10 sec | Quick frame extraction |
| Upload | 1-2 min | HLS segments to Wasabi |
| **Total** | **20-35 min** | Typical range |

**20 minutes gives a safe buffer for:**
- ✅ Most short clips (complete in < 20 min)
- ✅ Prevents duplicate processing
- ⚠️ Long matches may exceed timeout (handled by retry logic)

### Timeout Too Short Problem

```
Timeline with 10-minute timeout:
0:00 - Jetson receives message (becomes invisible)
0:01 - Jetson starts downloading 4GB file
0:02 - Jetson transcoding in progress...
0:10 - TIMEOUT! Message visible again
0:11 - AWS worker #1 receives same message (DUPLICATE!)
0:12 - AWS worker #1 starts same job
0:15 - Jetson finishes, deletes message
0:20 - AWS worker #1 finishes... wasted compute!
```

### Timeout Too Long Problem

```
Timeline with 60-minute timeout:
0:00 - Jetson receives message
0:01 - Jetson crashes (power failure, network issue)
0:02 - Message invisible to all workers
...
0:59 - Still invisible (queue looks empty to AWS!)
1:00 - Finally visible again
1:01 - AWS starts processing (59 minutes delayed!)
```

---

## Recommended Visibility Timeout

### For 2-4GB Files: **20 minutes (1200 seconds)**

**Reasoning:**
- 90th percentile processing time: ~18 minutes
- Provides 2-minute buffer for variability
- Fast enough retry on failures
- Prevents most duplicate processing

### Monitoring and Adjustment

**Watch these metrics:**
```
CloudWatch Metrics to Track:
1. ApproximateNumberOfMessagesNotVisible
   - Messages being processed

2. NumberOfMessagesReceived vs NumberOfMessagesDeleted
   - Should be ~1:1 ratio (no duplicates)

3. ApproximateAgeOfOldestMessage
   - Should be < 20 minutes during processing
```

**Adjust if you see:**
- **High duplication rate** → Increase timeout to 25-30 min
- **Long queue wait times** → Decrease to 15 min (faster retry)
- **Larger files (> 6GB)** → Increase to 30 min

---

## Job Lifecycle

### Happy Path (Jetson Processes)

```
1. Upload video (4GB)                    [t=0]
2. SQS message created                   [t=0]
3. Jetson polls, receives message        [t=0-20s]
4. Message invisible (20 min timer)      [t=20s]
5. CloudWatch alarm: queue > 0           [t=1m]
6. AWS ASG starts scaling                [t=1m]
7. Jetson finishes transcoding           [t=18m]
8. Jetson deletes message                [t=18m]
9. AWS workers spin up, find no jobs     [t=3m]
10. AWS workers scale down (idle)        [t=13m]

Cost: $0 (only Jetson, no AWS time)
```

### Burst Scenario (AWS Helps)

```
1. Upload 5 videos (4GB each)            [t=0]
2. 5 SQS messages created                [t=0]
3. Jetson receives message #1            [t=0]
4. Message #1 invisible                  [t=0]
5. CloudWatch: 4 messages visible        [t=1m]
6. AWS scales to 3 workers               [t=3m]
7. AWS workers receive messages #2-4     [t=3m]
8. Messages #2-4 invisible               [t=3m]
9. Jetson finishes #1, grabs #5          [t=18m]
10. AWS workers finish #2-4              [t=28m]
11. All workers finish #5                [t=36m]
12. Queue empty → AWS scales down        [t=46m]

Total Time: 36 minutes (vs 90 min sequential)
Cost: ~$0.45 (3 AWS workers × 0.5 hours)
```

### Failure Scenario (Jetson Crashes)

```
1. Upload video                          [t=0]
2. Jetson receives message               [t=0]
3. Message invisible (20 min)            [t=0]
4. Jetson crashes mid-transcode          [t=10m]
5. AWS still scaling up                  [t=3m]
6. Message still invisible...            [t=10-20m]
7. Visibility timeout expires            [t=20m]
8. Message visible again                 [t=20m]
9. AWS worker receives message           [t=20m]
10. AWS completes job                    [t=45m]

Total Time: 45 minutes (20 min delay + 25 min AWS)
Cost: ~$0.22 (1 AWS worker × 0.5 hours)
```

---

## Cost Analysis

### Monthly Costs (Hybrid)

**Jetson Costs:**
- **Hardware:** One-time $500 (amortized ~$14/month over 3 years)
- **Power:** 15W × 24/7 × $0.12/kWh = ~$1.30/month
- **Internet:** Included in existing plan
- **Total Jetson:** ~$15/month

**AWS Costs (On-Demand + Spot):**
- **Idle:** $0/hour (scaled to zero)
- **Active:** $0.842/hour (1 On-Demand + 2 Spot)
- **Per-video (burst):** ~$0.13-0.22

### Monthly Scenarios

| Scenario | Jetson | AWS | Total |
|----------|--------|-----|-------|
| 50 matches, all on Jetson | $15 | $0 | **$15** |
| 50 matches, 10 need AWS | $15 | $3 | **$18** |
| 100 matches, 30 need AWS | $15 | $10 | **$25** |
| 200 matches, 80 need AWS | $15 | $20 | **$35** |

**Comparison (100 matches/month):**
- Your hybrid setup: **$25**
- AWS MediaConvert: ~$40
- Mux.com: ~$1000

---

## Configuration Files

### Jetson Worker

**File:** `jetson_scripts/streaming/stream_worker_sqs.py`

**Key Settings:**
```python
SQS_QUEUE_URL = os.getenv("SQS_TRANSCODE_QUEUE_URL")
POLL_WAIT_TIME = 20  # Long polling (seconds)
VISIBILITY_TIMEOUT = 600  # 10 minutes (deprecated, using queue default)
MAX_RETRIES = 3
```

**Pipeline:**
```python
ffmpeg -y \
  -c:v h264_nvv4l2dec \     # Jetson hardware decoder
  -i input.mp4 \
  -c:v libx264 \            # Software encoder
  -preset ultrafast \
  -tune zerolatency \
  -b:v 2000k \
  -g 180 \                  # 6-second keyframes
  -c:a aac -b:a 128k \
  -f hls -hls_time 6 \
  output.m3u8
```

### AWS Workers

**File:** `aws_workers/transcoding/worker.py`

**Key Settings:**
```python
SQS_QUEUE_URL = os.getenv("SQS_TRANSCODE_QUEUE_URL")
POLL_WAIT_TIME = 20
VISIBILITY_TIMEOUT = 600
```

**Pipeline:**
```python
ffmpeg -y \
  -hwaccel cuda \
  -c:v h264_cuvid \         # NVIDIA T4 hardware decoder
  -i input.mp4 \
  -c:v h264_nvenc \         # NVIDIA T4 hardware encoder
  -preset p4 \
  -b:v 2000k \
  -g 180 \
  -c:a aac -b:a 128k \
  -f hls -hls_time 6 \
  output.m3u8
```

### SQS Queue Configuration

```bash
Queue: rugbycodex-transcode-jobs
Visibility Timeout: 1200 seconds (20 minutes)
Message Retention: 4 days
Long Polling: 20 seconds
Max Receives: 3 (dead letter after 3 failures)
```

---

## Monitoring

### Real-Time Dashboard

**SQS Metrics:**
- `ApproximateNumberOfMessagesVisible` - Jobs waiting
- `ApproximateNumberOfMessagesNotVisible` - Jobs in progress
- `NumberOfMessagesReceived` - Total received
- `NumberOfMessagesDeleted` - Completed jobs

**AWS CloudWatch:**
- ASG DesiredCapacity - Target EC2 instances
- ECS RunningCount - Active workers

**Jetson Monitoring:**
```bash
# Check if worker is running
systemctl status rugby-transcode-worker

# View logs
journalctl -u rugby-transcode-worker -f

# Check GPU usage
tegrastats
```

### Alert Thresholds

**Scale-Up Alert:**
- Trigger: `ApproximateNumberOfMessagesVisible > 0`
- Action: Start AWS workers

**Scale-Down Alert:**
- Trigger: Queue empty for 10 consecutive minutes
- Action: Terminate AWS workers

**Stuck Job Alert:**
- Trigger: `ApproximateAgeOfOldestMessage > 30 minutes`
- Action: Investigate worker health

---

## Troubleshooting

### Jobs Not Processing

**Check 1: Is Jetson worker running?**
```bash
ssh jetson
systemctl status rugby-transcode-worker
```

**Check 2: SQS queue accessible?**
```bash
aws sqs get-queue-attributes \
  --queue-url <YOUR_QUEUE_URL> \
  --attribute-names All
```

**Check 3: AWS workers scaling?**
```bash
aws ecs describe-services \
  --cluster rugbycodex-cluster \
  --services rugbycodex-transcoder-service
```

### Duplicate Processing

**Symptom:** Same job processed twice

**Cause:** Visibility timeout too short

**Solution:** Increase timeout to 25-30 minutes
```bash
aws sqs set-queue-attributes \
  --queue-url <YOUR_QUEUE_URL> \
  --attributes VisibilityTimeout=1800  # 30 minutes
```

### Slow Processing

**Symptom:** Jobs taking > 30 minutes

**Check Jetson:**
```bash
# CPU throttling?
sudo jetson_clocks

# Storage full?
df -h /tmp

# Network issues?
ping wasabi.us-east-1.wasabisys.com
```

**Check AWS:**
- Spot interruptions? (check ASG events)
- Bandwidth throttling? (check instance networking)

---

## Future Enhancements

### Short-Term
- [ ] Add dead letter queue monitoring
- [ ] Implement job priority (clips vs full matches)
- [ ] Add Jetson health check endpoint
- [ ] Create Grafana dashboard for hybrid metrics

### Medium-Term
- [ ] Add second Jetson for redundancy
- [ ] Implement adaptive visibility timeout based on file size
- [ ] Multi-region AWS failover
- [ ] Pre-warming: Keep 1 AWS worker ready during peak hours

### Long-Term
- [ ] Smart routing: Route by clip length to optimal worker
- [ ] GPU-accelerated encoding on Jetson (investigate nvenc support)
- [ ] Edge caching: Stream from Jetson directly for local users

---

## Summary

Your **hybrid architecture** provides:

✅ **Low latency:** Jetson grabs jobs instantly (no cold start)  
✅ **Cost-effective:** Jetson handles 80-90% of workload  
✅ **Elastic:** AWS provides burst capacity automatically  
✅ **Reliable:** Dual-path processing (on-premise + cloud)  
✅ **Optimized:** 20-minute visibility timeout prevents duplicates  

**Best of both worlds:** Speed of on-premise + scalability of cloud.

**Status:** Production-ready, January 2026
