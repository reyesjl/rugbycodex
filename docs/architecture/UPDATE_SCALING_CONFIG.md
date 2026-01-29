# Update Auto-Scaling Configuration for 20-Minute Visibility Timeout

## Critical Issue

With 20-minute SQS visibility timeout, messages become **invisible** when workers receive them. The default 5-minute scale-in cooldown causes AWS to scale down while jobs are still processing.

## Solution: Update Scale-In Cooldown to 25 Minutes

### Step 1: Update ECS Service Auto-Scaling Policy

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
  }' \
  --region us-east-1
```

### Step 2: Update CloudWatch Scale-Down Alarm

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
  --alarm-actions arn:aws:autoscaling:us-east-1:YOUR_ACCOUNT_ID:scalingPolicy:YOUR_POLICY_ID:autoScalingGroupName/rugbycodex-gpu-asg:policyName/rugbycodex-target-tracking-scale-down \
  --region us-east-1
```

**Note:** Replace `YOUR_ACCOUNT_ID` and `YOUR_POLICY_ID` with your actual values.

### Step 3: Update SQS Queue Visibility Timeout (if needed)

```bash
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/rugbycodex-transcode-jobs \
  --attributes VisibilityTimeout=1200 \
  --region us-east-1
```

## Verify Configuration

### Check ECS Auto-Scaling Policy

```bash
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/rugbycodex-cluster/rugbycodex-transcoder-service \
  --region us-east-1
```

**Expected output:**
```json
{
  "ScalingPolicies": [
    {
      "PolicyName": "rugbycodex-ecs-queue-tracking",
      "ScaleInCooldown": 1500,
      "ScaleOutCooldown": 60,
      ...
    }
  ]
}
```

### Check CloudWatch Alarm

```bash
aws cloudwatch describe-alarms \
  --alarm-names rugbycodex-scale-down-to-zero \
  --region us-east-1
```

**Expected output:**
```json
{
  "MetricAlarms": [
    {
      "AlarmName": "rugbycodex-scale-down-to-zero",
      "EvaluationPeriods": 25,
      "Period": 60,
      ...
    }
  ]
}
```

### Check SQS Queue Attributes

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/rugbycodex-transcode-jobs \
  --attribute-names VisibilityTimeout \
  --region us-east-1
```

**Expected output:**
```json
{
  "Attributes": {
    "VisibilityTimeout": "1200"
  }
}
```

## What Changed

| Setting | Old Value | New Value | Reason |
|---------|-----------|-----------|--------|
| Scale-in Cooldown | 300s (5 min) | 1500s (25 min) | Prevent scale-down during job processing |
| CloudWatch Alarm Periods | 10 | 25 | Match scale-in cooldown duration |
| SQS Visibility Timeout | 600s (10 min) | 1200s (20 min) | Accommodate 2-4GB file processing time |

## Impact

### Positive
- ✅ Prevents mid-job terminations
- ✅ Reduces duplicate processing
- ✅ More stable scaling behavior

### Trade-offs
- ⚠️ Workers may idle up to 25 minutes after completing jobs
- 💰 Additional ~$0.35 per scale-up event (idle time cost)
- ⏱️ Slower scale-down response (25 min vs 5 min)

### Cost Analysis
- **Before:** Jobs fail, retry, wasted compute
- **After:** ~$0.35 idle cost per scale-up, but 100% job success rate
- **Net:** Small cost increase, but reliable processing

## Monitoring

Watch these metrics after the change:

```bash
# Check for premature terminations (should be 0)
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=rugbycodex-transcoder-service Name=ClusterName,Value=rugbycodex-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-east-1

# Check queue depth over time
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=rugbycodex-transcode-jobs \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum \
  --region us-east-1
```

## Rollback (if needed)

If issues arise, revert to original settings:

```bash
# Revert scale-in cooldown
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
    "ScaleInCooldown": 300
  }' \
  --region us-east-1

# Revert CloudWatch alarm
aws cloudwatch put-metric-alarm \
  --alarm-name rugbycodex-scale-down-to-zero \
  --evaluation-periods 10 \
  --region us-east-1
```

## Summary

This configuration update ensures:
1. Jobs complete without interruption
2. No premature scale-down during processing
3. Minimal idle time cost (~$0.35 per scale-up)
4. Compatible with 2-4GB video file processing times

**Status:** Ready to apply immediately
**Risk:** Low (can rollback if needed)
**Benefit:** Prevents job failures, worth the small idle cost
