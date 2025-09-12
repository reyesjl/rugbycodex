Split DB schema files and recommended run order

Run these files in order to create the full schema. Running them separately avoids truncation in web consoles like Neon.

Recommended order:
1. sql/01_extensions.sql
2. sql/02_enums.sql
3. sql/03_tenancy_accounts.sql
4. sql/04_vocab_terms.sql
5. sql/05_media_clips.sql
6. sql/06_transcripts_metadata.sql
7. sql/07_narrations_annotations.sql
8. sql/08_embeddings_table.sql
9. sql/09_embeddings_functions_indexes.sql
10. sql/10_sequences.sql
11. sql/11_policies_audit.sql
12. sql/12_jobs.sql
13. sql/13_query_helpers_housekeeping_indexes.sql

Tips:
- Run each file fully and check the activity/log output in Neon to confirm the file was not truncated.
- For functions that create indexes CONCURRENTLY, run them after loading data or using a dedicated migration step.
- If you need the original single-file canonical script, keep `001_init_rugbycodex_schema.sql` as reference.
