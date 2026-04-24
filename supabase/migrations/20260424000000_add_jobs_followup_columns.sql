-- Add kanban + follow-up columns that the app has been writing to
-- (see mapJobForDb in src/lib/jobs/storage.ts and the setFollowUp /
-- changeStage paths). Without these, every job upsert errors with
-- PGRST204 and silently falls back to local disk, so the deployed
-- app on the phone never sees any jobs.

alter table public.jobs
  add column if not exists follow_up_date  timestamptz,
  add column if not exists follow_up_note  text,
  add column if not exists stage_changed_at timestamptz;
