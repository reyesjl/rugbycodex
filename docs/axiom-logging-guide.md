# Axiom Logging & Dashboard Guide for Rugby Codex

## 📋 Table of Contents
1. [Overview](#overview)
2. [What We're Logging](#what-were-logging)
3. [Log Schema & Fields](#log-schema--fields)
4. [Essential Dashboards](#essential-dashboards)
5. [Key Queries & Metrics](#key-queries--metrics)
6. [Troubleshooting Scenarios](#troubleshooting-scenarios)
7. [Alerting Recommendations](#alerting-recommendations)

---

## Overview

**Platform:** Axiom (https://app.axiom.co/)  
**Dataset:** `rugbycodex-logs`  
**Retention:** 30 days (free tier)  
**Monthly Ingest Limit:** 500GB (free tier)

### Architecture
- **Frontend:** Vue 3 app sends logs directly to Axiom via batching (10s or 50 events)
- **Edge Functions:** Deno-based Supabase functions batch logs per request and flush at completion
- **Token Type:** Basic API token (ingest-only, safe to expose publicly)

### Security
- ✅ Frontend uses ingest-only token (bundled in JS, safe)
- ✅ Edge functions use Supabase secrets
- ✅ No sensitive data logged (passwords, tokens, PII scrubbed)

---

## What We're Logging

### Frontend Application (`layer="frontend"`)

#### 1. **Application Lifecycle**
- App startup/initialization
- Environment detection (dev vs prod)
- Axiom client initialization

#### 2. **Authentication Events**
- User login success/failure
- User logout
- Session restoration
- Auth context changes (user_id tracking)

#### 3. **Organization Context**
- Organization switches
- Active org changes (org_id tracking)
- Org context clearing

#### 4. **Edge Function Calls** (`event_type="edge_call"`)
- Function name
- Request/response correlation via `request_id`
- Latency (ms)
- Success/error status
- Error details on failure

**Logged for every edge function invocation:**
```typescript
{
  event_type: 'edge_call',
  function_name: 'get-media-assets',
  request_id: 'req_abc123',
  duration_ms: 245,
  status: 'success' | 'error',
  error?: { message, code }
}
```

#### 5. **Upload Lifecycle** (`event_type="upload_*"`)

**Upload Initiated:**
```typescript
{
  event_type: 'upload_initiated',
  bucket: 'media-assets',
  file_size_bytes: 52428800,
  file_name: 'game_footage.mp4'
}
```

**Upload Completed:**
```typescript
{
  event_type: 'upload_completed',
  bucket: 'media-assets',
  media_id: 'media_123',
  file_size_bytes: 52428800,
  duration_ms: 8500,
  throughput_mbps: 49.33
}
```

**Upload Failed:**
```typescript
{
  event_type: 'upload_failed',
  bucket: 'media-assets',
  error_code: 'WASABI_UPLOAD_FAILED',
  error_message: 'Network timeout'
}
```

#### 6. **Video Playback** (`event_type="video_*"`)

**Session Tracking:**
- Each playback gets unique `playback_session_id` for correlation
- Tracks same video across load → play → pause → end

**Manifest Loaded:**
```typescript
{
  event_type: 'video_manifest_loaded',
  playback_session_id: 'session_xyz',
  media_id: 'media_123',
  manifest_url: 'https://...',
  load_time_ms: 1250
}
```

**Playback Events:**
```typescript
{
  event_type: 'video_playback_started' | 'video_playback_paused' | 'video_playback_ended',
  playback_session_id: 'session_xyz',
  media_id: 'media_123',
  current_time: 45.5,
  duration: 180
}
```

**Playback Errors:**
```typescript
{
  event_type: 'video_playback_error',
  playback_session_id: 'session_xyz',
  media_id: 'media_123',
  error_code: 1001,
  error_category: 'NETWORK',
  error_message: 'HTTP error 404'
}
```

#### 7. **Vue Errors** (`event_type="vue_error"`)
- Component errors
- Lifecycle hook errors
- Stack traces
- Component name and info

#### 8. **Global Errors** (`event_type="javascript_error"`)
- Unhandled exceptions
- Error stack traces
- Source file and line number

#### 9. **Promise Rejections** (`event_type="unhandled_rejection"`)
- Unhandled promise rejections
- Reason/error details

---

### Edge Functions (`layer="edge_function"`)

#### 1. **Request Lifecycle**
- Function invocation start
- Request metadata (method, path, headers)
- Response status and duration
- Error details on failure

#### 2. **Error Handling**
- Caught exceptions with stack traces
- Validation errors
- Database errors
- External API failures

#### 3. **Performance Metrics**
- Execution duration (ms)
- Cold start detection
- Memory usage (if available)

**Standard Edge Function Log:**
```typescript
{
  layer: 'edge_function',
  runtime: 'deno',
  function_name: 'get-media-assets',
  request_id: 'req_abc123',
  region: 'us-east-1',
  execution_id: 'exec_xyz',
  user_id?: 'user_123',
  org_id?: 'org_456',
  duration_ms: 245,
  status: 200,
  error?: { message, code, stack }
}
```

---

## Log Schema & Fields

### Universal Fields (All Logs)
```typescript
{
  timestamp: string,           // ISO 8601 timestamp
  level: 'info' | 'warning' | 'error',
  environment: 'development' | 'production',
  layer: 'frontend' | 'edge_function',
  event_type: string,          // Specific event identifier
  message: string              // Human-readable description
}
```

### Frontend-Specific Fields
```typescript
{
  user_id?: string,            // Current authenticated user
  org_id?: string,             // Current active organization
  request_id?: string,         // Request correlation ID
  user_agent: string,          // Browser user agent
  
  // Performance
  duration_ms?: number,
  throughput_mbps?: number,
  load_time_ms?: number,
  
  // Upload context
  bucket?: string,
  file_size_bytes?: number,
  media_id?: string,
  
  // Video context
  playback_session_id?: string,
  manifest_url?: string,
  current_time?: number,
  
  // Error context
  error?: {
    message: string,
    code?: string,
    stack?: string
  }
}
```

### Edge Function-Specific Fields
```typescript
{
  runtime: 'deno',
  function_name: string,
  region: string,              // SB_REGION
  execution_id: string,        // SB_EXECUTION_ID
  user_id?: string,
  org_id?: string,
  request_id?: string,
  
  // Request details
  method?: string,
  path?: string,
  status?: number,
  
  // Performance
  duration_ms?: number,
  
  // Error context
  error?: {
    message: string,
    code?: string,
    stack?: string
  }
}
```

---

## Essential Dashboards

### 1. **System Health Overview** (Homepage Dashboard)

**Purpose:** High-level health check at a glance

**Widgets:**
1. **Total Requests (Last 24h)**
   - Count of all logs
   - Compare to previous 24h

2. **Error Rate**
   - `count(level == 'error') / count(*) * 100`
   - Alert if > 5%

3. **Avg Response Time (Edge Functions)**
   - `avg(duration_ms) where layer == 'edge_function'`
   - P50, P95, P99 percentiles

4. **Active Users (Last 1h)**
   - `count(distinct user_id) where timestamp > now() - 1h`

5. **Top Errors (Last 24h)**
   - `count(*) by error.message where level == 'error'`
   - Table with error message + count

6. **Edge Function Success Rate**
   - `count(status < 400) / count(*) * 100 where layer == 'edge_function'`

---

### 2. **Edge Function Performance**

**Purpose:** Monitor backend API performance

**Widgets:**
1. **Function Call Volume**
   - `count(*) by function_name where layer == 'edge_function'`
   - Time series (last 6h)

2. **Function Latency by Name**
   - `avg(duration_ms) by function_name where layer == 'edge_function'`
   - Bar chart sorted by slowest

3. **Error Rate by Function**
   - `count(*) by function_name, status where status >= 400`
   - Heatmap

4. **P95 Latency Trend**
   - `percentile(duration_ms, 95) where layer == 'edge_function'`
   - Time series (last 24h)

5. **Cold Starts Detection**
   - `count(*) where duration_ms > 1000 and layer == 'edge_function'`
   - Likely cold starts (>1s)

6. **Region Distribution**
   - `count(*) by region where layer == 'edge_function'`
   - Pie chart

---

### 3. **User Journey & Experience**

**Purpose:** Track user flows and engagement

**Widgets:**
1. **Active Users Timeline**
   - `count(distinct user_id) over time`
   - Last 7 days

2. **Active Organizations**
   - `count(distinct org_id) over time`
   - Last 7 days

3. **Authentication Events**
   - `count(*) by event_type where event_type contains 'auth'`
   - Login success vs failures

4. **Edge Function Calls per User**
   - `count(*) by user_id where event_type == 'edge_call'`
   - Top 10 most active users

5. **User Errors**
   - `count(*) by user_id where level == 'error'`
   - Identify users experiencing issues

6. **Session Duration (Proxy)**
   - `max(timestamp) - min(timestamp) by user_id`
   - Average session length

---

### 4. **Upload Performance & Reliability**

**Purpose:** Monitor video upload success and speed

**Widgets:**
1. **Upload Success Rate**
   - `count(event_type == 'upload_completed') / count(event_type == 'upload_initiated') * 100`
   - Last 24h

2. **Upload Throughput**
   - `avg(throughput_mbps) where event_type == 'upload_completed'`
   - Time series (last 7 days)

3. **Upload Duration Distribution**
   - `histogram(duration_ms) where event_type == 'upload_completed'`
   - Bins: <10s, 10-30s, 30-60s, >60s

4. **Failed Uploads**
   - `count(*) by error.message where event_type == 'upload_failed'`
   - Table with error breakdown

5. **Upload Volume by Org**
   - `count(*) by org_id where event_type == 'upload_initiated'`
   - Which orgs upload most

6. **Large File Performance**
   - `avg(throughput_mbps) by file_size_bytes bucket(50MB) where event_type == 'upload_completed'`
   - Does throughput degrade with size?

---

### 5. **Video Playback Quality**

**Purpose:** Monitor video streaming experience

**Widgets:**
1. **Playback Start Success Rate**
   - `count(event_type == 'video_playback_started') / count(event_type == 'video_manifest_loaded') * 100`

2. **Manifest Load Time**
   - `avg(load_time_ms) where event_type == 'video_manifest_loaded'`
   - P50, P95, P99

3. **Playback Errors**
   - `count(*) by error_code, error_category where event_type == 'video_playback_error'`
   - Table with error types

4. **Video Completion Rate**
   - `count(event_type == 'video_playback_ended') / count(event_type == 'video_playback_started') * 100`

5. **Most Watched Videos**
   - `count(*) by media_id where event_type == 'video_playback_started'`
   - Top 10 media_ids

6. **Playback Sessions**
   - `count(distinct playback_session_id) over time`
   - Total video sessions

---

### 6. **Error Tracking & Debugging**

**Purpose:** Deep dive into errors for troubleshooting

**Widgets:**
1. **Errors Over Time**
   - `count(*) where level == 'error'`
   - Time series (last 24h)

2. **Error Breakdown by Type**
   - `count(*) by event_type where level == 'error'`
   - Pie chart

3. **Error Breakdown by Layer**
   - `count(*) by layer where level == 'error'`
   - Frontend vs Edge Function errors

4. **Recent Errors**
   - `* where level == 'error' order by timestamp desc limit 50`
   - Table: timestamp, event_type, message, user_id, error.message

5. **Errors by User**
   - `count(*) by user_id where level == 'error' and user_id != null`
   - Which users hit most errors

6. **Errors by Org**
   - `count(*) by org_id where level == 'error' and org_id != null`
   - Which orgs experiencing issues

---

## Key Queries & Metrics

### Performance Queries

**Slowest Edge Functions:**
```
['layer'] == 'edge_function' and ['duration_ms'] > 1000
| summarize avg(['duration_ms']), percentile(['duration_ms'], 95) by ['function_name']
| order by avg_duration_ms desc
```

**Frontend Edge Call Latency:**
```
['event_type'] == 'edge_call'
| summarize avg(['duration_ms']), percentile(['duration_ms'], 50, 95, 99) by ['function_name']
```

**Upload Performance by Organization:**
```
['event_type'] == 'upload_completed'
| summarize avg(['throughput_mbps']), avg(['duration_ms']) by ['org_id']
| order by avg_throughput_mbps desc
```

**Video Load Time Percentiles:**
```
['event_type'] == 'video_manifest_loaded'
| summarize percentile(['load_time_ms'], 50, 75, 90, 95, 99)
```

---

### Error Tracking Queries

**All Errors in Last Hour:**
```
['level'] == 'error' and ['timestamp'] > ago(1h)
| order by ['timestamp'] desc
```

**Upload Failures with Context:**
```
['event_type'] == 'upload_failed'
| project ['timestamp'], ['user_id'], ['org_id'], ['bucket'], ['error']
| order by ['timestamp'] desc
```

**Video Playback Errors by Type:**
```
['event_type'] == 'video_playback_error'
| summarize count() by ['error_code'], ['error_category']
| order by count desc
```

**Edge Function Errors:**
```
['layer'] == 'edge_function' and ['status'] >= 400
| summarize count() by ['function_name'], ['status'], ['error.message']
```

**Unhandled Rejections:**
```
['event_type'] == 'unhandled_rejection'
| project ['timestamp'], ['message'], ['error.message'], ['user_id']
| order by ['timestamp'] desc
```

---

### User Activity Queries

**User Request Trace (Full Journey):**
```
['user_id'] == 'user_123'
| order by ['timestamp'] asc
```

**Request Correlation (Frontend + Backend):**
```
['request_id'] == 'req_abc123'
| order by ['timestamp'] asc
```

**Most Active Users:**
```
['user_id'] != null
| summarize request_count = count() by ['user_id']
| order by request_count desc
| limit 20
```

**Organization Activity:**
```
['org_id'] != null
| summarize total_requests = count(), unique_users = count_distinct(['user_id']) by ['org_id']
| order by total_requests desc
```

---

### Business Intelligence Queries

**Upload Volume Trend:**
```
['event_type'] == 'upload_initiated'
| summarize count() by bin(['timestamp'], 1h)
```

**Video Engagement:**
```
['event_type'] in ('video_playback_started', 'video_playback_paused', 'video_playback_ended')
| summarize count() by ['event_type'], ['media_id']
```

**Feature Usage:**
```
['event_type'] == 'edge_call'
| summarize count() by ['function_name']
| order by count desc
```

**Peak Usage Hours:**
```
| extend hour = hourofday(['timestamp'])
| summarize count() by hour
| order by hour asc
```

---

## Troubleshooting Scenarios

### Scenario 1: "Users reporting slow video playback"

**Investigation Steps:**

1. **Check manifest load times:**
```
['event_type'] == 'video_manifest_loaded'
| summarize avg(['load_time_ms']), percentile(['load_time_ms'], 95)
| where timestamp > ago(1h)
```

2. **Check for playback errors:**
```
['event_type'] == 'video_playback_error'
| summarize count() by ['error_code'], ['error_category']
| where timestamp > ago(1h)
```

3. **Check edge function latency:**
```
['layer'] == 'edge_function' and ['function_name'] contains 'media'
| summarize avg(['duration_ms'])
| where timestamp > ago(1h)
```

4. **Identify affected users:**
```
['event_type'] == 'video_playback_error'
| summarize error_count = count() by ['user_id']
| order by error_count desc
```

---

### Scenario 2: "Upload failed for user X"

**Investigation Steps:**

1. **Find upload failure:**
```
['event_type'] == 'upload_failed' and ['user_id'] == 'user_X'
| project ['timestamp'], ['bucket'], ['file_name'], ['error']
| order by ['timestamp'] desc
```

2. **Trace full upload lifecycle:**
```
['event_type'] starts_with 'upload_' and ['user_id'] == 'user_X'
| order by ['timestamp'] desc
```

3. **Check related edge function calls:**
```
['user_id'] == 'user_X' and ['event_type'] == 'edge_call'
| where ['timestamp'] > ago(10m)
| order by ['timestamp'] desc
```

4. **Check for network errors:**
```
['user_id'] == 'user_X' and ['level'] == 'error'
| where ['timestamp'] > ago(10m)
```

---

### Scenario 3: "Edge function X is slow"

**Investigation Steps:**

1. **Check function latency:**
```
['function_name'] == 'get-media-assets' and ['layer'] == 'edge_function'
| summarize avg(['duration_ms']), percentile(['duration_ms'], 50, 95, 99)
| where timestamp > ago(24h)
```

2. **Find slowest requests:**
```
['function_name'] == 'get-media-assets' and ['layer'] == 'edge_function'
| where ['duration_ms'] > 1000
| project ['timestamp'], ['duration_ms'], ['user_id'], ['org_id'], ['request_id']
| order by ['duration_ms'] desc
| limit 20
```

3. **Check error rate:**
```
['function_name'] == 'get-media-assets' and ['layer'] == 'edge_function'
| summarize error_rate = countif(['status'] >= 400) * 100.0 / count()
```

4. **Regional issues:**
```
['function_name'] == 'get-media-assets' and ['layer'] == 'edge_function'
| summarize avg(['duration_ms']) by ['region']
| order by avg_duration_ms desc
```

---

### Scenario 4: "Error spike at 2pm"

**Investigation Steps:**

1. **What errors spiked:**
```
['level'] == 'error'
| where ['timestamp'] > datetime(2024-01-29T14:00:00Z) and ['timestamp'] < datetime(2024-01-29T14:30:00Z)
| summarize count() by ['event_type'], ['error.message']
| order by count desc
```

2. **Which users affected:**
```
['level'] == 'error'
| where ['timestamp'] > datetime(2024-01-29T14:00:00Z) and ['timestamp'] < datetime(2024-01-29T14:30:00Z)
| summarize count() by ['user_id']
| order by count desc
```

3. **Frontend vs Backend:**
```
['level'] == 'error'
| where ['timestamp'] > datetime(2024-01-29T14:00:00Z) and ['timestamp'] < datetime(2024-01-29T14:30:00Z)
| summarize count() by ['layer']
```

4. **Timeline:**
```
['level'] == 'error'
| where ['timestamp'] > datetime(2024-01-29T14:00:00Z) and ['timestamp'] < datetime(2024-01-29T14:30:00Z)
| summarize count() by bin(['timestamp'], 1m)
```

---

## Alerting Recommendations

### Critical Alerts (Immediate Action)

1. **High Error Rate**
   - **Query:** `count(level == 'error') / count(*) * 100 > 5`
   - **Window:** 5 minutes
   - **Action:** Page on-call engineer

2. **Edge Function Failures**
   - **Query:** `count(layer == 'edge_function' and status >= 500) > 10`
   - **Window:** 5 minutes
   - **Action:** Investigate backend infrastructure

3. **Upload Failure Spike**
   - **Query:** `count(event_type == 'upload_failed') > 5`
   - **Window:** 15 minutes
   - **Action:** Check Wasabi/S3 connectivity

4. **Video Playback Complete Failure**
   - **Query:** `count(event_type == 'video_playback_error') > 20`
   - **Window:** 15 minutes
   - **Action:** Check CDN/streaming infrastructure

---

### Warning Alerts (Monitor & Schedule)

1. **Slow Edge Functions**
   - **Query:** `avg(duration_ms where layer == 'edge_function') > 1000`
   - **Window:** 15 minutes
   - **Action:** Review query performance

2. **High Upload Duration**
   - **Query:** `avg(duration_ms where event_type == 'upload_completed') > 60000`
   - **Window:** 30 minutes
   - **Action:** Check network/Wasabi performance

3. **Low Upload Success Rate**
   - **Query:** `count(upload_completed) / count(upload_initiated) < 0.90`
   - **Window:** 1 hour
   - **Action:** Investigate upload failures

4. **Manifest Load Time Degradation**
   - **Query:** `percentile(load_time_ms where event_type == 'video_manifest_loaded', 95) > 3000`
   - **Window:** 30 minutes
   - **Action:** Check CDN performance

---

### Informational Alerts (Daily Digest)

1. **Daily Error Summary**
   - **Query:** Count of errors by type (last 24h)
   - **Schedule:** 9am daily

2. **Top Active Users**
   - **Query:** Top 10 users by request count (last 24h)
   - **Schedule:** 9am daily

3. **Upload Statistics**
   - **Query:** Total uploads, avg throughput, success rate (last 24h)
   - **Schedule:** 9am daily

4. **Video Engagement**
   - **Query:** Total playback sessions, most watched videos (last 24h)
   - **Schedule:** 9am daily

---

## Best Practices

### DO:
- ✅ Use `request_id` to correlate frontend → edge function calls
- ✅ Use `playback_session_id` to track video lifecycle
- ✅ Check P95/P99 latency, not just averages
- ✅ Filter by `org_id` to isolate organization-specific issues
- ✅ Use time windows (last 1h, 24h, 7d) for context
- ✅ Create saved queries for common investigations

### DON'T:
- ❌ Query without time bounds (slow & expensive)
- ❌ Ignore warning-level logs (they predict errors)
- ❌ Focus only on error count (rate matters more)
- ❌ Alert on single events (use thresholds & windows)
- ❌ Log sensitive data (passwords, tokens, PII)

---

## Quick Reference: Event Types

| Event Type | Layer | Purpose |
|------------|-------|---------|
| `app_initialized` | frontend | App startup |
| `edge_call` | frontend | Edge function invocation from frontend |
| `upload_initiated` | frontend | Upload started |
| `upload_completed` | frontend | Upload finished successfully |
| `upload_failed` | frontend | Upload failed |
| `video_manifest_loaded` | frontend | Video manifest loaded |
| `video_playback_started` | frontend | Video playback started |
| `video_playback_paused` | frontend | Video playback paused |
| `video_playback_ended` | frontend | Video playback ended |
| `video_playback_error` | frontend | Video playback error |
| `vue_error` | frontend | Vue component error |
| `javascript_error` | frontend | Unhandled JS error |
| `unhandled_rejection` | frontend | Unhandled promise rejection |
| `request_start` | edge_function | Edge function invoked |
| `request_complete` | edge_function | Edge function completed |
| `error` | both | Generic error |

---

## Next Steps

1. **Create your first dashboard:**
   - Log into Axiom (https://app.axiom.co/)
   - Navigate to Dashboards → New Dashboard
   - Start with "System Health Overview" (widgets listed above)

2. **Set up critical alerts:**
   - Navigate to Monitors → New Monitor
   - Start with "High Error Rate" alert
   - Configure notification channels (email/Slack)

3. **Save common queries:**
   - Test queries in Stream tab
   - Click "Save Query" for reuse
   - Organize by category (Performance, Errors, Business)

4. **Schedule weekly review:**
   - Review error trends
   - Identify slow endpoints
   - Check upload/video metrics
   - Plan optimizations

---

## Support & Resources

- **Axiom Docs:** https://axiom.co/docs
- **Query Language (APL):** https://axiom.co/docs/apl/introduction
- **Dashboard Examples:** https://axiom.co/docs/guides/dashboards
- **Alerting Guide:** https://axiom.co/docs/guides/monitors

---

**Last Updated:** 2026-01-29  
**Implemented in:** `feature/axiom-logging` branch (merged to main)  
**Configuration:** `/frontend/.env.production`, Supabase secrets
