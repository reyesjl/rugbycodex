#!/usr/bin/env bash
set -euo pipefail

# Run split SQL schema files against NEON_CONN
if [ -z "${NEON_CONN:-}" ]; then
  echo "NEON_CONN is not set. Export it first: export NEON_CONN='postgresql://user:pass@host:port/db?sslmode=require'"
  exit 1
fi

files=(
  "sql/01_extensions.sql"
  "sql/02_enums.sql"
  "sql/03_tenancy_accounts.sql"
  "sql/04_vocab_terms.sql"
  "sql/05_media_clips.sql"
  "sql/06_transcripts_metadata.sql"
  "sql/07_narrations_annotations.sql"
  "sql/08_embeddings_table.sql"
  "sql/09_embeddings_functions_indexes.sql"
  "sql/10_sequences.sql"
  "sql/11_policies_audit.sql"
  "sql/12_jobs.sql"
  "sql/13_query_helpers_housekeeping_indexes.sql"
)

for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "File not found: $f"
    exit 2
  fi
  echo
  echo "---- Running: $f ----"
  # psql will use exported PGPASSWORD if set in environment
  psql "$NEON_CONN" -v ON_ERROR_STOP=1 -f "$f"
  echo "---- Done: $f ----"
done

echo "All files executed successfully."