-- Debug queries for get_org_stats
-- Replace 'YOUR_ORG_ID' with actual org_id you're testing

-- 1. Check total media_assets for the org (all kinds)
SELECT 
  id,
  file_name,
  kind,
  status,
  created_at
FROM media_assets
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC;

-- 2. Check only 'match' kind
SELECT COUNT(*) as total_matches
FROM media_assets
WHERE org_id = 'YOUR_ORG_ID'
  AND kind = 'match';

-- 3. Check if there are other kinds
SELECT 
  kind,
  COUNT(*) as count
FROM media_assets
WHERE org_id = 'YOUR_ORG_ID'
GROUP BY kind;

-- 4. Check narrations
SELECT COUNT(n.id) as total_narrations
FROM narrations n
INNER JOIN media_assets ma ON ma.id = n.media_asset_id
WHERE ma.org_id = 'YOUR_ORG_ID'
  AND ma.kind = 'match';

-- 5. Check narrations by match
SELECT 
  ma.file_name,
  ma.kind,
  COUNT(n.id) as narration_count
FROM media_assets ma
LEFT JOIN narrations n ON n.media_asset_id = ma.id
WHERE ma.org_id = 'YOUR_ORG_ID'
GROUP BY ma.id, ma.file_name, ma.kind
ORDER BY narration_count DESC;

-- 6. Test the actual RPC function
SELECT get_org_stats('YOUR_ORG_ID');
