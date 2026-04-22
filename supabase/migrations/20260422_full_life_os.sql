create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date timestamptz not null,
  description text not null,
  amount numeric not null,
  currency text not null,
  category text,
  merchant_cleaned text,
  ai_categorization jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_text text not null,
  merchant_cleaned text not null,
  category text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.money_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  narrative_summary text not null,
  recurring_commitments text[] not null default '{}',
  unusual_spikes text[] not null default '{}',
  monthly_adjustments text[] not null default '{}',
  stability_warning text not null,
  confidence numeric not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  context text not null,
  options text[] not null default '{}',
  chosen_option text,
  outcome text,
  status text not null default 'open',
  ai_summary jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.decision_pattern_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  repeated_assumptions text[] not null default '{}',
  common_risk_themes text[] not null default '{}',
  avoidance_loops text[] not null default '{}',
  review_checklist text[] not null default '{}',
  narrative_summary text not null,
  confidence numeric not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekly_summary text not null,
  wins text[] not null default '{}',
  risks text[] not null default '{}',
  recommended_focus text[] not null default '{}',
  what_to_ignore text[] not null default '{}',
  energy_advice text not null,
  job_search_advice text not null,
  money_advice text not null,
  unfinished_loops text[] not null default '{}',
  next_week_operating_focus text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  area text not null,
  cadence text not null,
  target_days integer[] not null default '{}',
  enabled boolean not null default true,
  ai_prompt text,
  streak integer not null default 0,
  last_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.routine_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  status text not null,
  note text,
  completed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.import_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  label text not null,
  status text not null,
  counts jsonb not null,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.transactions enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.money_reviews enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_pattern_reviews enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.routines enable row level security;
alter table public.routine_checkins enable row level security;
alter table public.import_records enable row level security;

create policy "transactions_are_user_owned" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "merchant_rules_are_user_owned" on public.merchant_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "money_reviews_are_user_owned" on public.money_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "decisions_are_user_owned" on public.decisions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "decision_pattern_reviews_are_user_owned" on public.decision_pattern_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_reviews_are_user_owned" on public.weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routines_are_user_owned" on public.routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routine_checkins_are_user_owned" on public.routine_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "import_records_are_user_owned" on public.import_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
