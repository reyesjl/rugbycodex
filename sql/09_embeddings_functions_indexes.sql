-- Embeddings index helper functions (IVFFLAT/HNSW)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_embeddings_ivfflat_index') THEN
    CREATE OR REPLACE FUNCTION create_embeddings_ivfflat_index(p_index_name TEXT, p_version INT, p_lists INT DEFAULT 100)
    RETURNS VOID
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      idx_name TEXT := format('emb_%s_v%s_ivf_idx', regexp_replace(p_index_name, '\\W+', '_', 'g'), p_version);
      sql TEXT;
    BEGIN
      -- Ensure there is data with the target predicate (avoids empty index on dev)
      sql := format($SQL$
        DO $blk$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM embeddings
            WHERE index_name = %L AND version = %s
          ) THEN
            RAISE NOTICE 'No embeddings yet for (index_name=%, version=%); skipping index creation', %L, %s;
          ELSE
            -- Create the index only if it doesn't already exist
            IF NOT EXISTS (
              SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE c.relname = %L AND n.nspname = current_schema()
            ) THEN
              EXECUTE format(
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON embeddings USING ivfflat (embedding vector_l2_ops)
                 WITH (lists = %s) WHERE index_name = %L AND version = %s;',
                idx_name, p_lists, p_index_name, p_version
              );
            END IF;
          END IF;
        END
        $blk$;
      $SQL$, p_index_name, p_version, idx_name, idx_name, p_lists, p_index_name, p_version);
      EXECUTE sql;
    END
    $fn$;
  END IF;
END $$;

-- Optional: HNSW variant (fast, memory-heavy). Uncomment to use.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_embeddings_hnsw_index') THEN
--     CREATE OR REPLACE FUNCTION create_embeddings_hnsw_index(p_index_name TEXT, p_version INT, p_m INT DEFAULT 16, p_efconstruction INT DEFAULT 64)
--     RETURNS VOID
--     LANGUAGE plpgsql
--     AS $fn$
--     DECLARE
--       idx_name TEXT := format('emb_%s_v%s_hnsw_idx', regexp_replace(p_index_name, '\\W+', '_', 'g'), p_version);
--     BEGIN
--       EXECUTE format(
--         'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON embeddings USING hnsw (embedding vector_l2_ops)
--          WITH (m = %s, ef_construction = %s) WHERE index_name = %L AND version = %s;',
--          idx_name, p_m, p_efconstruction, p_index_name, p_version
--       );
--     END;
--     $fn$;
--   END IF;
-- END $$;
