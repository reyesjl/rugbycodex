-- Debug query for incomplete assignments
-- Run this in Supabase SQL Editor to see what's happening

-- Replace with your actual org_id
\set org_id '95d7b8b6-ad5b-4b92-9fec-85ac677120ea'

-- 1. List all assignments
SELECT 
  a.id,
  a.title,
  a.due_at,
  a.created_at,
  -- Count progress records
  (SELECT COUNT(*) FROM assignment_progress ap WHERE ap.assignment_id = a.id) as progress_count,
  -- Count completed progress
  (SELECT COUNT(*) FROM assignment_progress ap WHERE ap.assignment_id = a.id AND ap.completed = true) as completed_count,
  -- Count incomplete progress
  (SELECT COUNT(*) FROM assignment_progress ap WHERE ap.assignment_id = a.id AND ap.completed = false) as incomplete_count
FROM assignments a
WHERE a.org_id = '95d7b8b6-ad5b-4b92-9fec-85ac677120ea'
ORDER BY a.created_at DESC;

-- 2. Check what our current logic would count
SELECT COUNT(DISTINCT a.id) as incomplete_assignments_count
FROM assignments a
WHERE a.org_id = '95d7b8b6-ad5b-4b92-9fec-85ac677120ea'
  AND (
    -- No progress at all
    NOT EXISTS (
      SELECT 1
      FROM assignment_progress ap
      WHERE ap.assignment_id = a.id
    )
    OR
    -- Has at least one incomplete progress
    EXISTS (
      SELECT 1
      FROM assignment_progress ap
      WHERE ap.assignment_id = a.id
        AND ap.completed = false
    )
  );

-- 3. Show which assignments would be counted
SELECT 
  a.id,
  a.title,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM assignment_progress ap WHERE ap.assignment_id = a.id) 
      THEN 'No progress (not started)'
    WHEN EXISTS (SELECT 1 FROM assignment_progress ap WHERE ap.assignment_id = a.id AND ap.completed = false)
      THEN 'Has incomplete progress'
    ELSE 'Fully complete (excluded)'
  END as status,
  -- Show actual progress records
  (SELECT json_agg(json_build_object('profile_id', profile_id, 'completed', completed))
   FROM assignment_progress 
   WHERE assignment_id = a.id) as progress_records
FROM assignments a
WHERE a.org_id = '95d7b8b6-ad5b-4b92-9fec-85ac677120ea'
ORDER BY a.created_at DESC;

-- 4. Test the RPC function
SELECT get_org_stats('95d7b8b6-ad5b-4b92-9fec-85ac677120ea');
