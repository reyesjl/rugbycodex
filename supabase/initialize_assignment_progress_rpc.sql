-- RPC Function: Initialize Assignment Progress Rows
-- Creates progress rows for all intended recipients of an assignment
-- Called immediately after assignment creation

CREATE OR REPLACE FUNCTION public.initialize_assignment_progress(p_assignment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_recipient_count INT := 0;
  v_inserted_count INT := 0;
BEGIN
  -- Get the assignment's org_id for security check
  SELECT org_id INTO v_org_id
  FROM assignments
  WHERE id = p_assignment_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found: %', p_assignment_id;
  END IF;

  -- Expand all targets to get recipient profile_ids and insert progress rows
  -- Uses a CTE to deduplicate recipients (in case of overlapping targets)
  WITH recipients AS (
    SELECT DISTINCT
      CASE
        -- Player: direct profile_id
        WHEN at.target_type = 'player' THEN at.target_id
        
        -- Group: expand via group_members
        WHEN at.target_type = 'group' THEN gm.profile_id
        
        -- Team: expand via org_members
        WHEN at.target_type = 'team' THEN om.user_id
      END AS profile_id
    FROM assignment_targets at
    LEFT JOIN group_members gm ON at.target_type = 'group' AND at.target_id = gm.group_id
    LEFT JOIN org_members om ON at.target_type = 'team' AND om.org_id = v_org_id
    WHERE at.assignment_id = p_assignment_id
      AND (
        -- Ensure we have a valid profile_id for each case
        (at.target_type = 'player' AND at.target_id IS NOT NULL)
        OR (at.target_type = 'group' AND gm.profile_id IS NOT NULL)
        OR (at.target_type = 'team' AND om.user_id IS NOT NULL)
      )
  )
  SELECT COUNT(*) INTO v_recipient_count FROM recipients;

  -- Insert progress rows for all recipients (completed=false initially)
  WITH recipients AS (
    SELECT DISTINCT
      CASE
        WHEN at.target_type = 'player' THEN at.target_id
        WHEN at.target_type = 'group' THEN gm.profile_id
        WHEN at.target_type = 'team' THEN om.user_id
      END AS profile_id
    FROM assignment_targets at
    LEFT JOIN group_members gm ON at.target_type = 'group' AND at.target_id = gm.group_id
    LEFT JOIN org_members om ON at.target_type = 'team' AND om.org_id = v_org_id
    WHERE at.assignment_id = p_assignment_id
      AND (
        (at.target_type = 'player' AND at.target_id IS NOT NULL)
        OR (at.target_type = 'group' AND gm.profile_id IS NOT NULL)
        OR (at.target_type = 'team' AND om.user_id IS NOT NULL)
      )
  ),
  inserted AS (
    INSERT INTO assignment_progress (assignment_id, profile_id, completed, completed_at)
    SELECT 
      p_assignment_id,
      r.profile_id,
      false,
      NULL
    FROM recipients r
    WHERE r.profile_id IS NOT NULL
    ON CONFLICT (assignment_id, profile_id) DO NOTHING  -- Skip if already exists
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  -- Return summary
  RETURN json_build_object(
    'assignment_id', p_assignment_id,
    'expected_recipients', v_recipient_count,
    'rows_inserted', v_inserted_count,
    'success', true
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'assignment_id', p_assignment_id,
      'error', SQLERRM,
      'success', false
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.initialize_assignment_progress(UUID) TO authenticated;

COMMENT ON FUNCTION public.initialize_assignment_progress IS 
'Initializes progress tracking rows for all intended recipients of an assignment. 
Expands player/group/team targets and creates progress rows with completed=false.';
