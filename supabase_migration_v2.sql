-- HabitLife v2 migration
-- Add: user_settings, day_notes, year_goals
-- Safe to run multiple times (uses IF NOT EXISTS where possible)

-- 1) user_settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nutrition_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

do $$ begin
  create policy "user_settings_select_own"
    on public.user_settings for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "user_settings_insert_own"
    on public.user_settings for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "user_settings_update_own"
    on public.user_settings for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 2) day_notes
create table if not exists public.day_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  gratitude text not null default '',
  redo text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_notes enable row level security;

do $$ begin
  create policy "day_notes_select_own"
    on public.day_notes for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "day_notes_insert_own"
    on public.day_notes for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "day_notes_update_own"
    on public.day_notes for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 3) year_goals
create table if not exists public.year_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  unit text not null default 'count',
  target numeric not null default 1,
  progress numeric not null default 0,
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.year_goals enable row level security;

do $$ begin
  create policy "year_goals_select_own"
    on public.year_goals for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "year_goals_insert_own"
    on public.year_goals for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "year_goals_update_own"
    on public.year_goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "year_goals_delete_own"
    on public.year_goals for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
