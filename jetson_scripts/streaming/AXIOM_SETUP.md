# Axiom Logging Setup for Jetson Worker

## Installation

```bash
# On Jetson device
pip3 install axiom-py
```

## Configuration

Add to your `.env` file:

```bash
# Axiom Logging
AXIOM_API_TOKEN=<YOUR_AXIOM_API_TOKEN>
AXIOM_DATASET=rugbycodex-logs
AXIOM_ENVIRONMENT=production
```

## Verification

After installing and configuring, restart the worker:

```bash
cd ~/projects/rugbycodex/jetson_scripts/streaming
python3 stream_worker_sqs.py
```

You should see:
```
✅ Axiom logging enabled: dataset=rugbycodex-logs, env=production
```

If Axiom is not installed or token is missing, you'll see a warning and logs will only go to stdout.

## Query Examples

### Average Processing Time by Worker Type

```
['rugbycodex-logs']
| where event_type == "job_success"
| summarize 
    avg_duration_min=avg(total_duration_ms)/60000,
    p50_duration_min=percentile(total_duration_ms, 50)/60000,
    p95_duration_min=percentile(total_duration_ms, 95)/60000,
    job_count=count()
  by worker_type
```

### File Size vs Processing Time

```
['rugbycodex-logs']
| where event_type == "job_success"
| extend duration_min = total_duration_ms / 60000
| project file_size_mb, duration_min, worker_type
| summarize 
    avg_duration=avg(duration_min),
    job_count=count()
  by bin(file_size_mb, 500), worker_type
```

### Jobs Per Day

```
['rugbycodex-logs']
| where event_type == "job_success"
| extend day = bin(_time, 1d)
| summarize count() by day, worker_type
| order by day desc
```

### Processing Stages Timeline

```
['rugbycodex-logs']
| where job_id == "<YOUR_JOB_ID>"
| where event_type in ("job_start", "stage_start", "stage_complete", "job_success")
| project _time, event_type, stage, duration_ms, worker_type
| order by _time asc
```

### Success Rate

```
['rugbycodex-logs']
| where event_type in ("job_success", "job_failure")
| summarize 
    total=count(),
    succeeded=countif(event_type == "job_success"),
    failed=countif(event_type == "job_failure")
  by worker_type
| extend success_rate = (succeeded * 100.0) / total
```

### Cost Analysis (Estimated)

```
['rugbycodex-logs']
| where event_type == "job_success" and worker_type == "aws"
| extend duration_hours = total_duration_ms / 3600000
| extend cost_per_job = duration_hours * 0.53  // $0.53/hour for g4dn.xlarge
| summarize 
    total_jobs=count(),
    total_hours=sum(duration_hours),
    total_cost=sum(cost_per_job),
    avg_cost_per_job=avg(cost_per_job)
```

## Dashboard Widgets

Create a dashboard with:

1. **KPI Tiles:**
   - Total jobs today (by worker)
   - Avg processing time (by worker)
   - Success rate %
   - Total cost today (AWS only)

2. **Time Series:**
   - Jobs processed over time (stacked by worker)
   - Processing time trend

3. **Distributions:**
   - File size histogram
   - Processing time histogram

4. **Scatter Plot:**
   - File size (x) vs Duration (y) colored by worker_type

## Troubleshooting

### Logs not appearing in Axiom

1. Check token is correct:
   ```bash
   echo $AXIOM_API_TOKEN
   ```

2. Test API access:
   ```bash
   curl -H "Authorization: Bearer $AXIOM_API_TOKEN" \
        https://api.axiom.co/v1/datasets/rugbycodex-logs
   ```

3. Check worker logs for errors:
   ```bash
   journalctl -u rugbycodex-worker -f | grep -i axiom
   ```

### Worker doesn't start

If `axiom-py` not found:
```bash
# Check installation
pip3 list | grep axiom

# Reinstall if needed
pip3 install --upgrade axiom-py
```

## Migration Notes

- Existing logs in stdout are unaffected
- Axiom integration is additive (doesn't replace stdout)
- If Axiom fails, logs still go to stdout
- No breaking changes to existing code
