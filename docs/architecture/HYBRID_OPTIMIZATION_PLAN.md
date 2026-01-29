# Current AWS Configuration Analysis & Hybrid Optimization Plan

## 📊 Your Actual Configuration

### ECS Service Auto-Scaling
- **Type:** Target Tracking Scaling (NOT step scaling for ECS tasks)
- **Min/Max Capacity:** 0-3 tasks
- **Metric:** `ApproximateNumberOfMessagesVisible` (SQS)
- **Target Value:** 1.0 (1 task per visible message)
- **Scale-Out Cooldown:** 60 seconds ✅
- **Scale-In Cooldown:** 300 seconds (5 minutes) ⚠️ **PROBLEM**

### ASG (EC2 Instances) Scaling
- **Type:** Step Scaling ✅ (Good!)
- **Min/Max Capacity:** 0-3 instances
- **Instance Mix:** 1 On-Demand base + Spot above
- **Default Cooldown:** 300 seconds (5 minutes)

**Step Scaling Policy:** `rugbycodex-step-scale-on-queue-depth`
```
Queue Depth → Desired Capacity
0           → 0 instances
1           → 1 instance
2+          → 2 instances
```

⚠️ **Issue:** Max 2 instances via step scaling, but ASG max is 3.

**Scale-Down Policy:** `rugbycodex-scale-to-zero`
- Triggers when queue empty for 10 minutes (10 periods × 60s)
- Sets ASG capacity to exactly 0

### SQS Queue
- **Visibility Timeout:** 600 seconds (10 minutes) ⚠️ **TOO SHORT**
- **Message Retention:** 4 days ✅
- **Dead Letter Queue:** After 3 retries ✅
- **Long Polling:** 0 seconds ⚠️ (should be 20)

---

## 🚨 Critical Issues Identified

### Issue 1: Visibility Timeout Too Short (10 minutes)
**Problem:** 2-4GB videos take 20-35 minutes to process
**Result:**
- Message becomes visible again after 10 min
- AWS workers grab the same job (duplicate processing)
- Jetson finishes, tries to delete → FAILS (receipt expired)

### Issue 2: ECS Scale-In Cooldown Too Short (5 minutes)
**Problem:** With 10-min visibility timeout:
```
t=0:   Worker receives message (invisible for 10 min)
t=0:   CloudWatch sees 0 visible messages
t=5:   Scale-in cooldown expires
t=5:   ECS tries to scale down → TERMINATES WORKING TASKS! ❌
```

### Issue 3: Step Scaling Maxes at 2 Instances
**Problem:** Your ASG allows 3 instances, but step scaling policy only goes to 2
**Result:** If 3+ videos arrive, 3rd worker never spins up

### Issue 4: No Long Polling on SQS
**Problem:** `ReceiveMessageWaitTimeSeconds: 0`
**Result:** Workers poll instantly, more API calls, higher costs

---

## ✅ Recommended Configuration Changes

### Priority 1: Fix Visibility Timeout (CRITICAL)

```bash
# Update SQS visibility timeout to 20 minutes
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/480421269987/rugbycodex-transcode-jobs \
  --attributes VisibilityTimeout=1200 \
  --region us-east-1
```

**Why:** Covers typical 20-35 min processing time for 2-4GB files.

### Priority 2: Fix ECS Scale-In Cooldown (CRITICAL)

```bash
# Update ECS service scale-in cooldown to 25 minutes
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
      "Dimensions": [{"Name": "QueueName", "Value": "rugbycodex-transcode-jobs"}],
      "Statistic": "Average"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 1500
  }' \
  --region us-east-1
```

**Why:** Must be longer than visibility timeout to prevent mid-job terminations.

### Priority 3: Update ASG Step Scaling to Support 3 Workers

```bash
# Update step scaling policy to scale to 3 instances
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name rugbycodex-gpu-asg \
  --policy-name rugbycodex-step-scale-on-queue-depth \
  --policy-type StepScaling \
  --adjustment-type ExactCapacity \
  --metric-aggregation-type Maximum \
  --step-adjustments \
    MetricIntervalUpperBound=1.0,ScalingAdjustment=0 \
    MetricIntervalLowerBound=1.0,MetricIntervalUpperBound=2.0,ScalingAdjustment=1 \
    MetricIntervalLowerBound=2.0,MetricIntervalUpperBound=3.0,ScalingAdjustment=2 \
    MetricIntervalLowerBound=3.0,ScalingAdjustment=3 \
  --region us-east-1
```

**New step configuration:**
```
Queue Depth → Desired Capacity
0           → 0 instances
1           → 1 instance
2           → 2 instances
3+          → 3 instances
```

### Priority 4: Update Scale-Down Alarm (Align with cooldown)

```bash
# Update scale-down alarm to 25 minutes
aws cloudwatch put-metric-alarm \
  --alarm-name rugbycodex-scale-down-to-zero \
  --alarm-description "Scale down to 0 when queue empty for 25 minutes" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Maximum \
  --period 60 \
  --evaluation-periods 25 \
  --threshold 0 \
  --comparison-operator LessThanOrEqualToThreshold \
  --dimensions Name=QueueName,Value=rugbycodex-transcode-jobs \
  --alarm-actions arn:aws:autoscaling:us-east-1:480421269987:scalingPolicy:c8256a6a-15d9-4d48-a83c-d4d34f571f6c:autoScalingGroupName/rugbycodex-gpu-asg:policyName/rugbycodex-scale-to-zero \
  --region us-east-1
```

**Why:** Match the 25-minute scale-in cooldown.

### Priority 5: Enable Long Polling (Optimization)

```bash
# Enable 20-second long polling
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/480421269987/rugbycodex-transcode-jobs \
  --attributes ReceiveMessageWaitTimeSeconds=20 \
  --region us-east-1
```

**Why:** Reduces empty responses, lower API costs, slightly better latency.

---

## 🎯 How Your Hybrid System Will Work

### Architecture Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Upload to Wasabi                      │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
                   ┌──────────────┐
                   │  SQS Queue   │
                   │ (Vis: 20min) │
                   └──────┬───────┘
                          │
          ┌───────────────┴──────────────┐
          │                              │
          ▼                              ▼
    ┌──────────┐                  ┌─────────────┐
    │  Jetson  │                  │ CloudWatch  │
    │ (Always) │                  │   Alarm     │
    └────┬─────┘                  └──────┬──────┘
         │                               │
         │ Polls every 20s               │ Queue > 0
         │ Grabs jobs first              │
         │                               ▼
         │                        ┌────────────┐
         │                        │ ASG Scales │
         │                        │ (Step)     │
         │                        └──────┬─────┘
         │                               │
         │                               ▼
         │                        ┌────────────┐
         │                        │ ECS Scales │
         │                        │ (Target)   │
         │                        └──────┬─────┘
         │                               │
         │                               ▼
         │                        ┌────────────┐
         │                        │ AWS Workers│
         │                        │  (0-3)     │
         └────────────────────────┴──────┬─────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │ Process Job │
                                  │ Delete Msg  │
                                  └─────────────┘
```

### Scenario Breakdown

#### Scenario 1: Single Short Video (60MB, 2 min)
```
t=0:00  Upload → 1 message in SQS
t=0:05  Jetson polls, receives (invisible 20 min)
t=0:05  CloudWatch: 0 visible (Jetson has it)
t=0:06  Jetson finishes, deletes message
t=0:06  Queue empty

AWS: Never scales up (no visible messages)
Cost: $0
```

#### Scenario 2: Single Long Video (4GB, 2 hours)
```
t=0:00  Upload → 1 message
t=0:05  Jetson receives (invisible 20 min)
t=1:00  CloudWatch: 0 visible
t=3:00  ASG scales to 0 (no visible messages)
t=20:00 Visibility timeout! Message visible again
t=20:05 Jetson still processing...
t=21:00 CloudWatch: 1 visible message
t=23:00 ASG scales to 1 instance
t=25:00 ECS scales to 1 task
t=25:05 AWS worker receives message (invisible 20 min)
t=35:00 Jetson finishes, tries to delete → FAILS
t=50:00 AWS worker finishes, deletes → SUCCESS
t=75:00 Scale-in cooldown + empty queue → scale to 0

Jetson: Wasted 35 min work (free)
AWS: 1 worker × 0.8 hr = $0.42
Total: $0.42 (acceptable - backup worked)
```

#### Scenario 3: Three Videos Arrive Together (4GB each)
```
t=0:00  3 uploads → 3 visible messages
t=0:05  Jetson receives #1 (invisible)
t=0:05  CloudWatch: 2 visible
t=2:00  ASG scales to 2 instances
t=4:00  ECS scales to 2 tasks
t=4:05  AWS #1 receives #2 (invisible)
t=4:05  AWS #2 receives #3 (invisible)
t=4:05  CloudWatch: 0 visible
t=29:05 Scale-in cooldown expires
t=29:05 All workers done, scale to 0
t=35:00 Jetson finishes #1

Jetson: 1 video
AWS: 2 workers × 0.5 hr = $0.53
Total: $0.53 (parallel processing ✅)
```

#### Scenario 4: Six Videos Arrive (4GB each)
```
t=0:00  6 uploads → 6 visible
t=0:05  Jetson receives #1 (invisible)
t=0:05  CloudWatch: 5 visible
t=2:00  ASG scales to 3 instances (max)
t=4:00  ECS scales to 3 tasks
t=4:05  AWS workers receive #2, #3, #4 (invisible)
t=4:05  CloudWatch: 2 visible remaining
t=29:05 AWS workers finish first batch
t=29:05 AWS #1 receives #5 (invisible)
t=29:05 AWS #2 receives #6 (invisible)
t=29:05 CloudWatch: 0 visible
t=35:00 Jetson finishes #1
t=54:05 AWS finishes #5, #6
t=79:05 Scale-in cooldown → scale to 0

Jetson: 1 video
AWS: 3 workers × 1.3 hr = $3.28
Total: $3.28 (processed 6 videos in 54 min vs 3.5 hrs sequential)
```

---

## 💰 Cost Analysis

### With Recommended Settings

| Scenario | Videos | Jetson | AWS Workers | AWS Hours | Cost |
|----------|--------|--------|-------------|-----------|------|
| Single short | 1 | ✓ | 0 | 0 | $0 |
| Single long | 1 | ✓ (dup) | 1 | 0.8 | $0.42 |
| 3 videos | 3 | 1 | 2 | 1.0 | $0.53 |
| 6 videos | 6 | 1 | 3 | 3.9 | $3.28 |
| 12 videos (1/hr) | 12 | 4 | 3 | 6.0 | $5.05 |

### Monthly Estimates

**50 matches/month (mixed sizes):**
- Jetson handles: ~42 matches (84%)
- AWS handles: ~8 matches (16%)
- AWS scale-up events: ~4-6 times
- **AWS cost: $4-7/month**
- **Jetson cost: $1.30/month**
- **Total: $5-8/month**

**vs AWS-only: $27/month** → **75% savings**

### Idle Time Cost

With 25-minute scale-in cooldown:
- Each scale-up event → 25 min minimum
- If job finishes in 10 min → 15 min idle
- Idle cost: ~$0.35 per scale-up
- Acceptable trade-off for reliability

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Do Now)

- [ ] **Update SQS visibility timeout to 20 minutes**
  ```bash
  aws sqs set-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/480421269987/rugbycodex-transcode-jobs --attributes VisibilityTimeout=1200 --region us-east-1
  ```

- [ ] **Update ECS scale-in cooldown to 25 minutes**
  ```bash
  # See Priority 2 command above
  ```

- [ ] **Update ASG step scaling to support 3 instances**
  ```bash
  # See Priority 3 command above
  ```

- [ ] **Update CloudWatch alarm to 25 periods**
  ```bash
  # See Priority 4 command above
  ```

### Phase 2: Optimizations (Do Next)

- [ ] **Enable long polling on SQS**
  ```bash
  # See Priority 5 command above
  ```

- [ ] **Update Jetson worker code** (already done in stream_worker_sqs.py)
  - Uses 20-second long polling
  - Properly handles visibility timeout

- [ ] **Verify AWS worker code** (aws_workers/transcoding/worker.py)
  - Check VISIBILITY_TIMEOUT constant
  - Should match SQS queue setting

### Phase 3: Monitoring (After Changes)

- [ ] **Test with single video upload**
  - Verify Jetson grabs it first
  - Verify AWS doesn't scale up

- [ ] **Test with 3 videos**
  - Verify AWS scales to 2 workers
  - Verify parallel processing
  - Verify scale-down after 25 min

- [ ] **Monitor for 1 week**
  - Watch for duplicate processing (should be rare)
  - Watch for mid-job terminations (should be zero)
  - Check idle time costs

- [ ] **Tune if needed**
  - If many duplicates → increase visibility timeout to 25 min
  - If excessive idle time → decrease scale-in cooldown to 20 min

---

## 🎯 Expected Behavior After Changes

### Scale-Up Behavior
1. Videos uploaded → messages in SQS
2. Jetson grabs first message immediately (no delay)
3. CloudWatch sees remaining visible messages
4. If ≥ 1 visible message for 1 minute → ASG scales EC2 instances
5. Instances launch → ECS scales tasks (~3 min total)
6. AWS workers poll SQS, receive messages (become invisible)

### Processing Behavior
1. Workers process jobs (20-35 min typical)
2. Messages invisible during processing
3. Workers finish, delete messages
4. Queue shows 0 visible messages

### Scale-Down Behavior
1. Queue empty (0 visible messages)
2. ECS waits 25 minutes (scale-in cooldown)
3. After 25 min + jobs complete → ECS scales tasks to 0
4. ASG waits for alarm (25 × 60s = 25 min)
5. After 25 min empty → ASG scales instances to 0

### Race Conditions (Acceptable)
- Long jobs (> 20 min) may trigger duplicate processing
- AWS acts as backup if Jetson crashes
- Small cost penalty for reliability

---

## ⚠️ Important Notes

### What Won't Change
- **Jetson priority:** Jetson still grabs jobs first (always polling)
- **AWS burst capacity:** AWS only scales when Jetson busy
- **Cost model:** Still 80%+ cost savings vs AWS-only

### What Will Improve
- ✅ No more mid-job terminations
- ✅ Fewer duplicate jobs
- ✅ More predictable scaling
- ✅ Better support for 2-4GB files

### Trade-offs
- ⚠️ Workers idle up to 25 min after completing jobs
- ⚠️ Long videos (> 20 min) may still get duplicate processing
- ⚠️ Slightly higher AWS costs (~$0.35 per scale-up event)

---

## 🚀 Summary

Your current setup has **step scaling for ASG** (good!) but **target tracking for ECS** with settings that don't match your 2-4GB video processing times.

**Key Changes Needed:**
1. ⚠️ **SQS visibility:** 10 min → 20 min
2. ⚠️ **ECS scale-in cooldown:** 5 min → 25 min
3. ⚠️ **ASG step scaling:** Max 2 → Max 3 instances
4. ⚠️ **CloudWatch alarm:** 10 periods → 25 periods
5. ✅ **SQS long polling:** 0s → 20s

**Expected Results:**
- Reliable processing (no mid-job kills)
- Jetson handles 80-85% of workload
- AWS provides burst capacity
- Cost: $5-8/month (vs $27 AWS-only)

**Next Step:** Run the Priority 1-4 commands above to fix the critical issues.
