alter table if exists public.jobs
  add column if not exists request_id text,
  add column if not exists trace_id text;

create index if not exists jobs_request_id_idx on public.jobs (request_id);
create index if not exists jobs_trace_id_idx on public.jobs (trace_id);
