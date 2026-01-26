# Event Detection: Cost & Architecture Analysis

## Option 1: Separate Worker (Current Plan)
```
Transcode Job                    Event Detection Job
     ↓                                    ↓
Download from Wasabi            Download from Wasabi (again)
     ↓                                    ↓
Transcode to HLS                Extract frames → CV detection
     ↓                                    ↓
Upload HLS segments             Store detections in DB
```

**Pros:**
- ✅ Keep transcoding stable (it works perfectly)
- ✅ Event detection can fail without blocking video playback
- ✅ Run event detection on-demand (coaches can trigger manually)
- ✅ Can scale independently (different instance types)
- ✅ Easy to retry just detection if it fails
- ✅ Simpler to develop and debug

**Cons:**
- ❌ Downloads video twice from Wasabi (egress cost)
- ❌ Slightly longer total time
- ❌ Two separate infrastructure pieces

**Costs (per 1-hour match video @ 2GB):**
- Transcoding: 10 min @ g4dn.xlarge spot ($0.158/hr) = **$0.026**
- Event Detection: 20 min @ g4dn.xlarge spot = **$0.053**
- Wasabi egress (2 downloads): **$0.04**
- **Total: ~$0.12 per video**

---

## Option 2: Combined Worker (Optimization)
```
Single Job
     ↓
Download from Wasabi (once)
     ↓
Transcode to HLS ──────┐
     ↓                 │
Upload HLS             │ (video still on disk)
     ↓                 │
Extract frames ←───────┘
     ↓
CV detection
     ↓
Store detections in DB
```

**Pros:**
- ✅ Download video only once (saves egress)
- ✅ Video already on disk, no re-download time
- ✅ Single job to manage
- ✅ Slightly faster overall (no second download)

**Cons:**
- ❌ Transcoding blocked if detection fails
- ❌ Can't trigger detection without re-transcoding
- ❌ Harder to debug (mixed concerns)
- ❌ If detection takes too long, delays video availability
- ❌ More complex worker code
- ❌ Harder to scale independently

**Costs (per 1-hour match video @ 2GB):**
- Combined job: 25 min @ g4dn.xlarge spot = **$0.066**
- Wasabi egress (1 download): **$0.02**
- **Total: ~$0.086 per video**

**Savings: $0.034 per video** (3.4 cents)

---

## Cost Projections

### Scenario 1: 100 videos/month
| Item | Separate Workers | Combined Worker | Savings |
|------|------------------|-----------------|---------|
| GPU compute | $7.90 | $6.60 | $1.30 |
| Wasabi egress | $4.00 | $2.00 | $2.00 |
| **Total/month** | **$11.90** | **$8.60** | **$3.30** |

### Scenario 2: 500 videos/month
| Item | Separate Workers | Combined Worker | Savings |
|------|------------------|-----------------|---------|
| GPU compute | $39.50 | $33.00 | $6.50 |
| Wasabi egress | $20.00 | $10.00 | $10.00 |
| **Total/month** | **$59.50** | **$43.00** | **$16.50** |

### Scenario 3: 1000 videos/month (heavy usage)
| Item | Separate Workers | Combined Worker | Savings |
|------|------------------|-----------------|---------|
| GPU compute | $79.00 | $66.00 | $13.00 |
| Wasabi egress | $40.00 | $20.00 | $20.00 |
| **Total/month** | **$119.00** | **$86.00** | **$33.00** |

---

## Implementation Timeline

### Option 1: Separate Worker (Recommended to start)
**Phase 2: Basic Pipeline**
- Day 1-2: Worker structure, polling, job management (6-8 hours)
- Day 3-4: CV model integration, frame extraction (6-8 hours)
- Day 5: Testing, debugging, deployment (4-6 hours)
- **Total: 3-5 days** (~16-22 hours of work)

**Phase 3-7: UI + Polish**
- Day 6-8: Frontend UI v2, filtering, navigation (8-12 hours)
- Day 9-10: End-to-end testing, refinement (4-6 hours)
- **Total: 8-10 days** for complete feature

### Option 2: Combined Worker
**Phase 2: Modify Existing Worker**
- Day 1-2: Add CV detection to transcoding worker (8-10 hours)
- Day 3: Test that transcoding still works (2-4 hours)
- Day 4: Debug mixed concerns, edge cases (4-6 hours)
- **Total: 4-6 days** (~14-20 hours)
- **Risk: Higher** (might break working transcoding)

---

## Recommendation

### Start with Separate Worker (Option 1)

**Why:**
1. **Cost difference is minimal** at your current scale (~$3-16/month)
2. **Lower risk** - doesn't touch working transcoding
3. **Flexibility** - coaches can trigger on-demand
4. **Faster to market** - simpler to develop
5. **Easier to iterate** - can tune detection without affecting playback
6. **Better separation of concerns** - transcoding is critical path

### When to Optimize (Option 2)
Consider combining workers when:
- Processing **>1000 videos/month** (savings become significant)
- Detection model is stable (not changing frequently)
- Want to auto-detect on every upload
- Cost optimization is high priority

**Easy to migrate later:**
```python
# In transcoding worker, after HLS upload:
if os.environ.get("ENABLE_EVENT_DETECTION") == "true":
    run_event_detection(input_file)  # Video already on disk
```

---

## Wasabi Egress Optimization Tip

If egress becomes a concern, you can:
1. **Cache video on worker EBS volume** (e.g., 100GB volume)
2. **Keep recent videos** for 24 hours
3. **Check cache before downloading**
4. **Still works if cache miss**

This gives you the flexibility of separate workers with lower egress on frequently analyzed videos.

---

## Development Phases (Separate Worker Approach)

### This Week:
- **Day 1 (Tomorrow):** Worker structure + polling (4 hours)
- **Day 2:** Frame extraction + simple detection (4 hours)
- **Day 3:** Store results + test end-to-end (2 hours)
- **Deliverable:** Working pipeline with basic detection

### Next Week:
- **Day 4-5:** Improve detection accuracy
- **Day 6-7:** Frontend UI v2
- **Day 8:** Integration testing
- **Deliverable:** Production-ready v1

### Future Optimization (Optional):
- Combine workers to save costs (1-2 days)
- Add caching layer (1 day)
- Implement batch processing (1 day)

---

## Break-Even Analysis

**When does combined worker pay off?**

Development cost (labor):
- Separate: 3-5 days
- Combined: 4-6 days (modifying existing worker)
- **Extra effort: 1-2 days** (~$500-1000 in dev time)

Monthly savings:
- 100 videos: $3.30/month → **15-30 months to break even**
- 500 videos: $16.50/month → **3-6 months to break even**
- 1000 videos: $33/month → **1.5-3 months to break even**

**Conclusion:** Only worth combining if you expect **>500 videos/month**.

---

## My Recommendation: Start Separate, Optimize Later

1. **Build separate worker** (lower risk, faster to market)
2. **Launch to coaches** and get feedback
3. **Monitor usage** (how many videos/month?)
4. **If >500 videos/month**, invest 1-2 days to combine workers
5. **Savings will pay for optimization** in 3-6 months

**Best of both worlds:**
- Fast development
- Low risk
- Easy optimization path
- Data-driven decision

---

**Decision Point:** Do we proceed with separate worker, or do you want to combine from the start?
