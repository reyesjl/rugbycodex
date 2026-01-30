# Transcoding Worker (SQS-based)

Video transcoding worker that processes jobs from AWS SQS queue. Competes with AWS ECS workers for jobs.

## Overview

This worker:
- Polls AWS SQS queue for transcode jobs
- Downloads raw video from Wasabi S3
- Transcodes to HLS format using FFmpeg (hardware decode, software encode)
- Uploads streaming files back to Wasabi
- Updates job status in Supabase database
- Uses dynamic visibility timeout with heartbeat system

## How It Works

1. **Poll SQS Queue** - Continuously polls for new jobs
2. **Receive Message** - Gets job details from queue
3. **Download Video** - Fetches raw video from Wasabi
4. **Start Heartbeat** - Begins extending SQS visibility timeout
5. **Transcode** - Converts to HLS using FFmpeg with hardware acceleration
6. **Upload** - Streams HLS files back to Wasabi
7. **Update Database** - Marks job complete in Supabase
8. **Delete Message** - Removes job from SQS queue
9. **Stop Heartbeat** - Ends timeout extension

## Environment Variables

Required (from parent `.env`):

```bash
# AWS SQS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
SQS_TRANSCODE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT/queue

# Wasabi Storage
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.us-east-1.wasabisys.com
WASABI_KEY=your_key
WASABI_SECRET=your_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key

# Device
RC_DEVICE_NAME=jetson-orin-nano-01

# Optional
SQS_VISIBILITY_TIMEOUT=600  # 10 minutes default
VERBOSE_LOGGING=false
AXIOM_API_TOKEN=your_token
AXIOM_DATASET=rugbycodex-logs
AXIOM_ENVIRONMENT=jetson
```

## Systemd Service

Managed by systemd at: `/etc/systemd/system/rugbycodex-transcoder-sqs.service`

Service configuration:
- **User**: scribe
- **WorkingDirectory**: `/home/scribe/rugbycodex/jetson_scripts/streaming`
- **EnvironmentFile**: `/home/scribe/rugbycodex/jetson_scripts/.env`
- **Auto-restart**: Yes (always)
- **Restart delay**: 10 seconds

## Commands

```bash
# Start service
sudo systemctl start rugbycodex-transcoder-sqs

# Stop service
sudo systemctl stop rugbycodex-transcoder-sqs

# Restart service
sudo systemctl restart rugbycodex-transcoder-sqs

# Check status
sudo systemctl status rugbycodex-transcoder-sqs

# View logs
sudo journalctl -u rugbycodex-transcoder-sqs -f

# View last 50 lines
sudo journalctl -u rugbycodex-transcoder-sqs -n 50

# Enable auto-start on boot
sudo systemctl enable rugbycodex-transcoder-sqs

# Disable auto-start
sudo systemctl disable rugbycodex-transcoder-sqs
```

## Manual Testing

Test the worker without systemd:

```bash
cd /home/scribe/rugbycodex/jetson_scripts/streaming
python3 stream_worker_sqs.py
# Ctrl+C to stop
```

## Video Processing

Uses FFmpeg with Jetson hardware decoding and software encoding:
- Video decoder: `h264_nvv4l2dec` (Jetson hardware decoder)
- Video encoder: `libx264` (software encoder)
- Audio codec: `aac`
- Encoder preset: `ultrafast`
- Encoder tune: `zerolatency`
- Video bitrate: 2000k (max 2500k)
- Audio bitrate: 128k
- HLS segment duration: 6 seconds

FFmpeg command:
```bash
ffmpeg -y \
  -c:v h264_nvv4l2dec \
  -i input.mp4 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 2000k -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 128k \
  -f hls -hls_time 6 -hls_list_size 0 \
  -hls_segment_filename "segment%03d.ts" \
  index.m3u8
```

**Note:** Jetson Orin Nano uses hardware decoding (nvv4l2dec) for input video and software encoding (libx264) for HLS output. Hardware encoding is not used.

## Visibility Timeout & Heartbeat

### Initial Timeout
Based on file size:
- <100MB: 5 minutes
- <500MB: 10 minutes
- <2GB: 20 minutes
- <4GB: 35 minutes
- <6GB: 50 minutes
- >6GB: 60 minutes

### Heartbeat Extension
- Interval: Every 4 minutes
- Extension: +5 minutes each time
- Automatic: Runs in background thread
- Stops: On job completion or failure

This prevents:
- ❌ Duplicate processing (timeout before job completes)
- ❌ Slow retries (job fails but message invisible for 20 min)

## Processing Stages

The worker updates `processing_stage` in the database:

1. `uploaded` - Job received from queue
2. `transcoding` - FFmpeg running
3. `transcoded` - Transcode complete, uploading files
4. `complete` - All done

## Observability

Logs to:
- **stdout/stderr** - Captured by systemd journal
- **Axiom** (optional) - Structured event logging

Key events logged:
- `job_received` - Job pulled from queue
- `download_start` / `download_complete`
- `transcode_start` / `transcode_complete`
- `upload_start` / `upload_complete`
- `job_complete` - Success
- `job_failed` - Error occurred
- `heartbeat_extended` - Visibility timeout extended

Query Axiom:
```
['environment'] == 'jetson' and ['event_type'] starts-with 'transcode_'
```

## Error Handling

### Retries
- Failed jobs return to queue after visibility timeout expires
- SQS handles retry logic automatically
- Max retries: Configured in SQS queue settings

### Common Errors

**FFmpeg not found**:
```bash
sudo apt-get install ffmpeg
```

**Hardware decoder not available**:
- Verify FFmpeg built with nvv4l2dec support: `ffmpeg -decoders | grep h264_nvv4l2dec`
- If missing, worker will fall back to software decoding (slower)

**Supabase connection errors**:
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify network connectivity: `curl https://your-project.supabase.co`

**AWS SQS connection errors**:
- Check AWS credentials and region
- Verify SQS queue URL is correct
- Test with: `aws sqs list-queues --region us-east-1`

**Out of disk space**:
- Worker processes in `/tmp` or working directory
- Large videos need temporary space during transcode
- Clean up with: `sudo du -sh /tmp/*`

## Performance

Processing time varies based on:
- Input video size
- Input codec complexity
- Disk I/O speed
- Available system resources

Work directory: `/tmp/transcode`

## Shared Utilities

Uses shared modules from `../utils/`:
- `observability.py` - Logging and Axiom integration
- `visibility_heartbeat.py` - SQS timeout management

## Competition with AWS Workers

This worker competes with AWS ECS workers for the same queue:
- Both poll the same SQS queue
- First to receive a message processes it
- Use for local processing / cost optimization
- AWS workers handle overflow and scaling

## Monitoring

### Health Check
```bash
# Should be running
sudo systemctl is-active rugbycodex-transcoder-sqs

# Recent activity
sudo journalctl -u rugbycodex-transcoder-sqs --since "10 minutes ago"

# Check for errors
sudo journalctl -u rugbycodex-transcoder-sqs | grep -i error
```

### Queue Depth
```bash
# Install AWS CLI first
aws sqs get-queue-attributes \
  --queue-url $SQS_TRANSCODE_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages \
  --region us-east-1
```

### Processing Rate
Check Axiom for:
```
['environment'] == 'jetson' 
| summarize count() by bin(_time, 1h)
| where ['event_type'] == 'job_complete'
```

## Development

Run with debug logging:
```bash
VERBOSE_LOGGING=true python3 stream_worker_sqs.py
```

Modify code:
1. Edit `stream_worker_sqs.py`
2. Test manually: `python3 stream_worker_sqs.py`
3. If working, restart service: `sudo systemctl restart rugbycodex-transcoder-sqs`

## Related Documentation

- [Parent README](../DEPLOYMENT.md) - Overall deployment guide
- [Environment Guide](../ENV_GUIDE.md) - .env file setup
- [Cleanup Worker](../cleanup/README.md) - Media cleanup service
- [Axiom Setup](../AXIOM_SETUP.md) - Observability configuration
- [Architecture](../../docs/architecture/DYNAMIC_VISIBILITY_TIMEOUT.md) - Heartbeat system design
