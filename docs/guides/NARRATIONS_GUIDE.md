# Rugbycodex Narrations Guide

## What Are Narrations?

Narrations are voice recordings that coaches, staff, and team members can add to specific moments in match footage. They allow you to provide commentary, analysis, and feedback directly on the video timeline.

## Key Concepts

### Segments
- **Segments** are time-bounded sections of a video (e.g., 2:15 - 2:45)
- Each segment can have multiple narrations from different people
- Segments are automatically created when you record or manually created by coaches

### Narrations
- **Narrations** are voice recordings attached to segments
- Each narration includes:
  - Audio recording of your voice
  - Automatic text transcription
  - Timestamp
  - Author information

## How to Add a Narration

### Method 1: Quick Record (Floating Button)
1. Watch the video to the moment you want to comment on
2. Click the **floating microphone button**
3. Speak your commentary (minimum 0.5 seconds)
4. Click **stop** when done

**What happens:**
- System checks if a segment exists at that time
- If overlap is sufficient (≥50% of either recording or segment), attaches to existing segment
- If not, creates a new segment with context buffers

### Method 2: Targeted Record (Segment Card)
1. Find the segment in the narrations list
2. Click the **"Add"** button on that specific segment
3. Record your narration
4. Click **stop** when done

**What happens:**
- Narration is ALWAYS attached to that specific segment
- Segment extends by up to 6 seconds if your recording goes beyond its end time

## The Smart Attachment System

### When Does a Recording Attach to an Existing Segment?

**Rule**: At least **50% of EITHER your recording OR the segment** must overlap, with a **minimum of 2 seconds**.

This dual threshold handles both short recordings on long segments and long recordings on short segments.

#### Understanding Threshold vs Actual Overlap

**Important**: The formula calculates the **minimum requirement** to attach, not the actual overlap amount.

- **Threshold**: The minimum seconds of overlap needed for attachment
- **Actual Overlap**: How many seconds of your recording are actually inside the segment (depends on where you record)

For example, a 3s recording on a 60s segment needs **at least 2s overlap** to attach. But the actual overlap could be:
- 0s (recording completely outside) → ❌ doesn't attach
- 1s (recording barely touches) → ❌ doesn't attach
- 2s (recording has 2s inside) → ✅ attaches (meets threshold)
- 3s (recording fully inside) → ✅ attaches (exceeds threshold)

#### The Formula:
```
Minimum Required Overlap = max(
  2 seconds,                           // Absolute minimum
  min(
    50% of recording duration,
    50% of segment duration
  )
)
```

#### Examples:

**✅ Attaches - Recording Inside Segment:**
```
Existing Segment: 1:40 - 2:10 (30s)
Your Recording:   1:50 - 1:58 (8s)
Overlap:          8 seconds
Required:         4 seconds (50% of 8s recording)
Result:           ✅ Attaches (8s > 4s needed)
```

**✅ Attaches - Long Recording, Short Segment:**
```
Existing Segment: 2:00 - 2:10 (10s)
Your Recording:   1:55 - 2:15 (20s)
Overlap:          10 seconds
Required:         5 seconds (50% of 10s segment, not 10s recording!)
Result:           ✅ Attaches (10s > 5s needed)
```

**✅ Attaches - Equal Durations:**
```
Existing Segment: 1:40 - 1:50 (10s)
Your Recording:   1:45 - 1:55 (10s)
Overlap:          5 seconds
Required:         5 seconds (50% of either 10s)
Result:           ✅ Attaches (exactly 50%)
```

**❌ Creates New - Insufficient Overlap:**
```
Existing Segment: 1:40 - 2:10 (30s)
Your Recording:   2:08 - 2:18 (10s)
Overlap:          2 seconds
Required:         5 seconds (50% of 10s recording)
Result:           ❌ Creates new segment (2s < 5s needed)
```

**❌ Creates New - Below 2s Minimum:**
```
Existing Segment: 1:40 - 2:10 (30s)
Your Recording:   2:09 - 2:10 (1s)
Overlap:          1 second
Required:         2 seconds (absolute minimum)
Result:           ❌ Creates new segment (below 2s floor)
```

**Understanding Placement - Same Recording, Different Results:**
```
Existing Segment: 1:00 - 2:00 (60s)
Your Recording:   3 seconds long

Scenario A: Record at 1:25-1:28
  Overlap: 3 seconds (fully inside)
  Required: 2 seconds
  Result: ✅ ATTACHES (3s > 2s)

Scenario B: Record at 1:59-2:02
  Overlap: 1 second (only 1:59-2:00 is inside)
  Required: 2 seconds
  Result: ❌ CREATES NEW (1s < 2s)

Key: Same recording length, but placement determines actual overlap!
```

### Multiple Segments Overlap?

If your recording overlaps with multiple segments, the system chooses the **best match** using this priority:

1. **Most overlap seconds** (primary factor)
2. **Most narrations** (if overlap is equal, picks the "hotspot")
3. **Highest source priority** (coach > staff > member > auto)

#### Example:
```
Segment A (Coach):  1:30 - 2:00, 5 narrations
Segment B (Member): 1:45 - 2:15, 2 narrations

Your Recording:     1:50 - 2:00 (10s)

Overlap A: 10 seconds
Overlap B: 10 seconds

Result: Attaches to Segment A (equal overlap, more narrations)
```

## Segment Sizing Rules

When creating a new segment, the system adds buffer time for context:

### Formula:
```
Segment Start = Recording Start - 3 seconds (pre-buffer)
Segment End   = Recording End + 5 seconds (post-buffer)
Target Length = clamp(max(10s, recording duration * 1.8), 10s, 60s)
Final Length  = max(pre+recording+post, target length), clamped to media duration
```

### Examples:

**Short Recording (2s):**
```
Recording:    2:00 - 2:02 (2s)
Buffers:      1:57 - 2:07 (10s)
Target:       10s
Final Segment: 1:57 - 2:07 (10s)
```

**Medium Recording (15s):**
```
Recording:    2:00 - 2:15 (15s)
Buffers:      1:57 - 2:20 (23s)
Target:       27s (1.8x)
Final Segment: 1:57 - 2:24 (27s)
```

**Long Recording (30s):**
```
Recording:    2:00 - 2:30 (30s)
Buffers:      1:57 - 2:35 (38s)
Target:       54s (1.8x)
Final Segment: 1:57 - 2:51 (54s)
```

## Recording Requirements

### Minimum Duration
- **Minimum**: 0.5 seconds
- Prevents accidental empty narrations
- System rejects recordings shorter than this

### No Maximum Duration
- Record as long as needed
- Segments target up to 60s, but still expand as needed to include the recording (clamped to media duration)
- If a recording exceeds 90s, you will see a toast: "Long narrations will be processed in chunks"

## Common Scenarios

### Scenario 1: First Narration on a Moment
```
Situation: You're the first to comment on a play at 5:23
Action:    Record 8 seconds of commentary
Result:    New segment created (5:18 - 5:43)
           Your narration attached
```

### Scenario 2: Adding to Existing Commentary
```
Situation: Coach already commented on a tackle at 3:45-4:15
Action:    You record 6 seconds at 3:50
Result:    Your narration attaches to existing segment
           Segment now has 2 narrations
```

### Scenario 3: Extended Recording
```
Situation: Segment exists at 2:00-2:30
Action:    Record from 2:25-2:40 (goes beyond segment)
Result:    Narration attaches to existing segment
           Segment extends by up to 6 seconds (to ~2:36)
```

### Scenario 4: Fragmentation Warning
```
Situation: Segment exists at 4:10-4:40
Action:    Record 10s at 4:12 (90% overlap)
Result:    New segment created (as attachment failed)
           ⚠️ Warning: "This moment overlaps 90% with an existing segment"
           Tip: Use "Add" button on existing segment instead
```

## Permissions & Source Types

### Source Types
Narrations are tagged with a source type based on your role:

- **Coach**: Owners and managers → "coach" source type
- **Staff**: Staff members → "staff" source type  
- **Member**: Team members → "member" source type

### What You Can Do
Depends on your organization role:

**Members** can:
- ✅ Record narrations
- ✅ View all narrations
- ✅ Edit own narrations
- ✅ Delete own narrations

**Staff** can:
- ✅ Everything members can do
- ✅ Edit any narration
- ✅ Delete any narration
- ✅ Tag segments
- ✅ Assign segments to players

**Coaches/Owners** can:
- ✅ Everything staff can do
- ✅ Full moderation capabilities

## Filtering & Search

### Filter by Source
Use the filter dropdown to view:
- **All**: See narrations from everyone
- **Coach**: Only coach/manager commentary
- **Staff**: Only staff commentary
- **Member**: Only team member commentary

### Search Narrations
Use the search box to find narrations by:
- Keyword in transcript
- Semantic similarity (AI-powered)

## Best Practices

### Do's ✅
- **Be concise**: 5-15 seconds is ideal for most comments
- **Use existing segments**: Click "Add" on segment cards when possible
- **Review before recording**: Position video at the right moment
- **Speak clearly**: Improves automatic transcription quality

### Don'ts ❌
- **Don't rapid-fire record**: Multiple quick recordings create fragmented segments
- **Don't record in silence**: System prevents <0.5s recordings anyway
- **Don't overlap heavily**: If warning appears, use existing segment instead

## Troubleshooting

### "Recording too short"
**Problem**: Recording was less than 0.5 seconds  
**Solution**: Press record, speak, then stop (not immediate click)

### "This moment overlaps 80%+ with existing segment"
**Problem**: You created a new segment very close to an existing one  
**Solution**: Use the "Add" button on the existing segment card instead

### Narration not appearing after recording
**Problem**: Filter settings might be hiding it  
**Solution**: Check source filter - set to "All" to see everything

### Transcription shows "Uploading..."
**Problem**: Network slow or transcription taking time  
**Solution**: Wait up to 60 seconds; system has timeout protection

### Multiple segments at same time
**Problem**: Rapid recordings created overlapping segments  
**Solution**: Delete unwanted segments (staff/coach only) or add narrations to preferred segment

## Technical Details

### Audio Processing Pipeline
1. Audio recorded in browser (WebM/Opus format)
2. Uploaded to edge function
3. Transcribed using Whisper AI
4. Narration record created in database
5. Audio stored in cloud storage

### Transcription
- **Language**: Auto-detected (primarily English)
- **Accuracy**: ~95% for clear speech
- **Editable**: Staff can edit transcription text after creation

### Storage
- Audio stored in organization's storage bucket
- Transcriptions stored in database
- Searchable via text and semantic similarity

## FAQ

**Q: Can I edit a narration after recording?**  
A: Text transcription can be edited by staff. Audio cannot be edited - record again if needed.

**Q: What happens if I navigate away while recording?**  
A: Recording stops automatically; no narration is created.

**Q: Can I delete a segment?**  
A: Staff can delete empty segments. Segments with narrations are protected.

**Q: Why did my recording create a new segment instead of attaching?**  
A: Insufficient overlap - the system requires at least 50% of either your recording OR the segment to overlap, with a minimum of 2 seconds. For example, a 10s recording needs 5s overlap, and a 30s segment needs 15s overlap (the smaller threshold applies).

**Q: Can I record while video is playing?**  
A: Yes! Recording captures time based on when you start, not when video plays.

**Q: Is there a maximum recording length?**  
A: No hard limit. Segments target up to 60s but will still expand to include the recording (clamped to media duration), and recordings over 90s show a toast noting they will be processed in chunks.

**Q: Can multiple people record simultaneously?**  
A: Yes, each creates their own narration. System handles concurrent uploads.

**Q: What happens to segments with no narrations?**  
A: They appear in "empty segments" view and can be deleted by staff to clean up.

---

## Summary

**Narrations** let you add voice commentary to specific moments in match footage. The system intelligently attaches your recording to existing segments when there's sufficient overlap (≥50% of either the recording or segment, minimum 2s), or creates new segments with context buffers and a target length that scales with narration duration. This creates a collaborative annotation layer over your match videos, making review and feedback more efficient and engaging.

For technical implementation details, see `/docs` folder.
