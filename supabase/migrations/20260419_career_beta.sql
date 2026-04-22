create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  onboarding_completed boolean not null default false,
  target_role_tracks text[] not null default '{}',
  target_locations text[] not null default '{}',
  remote_preference text not null default 'flexible',
  preferred_seniority text not null default 'entry-to-mid',
  notification_frequency text not null default 'daily',
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  keywords text[] not null default '{}',
  location text not null default 'United Kingdom',
  remote_only boolean not null default false,
  radius integer not null default 25,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.source_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_id)
);

create table if not exists public.raw_jobs (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  dedupe_key text,
  payload jsonb not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.jobs (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null,
  dedupe_key text not null,
  raw jsonb not null,
  parsed jsonb,
  fit jsonb,
  user_notes text,
  source_query_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id text not null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  status text not null,
  actor_id text not null,
  details jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.worker_state (
  task_id text primary key,
  status text not null default 'idle',
  last_run timestamptz,
  last_success timestamptz,
  last_failure timestamptz,
  consecutive_failures integer not null default 0,
  runs_today integer not null default 0,
  today_date text not null,
  skipped_reason text,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  task_type text not null,
  model text not null,
  call_count integer not null default 1,
  last_call_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.saved_searches enable row level security;
alter table public.source_configs enable row level security;
alter table public.raw_jobs enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles_are_user_owned" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "saved_searches_are_user_owned" on public.saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "source_configs_are_user_owned" on public.source_configs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "raw_jobs_are_user_owned" on public.raw_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "jobs_are_user_owned" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "job_events_are_user_owned" on public.job_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ai_usage_is_user_owned" on public.ai_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
