-- HabitLife schema (Supabase Postgres)
-- Run in Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ( (select auth.uid()) = id );

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ( (select auth.uid()) = id );

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );

create table if not exists public.habits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  unit text not null default 'boolean',
  target numeric,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.habits enable row level security;

create policy "habits_select_own"
on public.habits for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy "habits_write_own"
on public.habits for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy "habits_update_own"
on public.habits for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create policy "habits_delete_own"
on public.habits for delete
to authenticated
using ( (select auth.uid()) = user_id );

create table if not exists public.habit_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  habit_id text not null,
  value numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, habit_id),
  foreign key (user_id, habit_id) references public.habits(user_id, id) on delete cascade
);

alter table public.habit_logs enable row level security;

create policy "habit_logs_select_own"
on public.habit_logs for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy "habit_logs_write_own"
on public.habit_logs for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy "habit_logs_update_own"
on public.habit_logs for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create policy "habit_logs_delete_own"
on public.habit_logs for delete
to authenticated
using ( (select auth.uid()) = user_id );

create table if not exists public.nutrition_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kcal int not null default 0,
  protein_g int not null default 0,
  fat_g int not null default 0,
  carbs_g int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

create policy "nutrition_goals_select_own"
on public.nutrition_goals for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy "nutrition_goals_write_own"
on public.nutrition_goals for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy "nutrition_goals_update_own"
on public.nutrition_goals for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create table if not exists public.nutrition_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kcal int not null default 0,
  protein_g int not null default 0,
  fat_g int not null default 0,
  carbs_g int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.nutrition_logs enable row level security;

create policy "nutrition_logs_select_own"
on public.nutrition_logs for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy "nutrition_logs_write_own"
on public.nutrition_logs for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy "nutrition_logs_update_own"
on public.nutrition_logs for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );
