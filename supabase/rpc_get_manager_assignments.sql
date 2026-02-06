-- =====================================================
-- Manager Assignments RPC Function
-- =====================================================
-- Purpose: Efficiently fetch assignments for org managers with all related data
-- Returns: Assignment details with targets, completion stats, and segment counts
-- Performance: Replaces 6+ separate queries with a single optimized query
-- Security: SECURITY DEFINER to allow managers to see assignment data

CREATE OR REPLACE FUNCTION rpc_get_manager_assignments(
  p_org_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  assignment_id uuid,
  assignment_title text,
  assignment_description text,
  assignment_due_at timestamptz,
  assignment_created_at timestamptz,
  assignment_created_by uuid,
  segment_count int,
  completion_count int,
  total_assigned int,
  last_completed_at timestamptz,
  target_type text,
  target_id uuid,
  target_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH assignment_list AS (
    -- Get the most recent assignments for the org
    SELECT 
      a.id,
      a.title,
      a.description,
      a.due_at,
      a.created_at,
      a.created_by
    FROM assignments a
    WHERE a.org_id = p_org_id
    ORDER BY a.created_at DESC
    LIMIT p_limit
  ),
  
  assignment_segments_count AS (
    -- Count segments per assignment
    SELECT 
      aseg.assignment_id,
      COUNT(*)::int as segment_count
    FROM assignment_segments aseg
    WHERE aseg.assignment_id IN (SELECT id FROM assignment_list)
    GROUP BY aseg.assignment_id
  ),
  
  assignment_completions AS (
    -- Count completions and get last completed date per assignment
    SELECT 
      ap.assignment_id,
      COUNT(*)::int as completion_count,
      MAX(ap.completed_at) as last_completed_at
    FROM assignment_progress ap
    WHERE ap.assignment_id IN (SELECT id FROM assignment_list)
      AND ap.completed = true
    GROUP BY ap.assignment_id
  ),
  
  org_member_count AS (
    -- Get total org members for team-wide calculations
    SELECT COUNT(*)::int as total_members
    FROM org_members om
    WHERE om.org_id = p_org_id
  ),
  
  group_member_counts AS (
    -- Count members per group
    SELECT 
      gm.group_id,
      COUNT(*)::int as member_count
    FROM group_members gm
    WHERE gm.group_id IN (
      SELECT DISTINCT at.target_id 
      FROM assignment_targets at
      WHERE at.assignment_id IN (SELECT id FROM assignment_list)
        AND at.target_type = 'group'
        AND at.target_id IS NOT NULL
    )
    GROUP BY gm.group_id
  ),
  
  assignment_targets_enriched AS (
    -- Get all targets with names resolved
    SELECT 
      at.assignment_id,
      at.target_type,
      at.target_id,
      CASE
        WHEN at.target_type = 'team' THEN 'Team'
        WHEN at.target_type = 'group' THEN COALESCE(g.name, 'Unknown Group')
        WHEN at.target_type = 'player' THEN COALESCE(p.name, p.username, 'Unknown Player')
        ELSE 'Unknown'
      END as target_name,
      CASE
        WHEN at.target_type = 'team' THEN (SELECT total_members FROM org_member_count)
        WHEN at.target_type = 'group' THEN COALESCE(gmc.member_count, 0)
        WHEN at.target_type = 'player' THEN 1
        ELSE 0
      END as target_member_count
    FROM assignment_targets at
    LEFT JOIN groups g ON at.target_type = 'group' AND at.target_id = g.id
    LEFT JOIN profiles p ON at.target_type = 'player' AND at.target_id = p.id
    LEFT JOIN group_member_counts gmc ON at.target_type = 'group' AND at.target_id = gmc.group_id
    WHERE at.assignment_id IN (SELECT id FROM assignment_list)
  ),
  
  assignment_total_assigned AS (
    -- Calculate total assigned per assignment (sum of all target member counts)
    SELECT 
      ate.assignment_id,
      SUM(ate.target_member_count)::int as total_assigned
    FROM assignment_targets_enriched ate
    GROUP BY ate.assignment_id
  )
  
  -- Final result: one row per assignment-target pair
  SELECT 
    al.id as assignment_id,
    al.title as assignment_title,
    al.description as assignment_description,
    al.due_at as assignment_due_at,
    al.created_at as assignment_created_at,
    al.created_by as assignment_created_by,
    COALESCE(seg_count.segment_count, 0) as segment_count,
    COALESCE(ac.completion_count, 0) as completion_count,
    COALESCE(ata.total_assigned, 0) as total_assigned,
    ac.last_completed_at as last_completed_at,
    ate.target_type,
    ate.target_id,
    ate.target_name
  FROM assignment_list al
  LEFT JOIN assignment_segments_count seg_count ON seg_count.assignment_id = al.id
  LEFT JOIN assignment_completions ac ON ac.assignment_id = al.id
  LEFT JOIN assignment_total_assigned ata ON ata.assignment_id = al.id
  LEFT JOIN assignment_targets_enriched ate ON ate.assignment_id = al.id
  ORDER BY al.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_get_manager_assignments(uuid, int) TO authenticated;

COMMENT ON FUNCTION rpc_get_manager_assignments IS 
  'Efficiently fetches manager assignments for an organization with all related data in a single query. 
  Returns multiple rows per assignment (one per target). Frontend should group by assignment_id.';
