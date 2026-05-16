-- user_pins: stores pinned theses for authenticated users
-- Run this in the Supabase SQL editor

create table if not exists public.user_pins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  state        text not null default 'QUIET',
  x            real not null default 0,
  y            real not null default 0,
  tilt         real not null default 0,
  deals30      integer not null default 0,
  deals90      integer not null default 0,
  media        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for fast per-user queries
create index if not exists user_pins_user_id_idx on public.user_pins(user_id);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_pins_updated_at on public.user_pins;
create trigger user_pins_updated_at
  before update on public.user_pins
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.user_pins enable row level security;

-- Users can only see their own pins
create policy "select own pins"
  on public.user_pins for select
  using (auth.uid() = user_id);

-- Users can insert their own pins
create policy "insert own pins"
  on public.user_pins for insert
  with check (auth.uid() = user_id);

-- Users can update their own pins
create policy "update own pins"
  on public.user_pins for update
  using (auth.uid() = user_id);

-- Users can delete their own pins
create policy "delete own pins"
  on public.user_pins for delete
  using (auth.uid() = user_id);
