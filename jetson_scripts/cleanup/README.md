# Media Cleanup Worker

> Note: This worker is now deprecated in favor of the Supabase `cleanup-media-assets` Edge Function + cron job. Only use this worker if you still run the Jetson cleanup service.

Automated worker that deletes media files from Wasabi storage when users delete videos.

## How It Works

1. **Database Polling**: Checks `media_cleanup_jobs` table every 6 hours for pending jobs
2. **Batch Deletion**: Deletes entire media folders (raw video, streaming files, thumbnails)
3. **Error Handling**: Marks jobs as processed with error messages if deletion fails

## Deployment

### Setup on Jetson

1. **Copy environment variables**:
```bash
cp /home/scribe/rugbycodex/jetson_scripts/.env.example \
   /home/scribe/rugbycodex/jetson_scripts/.env
```

2. **Edit .env with your credentials**:
```bash
nano /home/scribe/rugbycodex/jetson_scripts/.env
```

Note: Both workers share the same .env file via systemd's `EnvironmentFile` directive.

3. **Install systemd service**:
```bash
sudo cp /home/scribe/rugbycodex/jetson_scripts/rugbycodex-cleanup.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable rugbycodex-cleanup
sudo systemctl start rugbycodex-cleanup
```

### Monitoring

Check service status:
```bash
sudo systemctl status rugbycodex-cleanup
```

View logs:
```bash
sudo journalctl -u rugbycodex-cleanup -f
```

View logs for specific time:
```bash
sudo journalctl -u rugbycodex-cleanup --since "1 hour ago"
```

## Database Schema

```sql
CREATE TABLE public.media_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp DEFAULT now(),
  processed_at timestamp,  -- NULL = pending
  error text
);
```

## How Cleanup Jobs Are Created

When a user deletes a video, the backend creates a cleanup job:

```sql
INSERT INTO media_cleanup_jobs (media_asset_id, bucket, storage_path)
VALUES (
  'abc-123',
  'rugbycodex-media',
  'orgs/xyz/uploads/abc-123/raw/match.mp4'
);
```

## Orphan Cleanup (One-off)

If you have orphaned Wasabi folders (no matching `media_assets` row), run the audit script:

```bash
cd /home/scribe/rugbycodex/jetson_scripts/cleanup
python3 audit_orphan_media_assets.py --dry-run
python3 audit_orphan_media_assets.py
```

To start fresh before auditing:

```sql
delete from public.media_cleanup_jobs;
```

## Path Deletion Logic

Given storage path: `orgs/123/uploads/456/raw/video.mp4`

1. Extract prefix: `orgs/123/uploads/456/`
2. Delete ALL objects with that prefix:
   - `orgs/123/uploads/456/raw/video.mp4`
   - `orgs/123/uploads/456/streaming/*.ts`
   - `orgs/123/uploads/456/streaming/*.m3u8`
   - `orgs/123/uploads/456/thumbnail.jpg`

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VERBOSE_LOGGING` | Log every file deletion | `false` |
| Poll interval | Time between checks | 6 hours |

## Observability

The worker uses the shared `utils/observability.py` module and logs to:
- **stdout/stderr**: Captured by systemd journal
- **Axiom** (if configured): Structured event logging

### Log Events

- `job_queue_depth`: Queue size (every cycle)
- `job_dequeue`: Job picked up for processing
- `cleanup_start`: Starting deletion for media folder
- `cleanup_object`: Individual file deletion (verbose only)
- `cleanup_complete`: Successfully deleted folder
- `cleanup_failed`: Error during deletion
- `job_cycle_complete`: Finished processing batch

## Troubleshooting

### Service won't start
```bash
# Check for syntax errors
python3 /home/scribe/rugbycodex/jetson_scripts/cleanup/cleanup_worker.py

# Check environment variables
sudo systemctl show rugbycodex-cleanup --property=Environment
```

### Jobs not processing
1. Check database connection: `SELECT * FROM media_cleanup_jobs WHERE processed_at IS NULL;`
2. Verify Wasabi credentials in `.env`
3. Check worker logs: `sudo journalctl -u rugbycodex-cleanup --since "1 hour ago"`

### Deletion errors
- Check bucket name matches Wasabi bucket
- Verify Wasabi credentials have delete permissions
- Ensure storage_path format is valid (starts with `orgs/`)

## Development

### Manual Run
```bash
cd /home/scribe/rugbycodex/jetson_scripts/cleanup
python3 cleanup_worker.py
```

### Test Cleanup Job
```sql
-- Create test cleanup job
INSERT INTO media_cleanup_jobs (
  media_asset_id,
  bucket,
  storage_path
) VALUES (
  gen_random_uuid(),
  'rugbycodex-media-test',
  'orgs/test-org/uploads/test-media/raw/test.mp4'
);

-- Check status
SELECT * FROM media_cleanup_jobs ORDER BY created_at DESC LIMIT 5;
```
