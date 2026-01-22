# Observability Report — RugbyCodex

## Summary of new logs added
- Structured JSON logging for Edge Functions via shared helper and `withObservability` wrapper.
- Request start/end/error logs with request IDs and latency for all Edge Functions.
- Structured client logs for Edge Function invocations and frontend upload lifecycle events.
- Structured worker logs for job lifecycle, stage transitions, retries, and cleanup.
- Log-based metrics events (`event_type: metric`) for RED/USE coverage.

## Files modified
### New files
- frontend/supabase/functions/_shared/observability.ts
- frontend/src/lib/api.ts
- jetson_scripts/utils/observability.py
- jetson_scripts/utils/__init__.py
- docs/observability_report.md

### Edge Functions (wrapped with `withObservability`)
- frontend/supabase/functions/get-wasabi-upload-session/index.ts
- frontend/supabase/functions/upload-eligibility-check/index.ts
- frontend/supabase/functions/transcribe-webm-file/index.ts
- frontend/supabase/functions/transcribe-wav-file/index.ts
- frontend/supabase/functions/generate-query-embedding/index.ts
- frontend/supabase/functions/get-playback-playlist/index.ts
- frontend/supabase/functions/get-wasabi-playback-playlist/index.ts
- frontend/supabase/functions/generate-narration-embedding/index.ts
- frontend/supabase/functions/summarize-media-asset/index.ts
- frontend/supabase/functions/approve-and-create-organization/index.ts
- frontend/supabase/functions/approve-organization-request/index.ts
- frontend/supabase/functions/assign-organization-owner/index.ts
- frontend/supabase/functions/change-member-role/index.ts
- frontend/supabase/functions/create-organization/index.ts
- frontend/supabase/functions/get-org-join-code/index.ts
- frontend/supabase/functions/get-organization-health/index.ts
- frontend/supabase/functions/get-organization-job-summary/index.ts
- frontend/supabase/functions/get-organization-overview/index.ts
- frontend/supabase/functions/get-organization-stats/index.ts
- frontend/supabase/functions/get-organizations-near-limit/index.ts
- frontend/supabase/functions/get-recently-created-organizations/index.ts
- frontend/supabase/functions/get-inactive-organizations/index.ts
- frontend/supabase/functions/join-organization-with-code/index.ts
- frontend/supabase/functions/leave-organization/index.ts
- frontend/supabase/functions/list-organization-requests/index.ts
- frontend/supabase/functions/list-organizations-admin/index.ts
- frontend/supabase/functions/reject-organization-request/index.ts
- frontend/supabase/functions/refresh-org-join-code/index.ts
- frontend/supabase/functions/set-primary-org/index.ts
- frontend/supabase/functions/transfer-ownership/index.ts

### Shared edge helpers updated
- frontend/supabase/functions/_shared/auth.ts
- frontend/supabase/functions/_shared/orgs.ts
- frontend/supabase/functions/_shared/media.ts

### Frontend instrumentation
- frontend/src/modules/media/stores/useUploadStore.ts
- frontend/src/modules/narrations/services/narrationService.ts
- frontend/src/modules/narrations/services/transcriptionService.ts
- frontend/src/modules/analysis/services/analysisService.ts
- frontend/src/modules/media/services/mediaService.ts
- frontend/src/modules/orgs/services/orgServiceV2.ts
- frontend/src/modules/auth/stores/useAuthStore.ts
- frontend/src/modules/orgs/views/OrgMediaAssetReviewView.vue
- frontend/src/main.ts

### Python worker instrumentation
- jetson_scripts/streaming/stream_worker.py
- jetson_scripts/streaming/listener.py
- jetson_scripts/services/compute_heartbeat.py
- jetson_scripts/jobs/clean_media_assets.py

## Example log lines
### API request
```json
{"timestamp":"2026-01-22T12:00:00.000Z","severity":"info","event_type":"request_start","request_id":"6c2e1a...","function":"get-wasabi-upload-session","route":"/get-wasabi-upload-session","method":"POST"}
```

### Job start
```json
{"timestamp":"2026-01-22T12:00:10.000Z","severity":"info","event_type":"job_start","job_id":"0f1b...","org_id":"5a2c...","media_id":"9b7e..."}
```

### Job failure
```json
{"timestamp":"2026-01-22T12:02:10.000Z","severity":"error","event_type":"job_failure","job_id":"0f1b...","org_id":"5a2c...","media_id":"9b7e...","error_code":"FFMPEG_FAILED","error_message":"..."}
```

### External service failure
```json
{"timestamp":"2026-01-22T12:00:40.000Z","severity":"error","event_type":"request_error","request_id":"6c2e1a...","function":"transcribe-webm-file","error_code":"OPENAI_FAILED","error_message":"..."}
```

## Top 5 remaining observability risks
1. Job enqueue origin is outside this repo (likely database triggers or external services), so `request_id` persistence on enqueue cannot be wired in code here.
2. No centralized log aggregation pipeline configured; logs are emitted but not shipped.
3. Frontend metrics rely on console JSON logs; no transport to a backend collector yet.
4. Supabase query-level timings are still opaque for most RLS reads/writes.
5. Worker node resource saturation alerts (CPU/GPU/memory thresholds) are not yet alertable.

## Action plan
### Day 1
- Deploy new logging helpers and verify structured logs across edge + worker runtimes.
- Run the jobs table migration to add `request_id`/`trace_id` columns.
- Validate `x-request-id` propagation from frontend to edge.

### Week 1
- Add a lightweight log shipper (or Supabase Logs sink) to centralize JSON logs.
- Add database query timing logs for the heaviest edge functions.
- Add a basic queue depth dashboard using log-derived metrics.

### Later
- Add OpenTelemetry spans for end-to-end tracing across services.
- Add client-side telemetry transport for frontend metrics.
- Add worker hardware saturation alerts and automated scaling policies.

## Assumptions
- Background job enqueue logic is not present in this repository (likely Supabase triggers or external services). The migration adds `request_id`/`trace_id` columns but enqueue-side population must be implemented wherever jobs are created.
- Edge Functions are the primary backend entrypoints; Node/Express services are not present in this workspace.
