-- Migration Script: Backfill Assignment Progress for Existing Assignments
-- Run this AFTER deploying initialize_assignment_progress RPC function
-- This creates progress rows for all existing assignments that don't have full coverage

DO $$
DECLARE
  v_assignment RECORD;
  v_result JSON;
  v_total_assignments INT := 0;
  v_successful INT := 0;
  v_failed INT := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of assignment progress rows...';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE '';

  -- Count total assignments to process
  SELECT COUNT(*) INTO v_total_assignments
  FROM assignments;
  
  RAISE NOTICE 'Found % assignments to process', v_total_assignments;
  RAISE NOTICE '';

  -- Process each assignment
  FOR v_assignment IN 
    SELECT id, title, org_id, created_at
    FROM assignments
    ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Call the initialize function for this assignment
      SELECT initialize_assignment_progress(v_assignment.id) INTO v_result;
      
      IF (v_result->>'success')::boolean = true THEN
        v_successful := v_successful + 1;
        RAISE NOTICE '[SUCCESS] Assignment "%" (%) - Inserted % rows for % expected recipients',
          v_assignment.title,
          v_assignment.id,
          v_result->>'rows_inserted',
          v_result->>'expected_recipients';
      ELSE
        v_failed := v_failed + 1;
        RAISE WARNING '[FAILED] Assignment "%" (%) - Error: %',
          v_assignment.title,
          v_assignment.id,
          v_result->>'error';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING '[ERROR] Assignment "%" (%) - Exception: %',
        v_assignment.title,
        v_assignment.id,
        SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== BACKFILL COMPLETE ===';
  RAISE NOTICE 'Total assignments: %', v_total_assignments;
  RAISE NOTICE 'Successful: %', v_successful;
  RAISE NOTICE 'Failed: %', v_failed;
  RAISE NOTICE 'Timestamp: %', NOW();
  
END $$;

-- Verify results
DO $$
DECLARE
  v_stats RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  
  -- Count assignments with no progress rows (should be 0 after backfill)
  SELECT 
    COUNT(*) FILTER (WHERE progress_count = 0) as assignments_without_progress,
    COUNT(*) as total_assignments,
    SUM(progress_count) as total_progress_rows
  INTO v_stats
  FROM (
    SELECT 
      a.id,
      COUNT(ap.profile_id) as progress_count
    FROM assignments a
    LEFT JOIN assignment_progress ap ON ap.assignment_id = a.id
    GROUP BY a.id
  ) sub;
  
  RAISE NOTICE 'Assignments without progress rows: %', v_stats.assignments_without_progress;
  RAISE NOTICE 'Total assignments: %', v_stats.total_assignments;
  RAISE NOTICE 'Total progress rows created: %', v_stats.total_progress_rows;
  
  IF v_stats.assignments_without_progress > 0 THEN
    RAISE WARNING 'WARNING: % assignments still have no progress rows!', v_stats.assignments_without_progress;
  ELSE
    RAISE NOTICE 'SUCCESS: All assignments have progress rows!';
  END IF;
END $$;
