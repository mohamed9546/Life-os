create table if not exists public.storage_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.storage_kv enable row level security;

-- Since this is a single-tenant personal OS and workers need access,
-- we allow all operations. The Supabase service role key naturally bypasses this,
-- but allowing true makes it easy for the Next.js server to read/write using the anon key
-- if configured without a service key.
create policy "Allow all operations for storage_kv" 
on public.storage_kv 
for all 
using (true) 
with check (true);
