# Rugby Event Auto-Detection - Progress Review & Tomorrow's Guide

**Date:** January 26, 2026  
**Branch:** `feature/event-detection-v2`  
**Status:** Phase 1 Complete ✅

---

## 🎯 What We Built Today

### 1. Database Schema
**Files Created:**
- `docs/sql/event_detections_schema.sql` - Complete table definition
- `docs/sql/add_event_detection_job_type.sql` - Job type enum update
- `docs/sql/add_org_id_to_event_detections.sql` - Migration for existing tables

**Database Changes Applied:**
- ✅ Created `event_detection_type` enum: `('scrum', 'lineout', 'try', 'kick')`
- ✅ Added `'event_detection'` to `job_type` enum
- ⚠️ **TODO TOMORROW:** Add `org_id` column to `event_detections` table

**Table Structure:**
```sql
event_detections:
  - id (uuid, primary key)
  - org_id (uuid, references organizations) ⬅️ ADD THIS TOMORROW
  - media_asset_id (uuid, references media_assets)
  - event_type (enum: scrum, lineout, try, kick)
  - start_seconds (float, >= 0)
  - end_seconds (float, >= start_seconds)
  - confidence_score (numeric, 0-1)
  - model_version (text)
  - metadata (jsonb, optional - frame numbers, bounding boxes, etc.)
  - verified (boolean, default false)
  - verified_by (uuid, references profiles, nullable)
  - verified_at (timestamp, nullable)
  - created_at (timestamp)
  - segment_id (uuid, references segments, nullable)
```

### 2. TypeScript Types
**File:** `frontend/src/modules/events/types/EventDetection.ts`

Defined types for:
- `EventDetectionType` - Union type for event types
- `EventDetection` - Main interface (includes org_id)
- `EventDetectionFilter` - Filter options
- `EventDetectionStats` - Statistics aggregation
- `EventDetectionJob` - Job status tracking

### 3. Edge Functions (Deployed ✅)
**Function 1:** `get-event-detections`
- **Method:** GET
- **Purpose:** Fetch event detections for a media asset
- **Query Params:**
  - `media_id` (required)
  - `event_types` (optional, comma-separated: "scrum,try")
  - `min_confidence` (optional, 0-1)
  - `verified_only` (optional, true/false)
- **Response:** Array of detections + statistics
- **Testing:** ✅ Passed with filters

**Function 2:** `trigger-event-detection`
- **Method:** POST
- **Purpose:** Create event detection job
- **Body:**
  - `media_id` (required)
  - `auto_dispatch` (optional, boolean)
- **Response:** Job ID and state
- **Testing:** ✅ Successfully creates queued jobs

**Configuration:**
- Both added to `supabase/config.toml` with `verify_jwt = false`
- Deployed to production

### 4. Frontend Service Layer
**File:** `frontend/src/modules/events/services/eventDetectionService.ts`

Methods:
- `getEventDetections(mediaAssetId, filters)` - Fetch events
- `triggerEventDetection(mediaAssetId, autoDispatch)` - Create job
- `getEventStats(mediaAssetId)` - Get statistics
- `filterByType(detections, types)` - Client-side filtering
- `filterByConfidence(detections, minConf)` - Client-side filtering
- `groupByType(detections)` - Group by event type

### 5. Documentation Updates
- ✅ Updated `SCHEMA_REFERENCE.md` with new table
- ✅ Updated implementation plan in session folder

---

## 📊 Data Model Explanation

### How Event Detections Work (Like Narrations)

**Narrations Schema (for reference):**
```
narrations:
  - org_id ✓
  - media_asset_id ✓
  - media_asset_segment_id ✓
  - author_id (who created it)
  - transcript_raw, transcript_clean
```

**Event Detections Schema (similar pattern):**
```
event_detections:
  - org_id ✓ (matches narrations pattern)
  - media_asset_id ✓ (which video)
  - event_type (what was detected: scrum/lineout/try/kick)
  - start_seconds, end_seconds (when in the video)
  - confidence_score (how confident the AI is: 0-1)
  - verified_by (which user verified it - like author_id)
```

**Key Similarities:**
- Both have `org_id` for multi-tenancy
- Both reference a `media_asset_id`
- Both can be queried per-organization
- Both support user actions (narrations: author, detections: verifier)

**One Record Per Event:**
If CV detects 5 scrums, 3 trys, 2 lineouts → **10 separate rows** in the table.

Example:
```sql
-- After analyzing a 30-minute match video:
SELECT event_type, COUNT(*) 
FROM event_detections 
WHERE media_asset_id = 'abc123'
GROUP BY event_type;

event_type | count
-----------|------
scrum      |   8
lineout    |   5
try        |   3
kick       |  12
```

---

## ✅ Testing Summary

**All 3 Tests Passed:**

1. **GET detections (empty state):**
   - URL: `/functions/v1/get-event-detections?media_id=xxx`
   - Result: Returns empty array with stats structure ✅

2. **GET detections with filters:**
   - URL: `/functions/v1/get-event-detections?media_id=xxx&event_types=scrum,try&min_confidence=0.8`
   - Result: Correctly applies filters ✅

3. **POST trigger job:**
   - URL: `/functions/v1/trigger-event-detection`
   - Body: `{"media_id": "xxx", "auto_dispatch": false}`
   - Result: Creates job with state "queued" ✅

---

## 🚀 Tomorrow Morning: Step-by-Step Guide

### Step 1: Fix Database Schema (5 minutes)
**Why:** We need to add `org_id` column to match narrations pattern

Run this SQL in Supabase:
```sql
-- Add org_id column
ALTER TABLE public.event_detections 
  ADD COLUMN org_id uuid NOT NULL;

ALTER TABLE public.event_detections
  ADD CONSTRAINT event_detections_org_id_fkey 
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add index
CREATE INDEX idx_event_detections_org ON public.event_detections(org_id);
```

Or use: `docs/sql/add_org_id_to_event_detections.sql`

### Step 2: Update Edge Functions to Use org_id (10 minutes)
**Files to modify:**
- `supabase/functions/get-event-detections/index.ts`
- `supabase/functions/trigger-event-detection/index.ts`

Both functions already get `mediaAsset.org_id` - just need to include it when writing to database.

### Step 3: Test Updated Functions (5 minutes)
Redeploy and verify org_id is being stored:
```bash
cd frontend
npx supabase functions deploy get-event-detections --no-verify-jwt
npx supabase functions deploy trigger-event-detection --no-verify-jwt
```

### Step 4: Start Phase 2 - AWS Worker Infrastructure (Main Work)

#### 4A. Create Directory Structure (2 minutes)
```bash
mkdir -p aws_workers/analysis
cd aws_workers/analysis
```

#### 4B. Symlink Shared Modules (1 minute)
```bash
ln -s ../shared shared
```

#### 4C. Create Python Worker Files (30-60 minutes)

**File 1: `requirements.txt`**
```
boto3>=1.34.0
opencv-python-headless>=4.9.0
torch>=2.1.0
torchvision>=0.16.0
ultralytics>=8.0.0  # For YOLO models
psycopg2-binary>=2.9.9
requests>=2.31.0
```

**File 2: `worker.py`** (mirror transcoding worker structure)
- Poll SQS for jobs
- Download video from Wasabi
- Extract frames
- Run CV detection model
- Store results in event_detections table
- Update job state

**File 3: `Dockerfile`**
```dockerfile
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04
# Install Python, CV dependencies
# Copy worker.py
# Set up entrypoint
```

**File 4: `task-definition.json`**
- ECS task config
- GPU instance type
- Environment variables

#### 4D. Implement CV Detection Logic (This is the complex part)

**Option 1: Simple Detection (Fast, less accurate)**
- Use pre-trained object detection (YOLO)
- Train on rugby-specific dataset (if available)
- Detect formations/patterns

**Option 2: Cloud API (Easiest, costs $$)**
- AWS Rekognition Custom Labels
- Upload labeled training data
- Use API for detection

**Option 3: Custom Model (Most accurate, most work)**
- Fine-tune existing sports model
- Train on rugby footage
- Deploy to worker

**Recommendation for Tomorrow:** Start with Option 1 (YOLO) as a proof of concept.

### Step 5: Set Up AWS Infrastructure (Manual steps)

**SQS Queue:**
```bash
aws sqs create-queue --queue-name rugbycodex-event-detection-queue
```

**ECS Task Definition:**
- Upload task-definition.json
- Configure GPU instance type
- Set environment variables

**IAM Roles:**
- Task execution role
- SQS read permissions
- Supabase credentials access

### Step 6: Test End-to-End (15 minutes)

1. Upload test video
2. Trigger event detection job via edge function
3. Worker picks up job from SQS
4. Worker processes video
5. Results appear in event_detections table
6. Query via GET edge function

---

## 🔧 Technical Decisions Needed Tomorrow

### 1. CV Model Selection
**Question:** Which detection approach?
- **Option A:** Pre-trained YOLO + custom rugby dataset (recommended for v1)
- **Option B:** AWS Rekognition Custom Labels (easiest but costs money)
- **Option C:** Custom trained model (best accuracy but most work)

**Decision Point:** Choose based on:
- Available budget
- Training data availability
- Desired accuracy

### 2. Frame Sampling Rate
**Question:** How often to sample frames?
- Every 1 second = 1800 frames for 30-min video (slower, more accurate)
- Every 2 seconds = 900 frames (faster, might miss events)
- Every 5 seconds = 360 frames (fast, less accurate)

**Recommendation:** Start with 2 seconds, tune based on results.

### 3. Detection Confidence Threshold
**Question:** What confidence score to store?
- Store all detections >= 0.5 confidence
- Let UI filter by confidence
- Users can adjust threshold in real-time

### 4. GPU Instance Type
**Question:** Which AWS instance for ECS?
- g4dn.xlarge (cheapest GPU, ~$0.50/hr)
- g5.xlarge (newer, faster, ~$1.00/hr)
- Spot instances (cheaper but can be interrupted)

**Recommendation:** Start with g4dn.xlarge spot instances.

---

## 📝 Phase 2 Checklist for Tomorrow

- [ ] **Database:** Add org_id column to event_detections
- [ ] **Database:** Test org_id constraint works
- [ ] **Edge Functions:** Update to use org_id
- [ ] **Edge Functions:** Redeploy and test
- [ ] **AWS:** Create analysis worker directory structure
- [ ] **AWS:** Write requirements.txt
- [ ] **AWS:** Create worker.py skeleton (polling + job lifecycle)
- [ ] **AWS:** Implement frame extraction logic
- [ ] **AWS:** Choose and integrate CV model
- [ ] **AWS:** Implement detection logic
- [ ] **AWS:** Store results in database
- [ ] **AWS:** Create Dockerfile
- [ ] **AWS:** Create task-definition.json
- [ ] **AWS:** Set up SQS queue
- [ ] **AWS:** Configure ECS task
- [ ] **AWS:** Test worker locally (if possible)
- [ ] **AWS:** Deploy and test end-to-end

---

## 🎓 Key Concepts to Remember

### Multi-Tenancy (org_id)
- **Every table needs org_id** for proper data isolation
- Matches your existing pattern (narrations, jobs, media_assets all have org_id)
- Enables org-scoped queries and RLS policies

### Job Lifecycle
```
1. User triggers job (edge function)
   → Creates job record with state='queued'
   
2. Edge function sends message to SQS
   → Message contains: {job_id, media_id, org_id}
   
3. AWS Worker polls SQS
   → Receives message
   → Updates job state='running'
   
4. Worker processes video
   → Downloads from Wasabi
   → Runs CV detection
   → Stores results in event_detections
   
5. Worker completes
   → Updates job state='succeeded'
   → Deletes SQS message
```

### Why Separate event_detections from segment_tags?
- **event_detections:** AI-generated, has confidence scores, can be bulk-deleted
- **segment_tags:** Human-created, trusted source, manually curated
- **Clean separation:** Easy to show "AI detected X events, manually tagged Y segments"

---

## 📚 Files Reference

### Created Today:
```
docs/sql/
  ├── event_detections_schema.sql (main schema)
  ├── add_event_detection_job_type.sql (job enum)
  └── add_org_id_to_event_detections.sql (migration)

frontend/src/modules/events/
  ├── types/
  │   └── EventDetection.ts (TypeScript types)
  └── services/
      └── eventDetectionService.ts (API layer)

frontend/supabase/functions/
  ├── get-event-detections/
  │   └── index.ts (fetch detections)
  └── trigger-event-detection/
      └── index.ts (create jobs)

frontend/supabase/config.toml (updated with new functions)
SCHEMA_REFERENCE.md (updated)
```

### To Create Tomorrow:
```
aws_workers/analysis/
  ├── worker.py (main worker logic)
  ├── requirements.txt (Python dependencies)
  ├── Dockerfile (container image)
  ├── task-definition.json (ECS config)
  └── shared/ (symlink to ../shared)
```

---

## 💭 Questions to Answer Tomorrow

1. **Do we have access to rugby training data** for CV model?
2. **What's the budget** for GPU instances? (affects instance type choice)
3. **How important is accuracy vs speed?** (affects sampling rate)
4. **Should detection be automatic** after transcode, or manual trigger only?
5. **What model version naming scheme** should we use? (e.g., "rugby-yolo-v1.0")

---

## 🎯 Success Criteria for Tomorrow

**Phase 2 Complete When:**
- [ ] Worker can poll SQS queue
- [ ] Worker can download video from Wasabi
- [ ] Worker can extract frames
- [ ] Worker can detect at least 1 event type (even if inaccurate)
- [ ] Worker can write results to event_detections table
- [ ] Worker updates job state correctly
- [ ] End-to-end flow works: trigger → process → store → query

**Don't Need Perfect Accuracy Yet!** Just need the pipeline working. We can tune the model later.

---

## 📞 Resources for Tomorrow

**YOLO Documentation:**
- https://docs.ultralytics.com/

**AWS ECS + GPU:**
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-gpu.html

**OpenCV Frame Extraction:**
- https://docs.opencv.org/4.x/dd/d43/tutorial_py_video_display.html

**Similar Projects (for inspiration):**
- Sports event detection: https://github.com/topics/sports-analytics
- Video event detection: https://github.com/topics/event-detection

---

**Created:** 2026-01-26 Evening  
**Last Updated:** 2026-01-26 Evening  
**Next Session:** Tomorrow Morning - Phase 2 Implementation
