# Hybrid Transcoding Scaling Scenarios & Cost Optimization

## Current Configuration

### Visibility Timeout: 20 minutes (1200 seconds)

### Auto-Scaling Policy
- **Metric:** `ApproximateNumberOfMessagesVisible`
- **Target:** 1.0 (1 task per visible message)
- **Scale-out cooldown:** 60 seconds
- **Scale-in cooldown:** 300 seconds (5 minutes)

### ⚠️ Critical Issue with Current Setup

**Problem:** When AWS workers receive messages, they become **invisible** for 20 minutes. The auto-scaling policy only looks at **visible** messages, so:

```
1. 3 videos uploaded → 3 visible messages
2. AWS scales to 3 workers
3. Workers receive messages → 0 visible messages (all invisible for 20 min)
4. Auto-scaling sees 0 messages → tries to scale down after 5 min cooldown
5. Workers still processing... but ASG wants to terminate them!
```

**Result:** Instances might be terminated mid-job, wasting compute and causing job failures.

---

## Solution: Prevent Premature Scale-Down

### Option 1: Increase Scale-In Cooldown (RECOMMENDED)

Change scale-in cooldown to **25 minutes** (longer than visibility timeout):

```bash
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/rugbycodex-cluster/rugbycodex-transcoder-service \
  --policy-name rugbycodex-ecs-queue-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 1.0,
    "CustomizedMetricSpecification": {
      "MetricName": "ApproximateNumberOfMessagesVisible",
      "Namespace": "AWS/SQS",
      "Dimensions": [
        {
          "Name": "QueueName",
          "Value": "rugbycodex-transcode-jobs"
        }
      ],
      "Statistic": "Average"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 1500
  }'
```

**Why this works:**
- Messages invisible for 20 minutes
- Workers process for ~20-30 minutes
- Scale-in waits 25 minutes before acting
- By then, workers have finished and deleted messages

### Option 2: Use Task Protection (ALTERNATIVE)

Enable ECS task scale-in protection during processing:

```python
# In worker code, after receiving message:
ecs.update_task_protection(
    cluster='rugbycodex-cluster',
    tasks=[task_arn],
    protectionEnabled=True
)

# Before deleting message:
ecs.update_task_protection(
    cluster='rugbycodex-cluster',
    tasks=[task_arn],
    protectionEnabled=False
)
```

**Pros:** More precise (protects exactly during processing)  
**Cons:** Requires code changes, more complex

---

## Recommended Configuration

```yaml
SQS Queue:
  VisibilityTimeout: 1200s (20 min)
  
ECS Auto-Scaling:
  ScaleOutCooldown: 60s (1 min)
  ScaleInCooldown: 1500s (25 min)  # ⚠️ UPDATE THIS
  TargetValue: 1.0
  
CloudWatch Scale-Down Alarm:
  Period: 60s
  EvaluationPeriods: 25  # 25 minutes total
  Threshold: 0 messages
```

---

## Scenario Analysis

### Assumptions
- **Jetson:** Always running, polls every 20s, processes ~35 min per 4GB video
- **AWS Worker:** Processes ~25 min per 4GB video (faster GPU)
- **Visibility Timeout:** 20 minutes
- **Scale-In Cooldown:** 25 minutes (recommended)

---

### Scenario 1: Single Short Clip (60MB, 2 min duration)

**Upload:** 1 video

**Timeline:**
```
t=0:00  - Upload complete, message in SQS
t=0:05  - Jetson polls, receives message (invisible)
t=0:05  - CloudWatch sees 0 visible messages
t=0:06  - Jetson transcodes (fast, 45 seconds)
t=0:06  - Jetson deletes message
t=0:06  - Queue empty

AWS Workers: Never started (no visible messages during cold start window)
```

**Cost:**
- Jetson: $0 (already running)
- AWS: $0 (never started)
- **Total: $0**

---

### Scenario 2: Single Long Match (4GB, 2 hours)

**Upload:** 1 video

**Timeline:**
```
t=0:00  - Upload complete, 1 visible message
t=0:05  - Jetson receives message (invisible for 20 min)
t=1:00  - CloudWatch alarm: 0 visible messages (Jetson has it)
t=3:00  - AWS worker starts (cold start delay)
t=3:05  - AWS polls, finds 0 messages (Jetson still has it invisible)
t=20:00 - Visibility timeout expires (Jetson still processing)
t=20:00 - Message visible again
t=20:05 - AWS worker receives message (NOW invisible to AWS)
t=25:00 - Scale-in cooldown expired, but 1 message still processing
t=35:00 - Jetson finishes, tries to delete (FAILS - receipt expired)
t=45:00 - AWS finishes, deletes successfully
t=70:00 - Scale-in cooldown + processing time → AWS scales down
```

**Cost:**
- Jetson: $0 (wasted work, but free)
- AWS: 1 worker × 1.2 hours = $0.63 (On-Demand)
- **Total: $0.63** (duplicate work happened)

**Optimization:** This is acceptable - job completes, AWS acts as backup.

---

### Scenario 3: Three Videos Arrive Together (4GB each)

**Upload:** 3 videos at once

**Timeline:**
```
t=0:00  - 3 videos uploaded, 3 visible messages
t=0:05  - Jetson receives message #1 (invisible)
t=0:05  - CloudWatch: 2 visible messages
t=1:00  - CloudWatch alarm triggers scale-up
t=3:00  - AWS workers scale to 2 (target: 2 tasks for 2 messages)
t=3:05  - AWS worker #1 receives message #2 (invisible)
t=3:05  - AWS worker #2 receives message #3 (invisible)
t=3:05  - CloudWatch: 0 visible messages
t=3:05  - All workers processing...
t=28:05 - Scale-in cooldown (25 min) expires
t=28:05 - CloudWatch checks: 0 visible, 0 processing (all done)
t=28:05 - AWS scales to 0
t=35:00 - Jetson finishes #1
t=28:00 - AWS #1 finishes #2
t=28:00 - AWS #2 finishes #3
```

**Cost:**
- Jetson: $0
- AWS: 2 workers × 0.5 hours = $0.63 (1 On-Demand + 1 Spot)
- **Total: $0.63**

**Result:** ✅ Optimal - Jetson takes 1, AWS takes 2, parallel processing

---

### Scenario 4: Six Videos Arrive Together (4GB each)

**Upload:** 6 videos

**Timeline:**
```
t=0:00  - 6 videos uploaded, 6 visible messages
t=0:05  - Jetson receives #1 (invisible)
t=0:05  - CloudWatch: 5 visible
t=1:00  - CloudWatch triggers scale-up
t=3:00  - AWS scales to 3 (max capacity)
t=3:05  - AWS #1 receives #2 (invisible)
t=3:05  - AWS #2 receives #3 (invisible)
t=3:05  - AWS #3 receives #4 (invisible)
t=3:05  - CloudWatch: 2 visible messages remaining
t=28:00 - AWS workers finish first batch
t=28:05 - AWS #1 polls, receives #5 (invisible)
t=28:05 - AWS #2 polls, receives #6 (invisible)
t=28:05 - CloudWatch: 0 visible
t=35:00 - Jetson finishes #1
t=53:00 - AWS #1, #2 finish #5, #6
t=53:00 - All done, workers scale down
```

**Cost:**
- Jetson: $0
- AWS: 3 workers × 0.9 hours = $2.27 (1 On-Demand + 2 Spot)
- **Total: $2.27**

**Processing Time:** 53 minutes total (vs 3.5 hours sequential)

---

### Scenario 5: Video Every 5 Minutes for 1 Hour (12 videos)

**Upload:** 1 video every 5 minutes × 12

**Timeline:**
```
t=0:00  - Video #1 uploaded
t=0:05  - Jetson receives #1
t=5:00  - Video #2 uploaded (Jetson busy)
t=5:00  - CloudWatch: 1 visible message
t=6:00  - AWS scales to 1 worker
t=8:00  - AWS #1 receives #2
t=10:00 - Video #3 uploaded (both busy)
t=10:00 - CloudWatch: 1 visible
t=11:00 - AWS scales to 2 workers
t=13:00 - AWS #2 receives #3
t=15:00 - Video #4 uploaded (all busy)
t=15:00 - CloudWatch: 1 visible
t=16:00 - AWS scales to 3 workers (max)
...continues...
t=60:00 - Last video uploaded
t=85:00 - All workers finish
t=110:00 - Scale-in cooldown + processing → AWS scales down
```

**Cost:**
- Jetson: $0 (handles ~4-5 videos)
- AWS: ~3 workers × 1.8 hours = $4.55
- **Total: $4.55**

**Result:** AWS stays on for extended period (multiple batches)

---

## Cost Optimization Strategies

### 1. Adjust Scale-In Cooldown ⚠️ CRITICAL

**Current Issue:** 5-minute cooldown causes premature scale-down.

**Fix:** Set to 25 minutes (1500 seconds):
```bash
aws application-autoscaling put-scaling-policy \
  --policy-name rugbycodex-ecs-queue-tracking \
  --scale-in-cooldown 1500
```

**Impact:**
- ✅ Prevents mid-job terminations
- ⚠️ Workers stay idle for up to 25 min after job completes
- 💰 Extra cost: ~$0.35 per scale-up event (25 min idle × $0.842/hour)

### 2. Use Step Scaling Instead of Target Tracking

**Problem:** Target tracking reacts slowly to queue depth changes.

**Solution:** Step scaling for faster response:
```yaml
Step Scaling:
  - QueueDepth: 0       → DesiredCount: 0
  - QueueDepth: 1       → DesiredCount: 1
  - QueueDepth: 2       → DesiredCount: 2
  - QueueDepth: 3+      → DesiredCount: 3
  
ScaleInCooldown: 1500s (25 min)
ScaleOutCooldown: 60s
```

**Benefit:** More predictable scaling based on actual queue depth.

### 3. Add CloudWatch Alarm for In-Flight Messages

**Monitor:** `ApproximateNumberOfMessagesNotVisible`

**Purpose:** Know when workers are actually processing:
```yaml
Alarm: InFlightMessages
  Metric: ApproximateNumberOfMessagesNotVisible
  Threshold: > 0
  Action: Prevent scale-down (custom logic)
```

**Benefit:** Avoid scaling down while messages are being processed.

### 4. Reduce Visibility Timeout for Short Clips

**Problem:** 20-minute timeout is overkill for 60MB clips (finish in 1 min).

**Solution:** Use SQS message attributes:
```python
# In uploader, estimate processing time:
if file_size < 100_000_000:  # < 100MB
    visibility_timeout = 300  # 5 minutes
else:
    visibility_timeout = 1200  # 20 minutes

sqs.send_message(
    QueueUrl=queue_url,
    MessageBody=json.dumps(job_data),
    MessageAttributes={
        'VisibilityTimeout': {
            'StringValue': str(visibility_timeout),
            'DataType': 'Number'
        }
    }
)
```

**Benefit:** Faster retries for short clips, less idle time.

### 5. Implement Job Stealing

**Concept:** If Jetson is slow, let AWS "steal" the job before timeout.

**Implementation:**
- Jetson sends heartbeat every 5 minutes to SQS (via ChangeMessageVisibility)
- If no heartbeat, assume Jetson is stuck
- AWS can receive the job earlier

**Code:**
```python
# In Jetson worker:
def process_with_heartbeat(receipt_handle):
    start_time = time.time()
    
    while processing:
        # Extend visibility every 5 minutes
        if time.time() - start_time > 300:
            sqs.change_message_visibility(
                QueueUrl=queue_url,
                ReceiptHandle=receipt_handle,
                VisibilityTimeout=1200  # Reset to 20 min
            )
            start_time = time.time()
```

**Benefit:** Prevents timeout on long jobs, allows faster failover on crashes.

---

## Recommended Configuration Changes

### Update ECS Auto-Scaling Policy

```bash
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/rugbycodex-cluster/rugbycodex-transcoder-service \
  --policy-name rugbycodex-ecs-queue-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 1.0,
    "CustomizedMetricSpecification": {
      "MetricName": "ApproximateNumberOfMessagesVisible",
      "Namespace": "AWS/SQS",
      "Dimensions": [
        {
          "Name": "QueueName",
          "Value": "rugbycodex-transcode-jobs"
        }
      ],
      "Statistic": "Average"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 1500
  }'
```

### Update CloudWatch Scale-Down Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name rugbycodex-scale-down-to-zero \
  --alarm-description "Scale ASG to zero when queue empty for 25 minutes" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 60 \
  --evaluation-periods 25 \
  --threshold 0 \
  --comparison-operator LessThanOrEqualToThreshold \
  --dimensions Name=QueueName,Value=rugbycodex-transcode-jobs \
  --alarm-actions arn:aws:autoscaling:us-east-1:YOUR_ACCOUNT:scalingPolicy:POLICY_ID
```

---

## Cost Analysis Summary

### With Recommended Settings (25-min scale-in cooldown)

| Scenario | Videos | Jetson | AWS Workers | AWS Hours | Cost |
|----------|--------|--------|-------------|-----------|------|
| Short clip | 1 | ✓ | 0 | 0 | $0 |
| Long match | 1 | ✓ (dup) | 1 | 1.2 | $0.63 |
| 3 videos | 3 | 1 | 2 | 1.0 | $0.53 |
| 6 videos | 6 | 1 | 3 | 2.7 | $2.27 |
| 12 videos (1/hour) | 12 | 4 | 3 | 5.4 | $4.55 |

**Monthly (50 matches, mixed sizes):**
- Jetson handles: ~40 matches (80%)
- AWS handles: ~10 matches (20%)
- AWS cost: ~$5-8/month
- **Total: $5-8/month** (vs $27/month AWS-only)

### Idle Time Cost (Trade-off)

**25-minute scale-in cooldown means:**
- Each AWS scale-up event → 25 min minimum runtime
- If job finishes in 5 min → 20 min idle
- Idle cost per scale-up: ~$0.35

**Mitigation:**
- Workers only scale when Jetson is busy
- Multiple jobs processed during single scale-up window
- Acceptable cost for preventing job failures

---

## Final Recommendations

### ✅ DO THIS NOW

1. **Update scale-in cooldown to 25 minutes**
   ```bash
   aws application-autoscaling put-scaling-policy \
     --scale-in-cooldown 1500
   ```

2. **Update CloudWatch alarm to 25 evaluation periods**
   ```bash
   aws cloudwatch put-metric-alarm \
     --evaluation-periods 25
   ```

3. **Monitor for 1 week:**
   - Check for premature terminations (job failures)
   - Check for excessive idle time (> 30 min)
   - Check for duplicate processing

### 🎯 OPTIMIZE LATER

4. **Implement heartbeat mechanism** (prevent long job timeouts)
5. **Add job size estimation** (dynamic visibility timeout)
6. **Consider step scaling** (faster, more predictable)

---

## Summary

**Key Issue:** 20-minute visibility timeout + 5-minute scale-in cooldown = premature terminations

**Solution:** Increase scale-in cooldown to 25 minutes

**Cost Impact:** 
- ✅ Prevents job failures (critical)
- ⚠️ Adds ~$0.35 idle cost per scale-up event
- 💰 Still 80% cheaper than AWS-only ($8/mo vs $27/mo for 50 matches)

**Result:** Stable, cost-effective hybrid system optimized for 2-4GB files.
