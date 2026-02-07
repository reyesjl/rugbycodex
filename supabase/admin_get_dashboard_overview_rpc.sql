-- =============================================
-- Admin Dashboard Overview RPC
-- =============================================
-- Purpose: 
--   Single comprehensive endpoint for admin dashboard data.
--   Returns metrics, time-series charts, attention items, and activity feed.
--
-- Security:
--   - SECURITY DEFINER: Runs with owner privileges
--   - Explicit admin check: Only allows profiles with role = 'admin'
--
-- Returns:
--   JSONB with structure:
--   {
--     metrics: { activeOrgs, activeUsers30d, narrations30d, pipelineFailures },
--     charts: { narrationsOverTime: [], mediaUploadVolume: [] },
--     attentionItems: [...],
--     recentActivity: [...]
--   }
-- =============================================

CREATE OR REPLACE FUNCTION admin_get_dashboard_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSONB;
  v_metrics JSONB;
  v_charts JSONB;
  v_attention_items JSONB;
  v_recent_activity JSONB;
  v_cutoff_30d TIMESTAMPTZ;
  v_cutoff_72h TIMESTAMPTZ;
BEGIN
  -- Check if the calling user is an admin
  SELECT (p.role = 'admin') INTO v_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Set time cutoffs
  v_cutoff_30d := NOW() - INTERVAL '30 days';
  v_cutoff_72h := NOW() - INTERVAL '72 hours';

  -- ==========================================
  -- METRICS SECTION
  -- ==========================================
  
  WITH active_orgs AS (
    -- Orgs with any activity in last 30 days (uploads, narrations, or jobs)
    SELECT DISTINCT org_id
    FROM (
      SELECT org_id FROM media_assets WHERE created_at >= v_cutoff_30d
      UNION
      SELECT org_id FROM narrations WHERE created_at >= v_cutoff_30d
      UNION
      SELECT org_id FROM jobs WHERE created_at >= v_cutoff_30d
    ) activities
  ),
  active_users AS (
    -- Unique users with activity in last 30 days
    SELECT DISTINCT user_id
    FROM (
      SELECT uploader_id AS user_id FROM media_assets WHERE created_at >= v_cutoff_30d
      UNION
      SELECT author_id AS user_id FROM narrations WHERE created_at >= v_cutoff_30d AND author_id IS NOT NULL
      UNION
      SELECT created_by AS user_id FROM jobs WHERE created_at >= v_cutoff_30d AND created_by IS NOT NULL
    ) user_activities
  ),
  narrations_30d AS (
    SELECT COUNT(*) AS count
    FROM narrations
    WHERE created_at >= v_cutoff_30d
  ),
  pipeline_failures AS (
    SELECT COUNT(*) AS count
    FROM jobs
    WHERE state = 'failed'
      AND updated_at >= v_cutoff_72h
  )
  SELECT jsonb_build_object(
    'activeOrgs', (SELECT COUNT(*) FROM active_orgs),
    'activeUsers30d', (SELECT COUNT(*) FROM active_users),
    'narrations30d', (SELECT count FROM narrations_30d),
    'pipelineFailures', (SELECT count FROM pipeline_failures)
  ) INTO v_metrics;

  -- ==========================================
  -- CHARTS SECTION
  -- ==========================================
  
  WITH narrations_trend AS (
    SELECT 
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM narrations
    WHERE created_at >= v_cutoff_30d
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  ),
  upload_trend AS (
    SELECT 
      DATE(created_at) AS date,
      COUNT(*) AS count,
      COALESCE(SUM(file_size_bytes) / 1073741824.0, 0)::NUMERIC(10,2) AS size_gb
    FROM media_assets
    WHERE created_at >= v_cutoff_30d
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  )
  SELECT jsonb_build_object(
    'narrationsOverTime', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'date', date,
        'count', count
      )), '[]'::jsonb)
      FROM narrations_trend
    ),
    'mediaUploadVolume', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'date', date,
        'count', count,
        'sizeGb', size_gb
      )), '[]'::jsonb)
      FROM upload_trend
    )
  ) INTO v_charts;

  -- ==========================================
  -- ATTENTION ITEMS SECTION
  -- ==========================================
  
  WITH failed_jobs AS (
    SELECT 
      j.id,
      j.type::text AS type,
      j.state::text AS state,
      j.error_message,
      j.updated_at,
      o.name AS org_name,
      j.org_id
    FROM jobs j
    LEFT JOIN organizations o ON j.org_id = o.id
    WHERE j.state = 'failed'
      AND j.updated_at >= v_cutoff_72h
    ORDER BY j.updated_at DESC
    LIMIT 10
  ),
  processing_failures AS (
    SELECT 
      ma.id,
      ma.file_name,
      ma.processing_stage::text AS stage,
      ma.created_at,
      o.name AS org_name,
      ma.org_id
    FROM media_assets ma
    LEFT JOIN organizations o ON ma.org_id = o.id
    WHERE ma.status = 'failed'
      AND ma.created_at >= v_cutoff_72h
    ORDER BY ma.created_at DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'failedJobs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'type', type,
        'state', state,
        'errorMessage', error_message,
        'updatedAt', updated_at,
        'orgName', org_name,
        'orgId', org_id,
        'category', 'job_failure'
      )), '[]'::jsonb)
      FROM failed_jobs
    ),
    'processingFailures', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'fileName', file_name,
        'stage', stage,
        'createdAt', created_at,
        'orgName', org_name,
        'orgId', org_id,
        'category', 'processing_failure'
      )), '[]'::jsonb)
      FROM processing_failures
    )
  ) INTO v_attention_items;

  -- ==========================================
  -- RECENT ACTIVITY FEED SECTION
  -- ==========================================
  
  WITH activity_events AS (
    -- Org created
    SELECT 
      o.id AS event_id,
      'org_created' AS event_type,
      o.name AS event_title,
      NULL AS event_subtitle,
      o.created_at AS event_time,
      o.id AS related_org_id,
      o.name AS related_org_name
    FROM organizations o
    WHERE o.created_at >= v_cutoff_30d
    
    UNION ALL
    
    -- Media uploaded
    SELECT 
      ma.id AS event_id,
      'media_uploaded' AS event_type,
      ma.file_name AS event_title,
      o.name AS event_subtitle,
      ma.created_at AS event_time,
      ma.org_id AS related_org_id,
      o.name AS related_org_name
    FROM media_assets ma
    LEFT JOIN organizations o ON ma.org_id = o.id
    WHERE ma.created_at >= v_cutoff_30d
    
    UNION ALL
    
    -- Narration generated
    SELECT 
      n.id AS event_id,
      'narration_generated' AS event_type,
      CONCAT('Narration for ', ma.file_name) AS event_title,
      o.name AS event_subtitle,
      n.created_at AS event_time,
      n.org_id AS related_org_id,
      o.name AS related_org_name
    FROM narrations n
    LEFT JOIN media_assets ma ON n.media_asset_id = ma.id
    LEFT JOIN organizations o ON n.org_id = o.id
    WHERE n.created_at >= v_cutoff_30d
    
    UNION ALL
    
    -- Job completed (successful)
    SELECT 
      j.id AS event_id,
      'job_completed' AS event_type,
      CONCAT(j.type::text, ' completed') AS event_title,
      o.name AS event_subtitle,
      j.finished_at AS event_time,
      j.org_id AS related_org_id,
      o.name AS related_org_name
    FROM jobs j
    LEFT JOIN organizations o ON j.org_id = o.id
    WHERE j.state = 'succeeded'
      AND j.finished_at >= v_cutoff_30d
    
    UNION ALL
    
    -- Job failed
    SELECT 
      j.id AS event_id,
      'job_failed' AS event_type,
      CONCAT(j.type::text, ' failed') AS event_title,
      o.name AS event_subtitle,
      j.finished_at AS event_time,
      j.org_id AS related_org_id,
      o.name AS related_org_name
    FROM jobs j
    LEFT JOIN organizations o ON j.org_id = o.id
    WHERE j.state = 'failed'
      AND j.finished_at >= v_cutoff_30d
    
    ORDER BY event_time DESC
    LIMIT 50
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', event_id,
    'type', event_type,
    'title', event_title,
    'subtitle', event_subtitle,
    'timestamp', event_time,
    'orgId', related_org_id,
    'orgName', related_org_name
  )), '[]'::jsonb)
  INTO v_recent_activity
  FROM activity_events;

  -- ==========================================
  -- BUILD FINAL RESULT
  -- ==========================================
  
  v_result := jsonb_build_object(
    'metrics', v_metrics,
    'charts', v_charts,
    'attentionItems', v_attention_items,
    'recentActivity', v_recent_activity,
    'generatedAt', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_dashboard_overview() TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_get_dashboard_overview IS 
'Admin-only function that returns comprehensive dashboard overview including metrics, charts, attention items, and recent activity.';

-- Example query:
-- SELECT admin_get_dashboard_overview();
