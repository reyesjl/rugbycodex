# Jetson Worker Setup

Edge computing workers running on NVIDIA Jetson Orin Nano for RugbyCodex video processing and storage management.

## Overview

This setup runs two independent systemd services on the Jetson device:

1. **Transcoding Worker** (`streaming/`) - Processes video transcode jobs from AWS SQS queue
2. **Cleanup Worker** (`cleanup/`) - Deletes old media files from Wasabi storage

Both workers share:
- Single `.env` configuration file (loaded via systemd)
- Shared utility modules (`utils/`)
- Supabase database for job coordination
- Wasabi S3 storage for media files
- Optional Axiom logging for observability

## Architecture Context

### RugbyCodex Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                          │
│ - Users upload videos                                       │
│ - View processed HLS streams                                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ Supabase (PostgreSQL + Storage + Auth)                     │
│ - media_assets table                                        │
│ - media_cleanup_jobs table                                  │
│ - transcode_jobs table                                      │
└────┬───────────────┬────────────────────────────────────────┘
     │               │
     │               │ Poll cleanup jobs
     │               │
┌────▼────────┐   ┌──▼──────────────────────────────────────┐
│ AWS SQS     │   │ Jetson Cleanup Worker                   │
│ Queue       │   │ - Runs every 6 hours                    │
└────┬────────┘   │ - Deletes media from Wasabi             │
     │            └─────────────────────────────────────────┘
     │
     │ Compete for jobs
     │
┌────▼─────────────────────────┐   ┌───────────────────────┐
│ AWS ECS Workers (Fargate)    │   │ Jetson Transcoding    │
│ - Auto-scaling 0-5 tasks     │◄──┤ Worker (THIS DEVICE)  │
│ - Burst capacity             │   │ - Always-on           │
│ - Software encoding          │   │ - HW decode + SW enc  │
└──────────────┬───────────────┘   └──────────┬────────────┘
               │                              │
               │                              │
┌──────────────▼──────────────────────────────▼────────────┐
│ Wasabi S3 Storage                                        │
│ - Raw videos: orgs/{org}/uploads/{id}/raw/               │
│ - HLS output: orgs/{org}/uploads/{id}/streaming/         │
└──────────────────────────────────────────────────────────┘
```

### Why Jetson?

**Transcoding Worker**:
- Always-on baseline capacity (no cold starts)
- Hardware-accelerated video decode
- Cost-effective for steady workload (~$10/month power)
- Competes with AWS ECS for jobs (SQS queue)

**Cleanup Worker**:
- Low-frequency background task (every 6 hours)
- Runs on existing hardware (no additional cost)
- Simple database polling (no complex orchestration)

---

## Services

### 1. Transcoding Worker

**Location**: `streaming/`  
**Service**: `rugbycodex-transcoder-sqs.service`  
**Purpose**: Convert raw videos to HLS format for streaming

**Key Features**:
- Polls AWS SQS queue for transcode jobs
- Downloads raw video from Wasabi
- Transcodes using FFmpeg (h264_nvv4l2dec hardware decode + libx264 software encode)
- Uploads HLS segments to Wasabi
- Updates Supabase database on completion
- Dynamic SQS visibility timeout with heartbeat system

**Processing Flow**:
```
1. Poll SQS queue (20 second wait)
2. Receive message → Calculate initial timeout based on file size
3. Start visibility heartbeat (extends timeout every 4 min)
4. Download raw video from Wasabi
5. Transcode to HLS using FFmpeg
6. Upload streaming files to Wasabi
7. Update media_assets table in Supabase
8. Delete SQS message
9. Stop heartbeat
```

**Performance**: Varies by video size and codec complexity

[Full Documentation](streaming/README.md)

---

### 2. Cleanup Worker

**Location**: `cleanup/`  
**Service**: `rugbycodex-cleanup.service`  
**Purpose**: Delete media files when users delete videos

> Note: This worker is now deprecated in favor of the Supabase `cleanup-media-assets` Edge Function + cron job.

**Key Features**:
- Polls `media_cleanup_jobs` table every 6 hours
- Deletes entire media folders from Wasabi (raw + streaming + thumbnails)
- Marks jobs as processed in database
- Continues on errors (logs and moves to next job)

**Processing Flow**:
```
1. Query media_cleanup_jobs WHERE processed_at IS NULL
2. For each job:
   - Extract folder prefix (remove last 2 path segments)
   - List all objects with prefix
   - Delete in batches (up to 1000 objects)
   - Mark job as processed
3. Sleep 6 hours
4. Repeat
```

**Poll Interval**: 6 hours (21600 seconds)

[Full Documentation](cleanup/README.md)

---

## Shared Utilities

**Location**: `utils/`

### observability.py
Structured logging with optional Axiom integration. Logs to stdout (captured by systemd journal) and optionally to Axiom cloud.

### visibility_heartbeat.py
SQS message visibility timeout manager. Extends timeout dynamically during long-running transcode jobs to prevent duplicate processing.

[Full Documentation](utils/README.md)

---

## Configuration

### Single .env File

Both workers share one `.env` file at the root of `jetson_scripts/`:

**Location**: `/home/scribe/rugbycodex/jetson_scripts/.env`

**Loaded by**: systemd `EnvironmentFile` directive in both service files

**Required Variables**:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AWS (for SQS)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...

# Wasabi Storage
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.us-east-1.wasabisys.com
WASABI_KEY=your_key
WASABI_SECRET=your_secret
BUCKET_NAME=rugbycodex-media

# Optional
VERBOSE_LOGGING=false
AXIOM_API_TOKEN=your_token
AXIOM_DATASET=rugbycodex-logs
AXIOM_ENVIRONMENT=jetson
```

[Full Environment Guide](ENV_GUIDE.md)

---

## Deployment

### Prerequisites

1. NVIDIA Jetson Orin Nano with Ubuntu
2. Python 3.8+
3. FFmpeg with nvv4l2dec support
4. systemd (for service management)

### Quick Deploy

```bash
# 1. Sync files from development machine
rsync -av --exclude='.env' --exclude='__pycache__' \
  jetson_scripts/ scribe@<JETSON_IP>:/home/scribe/rugbycodex/jetson_scripts/

# 2. SSH into Jetson
ssh scribe@<JETSON_IP>

# 3. Create .env file
cd /home/scribe/rugbycodex/jetson_scripts
nano .env
# (paste credentials)

# 4. Install Python dependencies
pip3 install -r requirements.txt

# 5. Install systemd services
sudo cp rugbycodex-transcoder-sqs.service /etc/systemd/system/
sudo cp rugbycodex-cleanup.service /etc/systemd/system/
sudo systemctl daemon-reload

# 6. Enable and start services
sudo systemctl enable rugbycodex-transcoder-sqs
sudo systemctl enable rugbycodex-cleanup
sudo systemctl start rugbycodex-transcoder-sqs
sudo systemctl start rugbycodex-cleanup

# 7. Verify running
sudo systemctl status rugbycodex-transcoder-sqs
sudo systemctl status rugbycodex-cleanup
```

[Full Deployment Guide](DEPLOYMENT.md)

---

## Service Management

### Status Checks

```bash
# Check if services are running
sudo systemctl status rugbycodex-transcoder-sqs
sudo systemctl status rugbycodex-cleanup

# Quick check both
sudo systemctl is-active rugbycodex-transcoder-sqs rugbycodex-cleanup
```

### View Logs

```bash
# Follow transcoding logs
sudo journalctl -u rugbycodex-transcoder-sqs -f

# Follow cleanup logs
sudo journalctl -u rugbycodex-cleanup -f

# All Jetson worker logs
sudo journalctl -u "rugbycodex-*" -f

# Last 100 lines
sudo journalctl -u rugbycodex-transcoder-sqs -n 100
```

### Restart Services

```bash
# Restart transcoding worker
sudo systemctl restart rugbycodex-transcoder-sqs

# Restart cleanup worker
sudo systemctl restart rugbycodex-cleanup

# Restart both
sudo systemctl restart rugbycodex-transcoder-sqs rugbycodex-cleanup
```

### Stop Services

```bash
# Stop transcoding worker
sudo systemctl stop rugbycodex-transcoder-sqs

# Stop cleanup worker
sudo systemctl stop rugbycodex-cleanup

# Disable auto-start on boot
sudo systemctl disable rugbycodex-transcoder-sqs
sudo systemctl disable rugbycodex-cleanup
```

---

## Monitoring

### Systemd Journal

Both workers log structured JSON to stdout, captured by systemd:

```bash
# Recent activity
sudo journalctl -u "rugbycodex-*" --since "1 hour ago"

# Errors only
sudo journalctl -u "rugbycodex-*" -p err

# Export to file
sudo journalctl -u rugbycodex-transcoder-sqs --since today > ~/logs.txt
```

### Axiom Dashboard (Optional)

If `AXIOM_API_TOKEN` configured, logs also sent to Axiom:

**Query all Jetson logs**:
```
['environment'] == 'jetson'
```

**Query by worker**:
```
['environment'] == 'jetson' and ['event_type'] starts-with 'transcode_'
['environment'] == 'jetson' and ['event_type'] starts-with 'cleanup_'
```

**Query errors**:
```
['environment'] == 'jetson' and ['severity'] == 'error'
```

### Database Monitoring

**Check pending transcode jobs**:
```sql
SELECT COUNT(*) FROM transcode_jobs WHERE status = 'pending';
```

**Check pending cleanup jobs**:
```sql
SELECT COUNT(*) FROM media_cleanup_jobs WHERE processed_at IS NULL;
```

**Recent transcoding activity**:
```sql
SELECT 
  id,
  status,
  created_at,
  updated_at
FROM transcode_jobs
ORDER BY updated_at DESC
LIMIT 20;
```

---

## Troubleshooting

### Transcoding Worker Issues

**Service won't start**:
```bash
# Check Python syntax
cd /home/scribe/rugbycodex/jetson_scripts/streaming
python3 stream_worker_sqs.py
# Ctrl+C to stop

# Check environment variables loaded
sudo systemctl show rugbycodex-transcoder-sqs --property=Environment
```

**Not picking up jobs**:
1. Verify SQS queue has messages: AWS Console → SQS → `rugbycodex-transcode-jobs`
2. Check AWS credentials in `.env`
3. Check worker logs for connection errors
4. Test AWS connection: `aws sqs receive-message --queue-url $SQS_QUEUE_URL`

**FFmpeg errors**:
```bash
# Verify hardware decoder available
ffmpeg -decoders | grep h264_nvv4l2dec

# Test FFmpeg command manually
cd /tmp
ffmpeg -c:v h264_nvv4l2dec -i test.mp4 -c:v libx264 -preset ultrafast output.mp4
```

### Cleanup Worker Issues

**Jobs not processing**:
1. Check database: `SELECT * FROM media_cleanup_jobs WHERE processed_at IS NULL`
2. Verify Supabase credentials in `.env`
3. Check worker logs for errors
4. Verify last run time: `sudo journalctl -u rugbycodex-cleanup | tail`

**Wasabi connection errors**:
- Verify Wasabi credentials in `.env`
- Test connection: `aws s3 ls s3://rugbycodex-media --endpoint-url $WASABI_ENDPOINT`
- Check bucket permissions

### General Issues

**Environment variables not loaded**:
```bash
# Service must use EnvironmentFile directive
grep EnvironmentFile /etc/systemd/system/rugbycodex-*.service

# Should see:
# EnvironmentFile=/home/scribe/rugbycodex/jetson_scripts/.env
```

**Permission errors**:
```bash
# Verify file ownership
ls -la /home/scribe/rugbycodex/jetson_scripts/

# Should be owned by scribe user
# If not: sudo chown -R scribe:scribe /home/scribe/rugbycodex/
```

**High disk usage**:
```bash
# Check /tmp/transcode (working directory)
du -sh /tmp/transcode

# Clean up manually if needed
rm -rf /tmp/transcode/*
```

---

## Development

### Local Testing

Test workers without systemd:

```bash
# Test transcoding worker
cd /home/scribe/rugbycodex/jetson_scripts/streaming
python3 stream_worker_sqs.py
# Ctrl+C to stop

# Test cleanup worker
cd /home/scribe/rugbycodex/jetson_scripts/cleanup
python3 cleanup_worker.py
# Ctrl+C to stop
```

### Code Changes

1. Edit Python files on development machine
2. rsync to Jetson:
   ```bash
   rsync -av jetson_scripts/ scribe@<JETSON_IP>:/home/scribe/rugbycodex/jetson_scripts/
   ```
3. Restart affected service:
   ```bash
   ssh scribe@<JETSON_IP>
   sudo systemctl restart rugbycodex-transcoder-sqs
   # or
   sudo systemctl restart rugbycodex-cleanup
   ```
4. Monitor logs for issues:
   ```bash
   sudo journalctl -u rugbycodex-transcoder-sqs -f
   ```

### Adding New Services

1. Create new folder (e.g., `new_worker/`)
2. Add Python script and README
3. Create systemd service file: `rugbycodex-new-worker.service`
4. Use same `.env` file (add new vars if needed)
5. Install and enable service
6. Update this README with new service details

---

## File Structure

```
jetson_scripts/
├── README.md (this file)
├── .env (shared configuration - not in git)
├── .env.example (template)
├── ENV_GUIDE.md
├── DEPLOYMENT.md
├── requirements.txt
│
├── streaming/
│   ├── stream_worker_sqs.py
│   └── README.md
│
├── cleanup/
│   ├── cleanup_worker.py
│   └── README.md
│
├── utils/
│   ├── observability.py
│   ├── visibility_heartbeat.py
│   └── README.md
│
├── rugbycodex-transcoder-sqs.service
└── rugbycodex-cleanup.service
```

---

## System Requirements

**Hardware**:
- NVIDIA Jetson Orin Nano (8GB recommended)
- 128GB+ storage (for video processing workspace)
- Gigabit ethernet (faster uploads/downloads)

**Software**:
- Ubuntu 20.04+ (JetPack SDK)
- Python 3.8+
- FFmpeg 4.2+ (with nvv4l2dec support)
- systemd

**Network**:
- Outbound HTTPS (443) for AWS, Supabase, Wasabi, Axiom
- Static IP or DDNS (optional, for remote management)

**Dependencies**:
```bash
# Install system packages
sudo apt update
sudo apt install python3-pip ffmpeg

# Install Python packages
pip3 install boto3 supabase python-dotenv axiom-py
```

---

## Cost Analysis

**Jetson Orin Nano**:
- Hardware: $499 one-time
- Power: ~10W idle, ~25W under load → ~$2-5/month
- Internet: Existing connection

**vs AWS Fargate**:
- Transcode 100 videos/month (avg 20 min each)
- 100 videos × 20 min × 2 vCPU × $0.04/vCPU-hour = ~$27/month
- Plus: ECS task startup time, S3 egress

**Hybrid Approach**:
- Jetson: Always-on baseline capacity (~$5/month)
- AWS ECS: Burst capacity for spikes (scales 0-5 tasks)
- Best of both: Low steady-state cost + high burst capacity

---

## Security

**Credentials**:
- Never commit `.env` to git
- Use service role keys (not personal credentials)
- Rotate keys quarterly
- Restrict IAM permissions to minimum required

**Network**:
- Jetson behind firewall (no inbound ports)
- Outbound HTTPS only
- Optional: VPN for remote management

**Code**:
- Review updates before deploying
- Test in dev environment first
- Monitor logs for suspicious activity

---

## Related Documentation

- [AWS Setup Guide](../docs/architecture/AWS_SETUP.md)
- [Hybrid Architecture](../docs/architecture/HYBRID_ARCHITECTURE.md)
- [Dynamic Visibility Timeout](../docs/DYNAMIC_VISIBILITY_TIMEOUT.md)
- [Schema Reference](../docs/sql/SCHEMA_REFERENCE.md)
- [Service Reference](../JETSON_SERVICE_REFERENCE.md)

---

## Support

**Logs**: Always check systemd journal first
```bash
sudo journalctl -u "rugbycodex-*" -n 100
```

**Database**: Verify job status in Supabase
```sql
SELECT * FROM transcode_jobs ORDER BY created_at DESC LIMIT 10;
SELECT * FROM media_cleanup_jobs WHERE processed_at IS NULL;
```

**AWS**: Check SQS queue depth in AWS Console

**Storage**: Verify Wasabi connectivity and file uploads
