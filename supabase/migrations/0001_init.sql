-- Этап 1: базовая схема для планировщика (раздел 3 ТЗ)
-- 5 таблиц: weeks, goals, tasks, schedule_blocks, notes.
-- Везде: id uuid, user_id uuid, created_at, updated_at. RLS: user_id = auth.uid().

create extension if not exists "pgcrypto";

create type public.task_source as enum ('app', 'telegram');

-- ---------------------------------------------------------------------------
-- weeks
-- ---------------------------------------------------------------------------
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  theme text,
  review_done boolean not null default false,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weeks_theme_length check (theme is null or char_length(theme) <= 60),
  constraint weeks_user_week_start_unique unique (user_id, week_start)
);

create index weeks_user_id_week_start_idx on public.weeks (user_id, week_start desc);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_id uuid not null references public.weeks (id) on delete cascade,
  title text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_position_range check (position between 1 and 3),
  constraint goals_week_position_unique unique (week_id, position)
);

create index goals_week_id_idx on public.goals (week_id);

-- goal.week_id must belong to goal.user_id
create or replace function public.goals_check_week_owner()
returns trigger
language plpgsql
as $$
declare
  v_week_user_id uuid;
begin
  select user_id into v_week_user_id from public.weeks where id = new.week_id;

  if v_week_user_id is null then
    raise exception 'week % not found', new.week_id;
  end if;

  if v_week_user_id <> new.user_id then
    raise exception 'week does not belong to the goal''s user';
  end if;

  return new;
end;
$$;

create trigger goals_check_week_owner_trg
  before insert or update on public.goals
  for each row execute function public.goals_check_week_owner();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  date date,
  time time,
  goal_id uuid references public.goals (id) on delete set null,
  is_main boolean not null default false,
  done boolean not null default false,
  remind_at timestamptz,
  source public.task_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_date_idx on public.tasks (user_id, date);
create index tasks_goal_id_idx on public.tasks (goal_id);

-- правило: не больше одной is_main = true задачи на дату у пользователя
create unique index tasks_one_main_per_date
  on public.tasks (user_id, date)
  where is_main = true and date is not null;

-- правило: задача с goal_id должна иметь дату в неделе этой цели или null;
-- goal_id должен принадлежать тому же пользователю.
create or replace function public.tasks_check_goal_consistency()
returns trigger
language plpgsql
as $$
declare
  v_goal_user_id uuid;
  v_week_start date;
begin
  if new.goal_id is null then
    return new;
  end if;

  select g.user_id, w.week_start
    into v_goal_user_id, v_week_start
  from public.goals g
  join public.weeks w on w.id = g.week_id
  where g.id = new.goal_id;

  if v_goal_user_id is null then
    raise exception 'goal % not found', new.goal_id;
  end if;

  if v_goal_user_id <> new.user_id then
    raise exception 'goal does not belong to the task''s user';
  end if;

  if new.date is not null and (new.date < v_week_start or new.date > v_week_start + 6) then
    raise exception 'task date must fall within the goal''s week, or be null';
  end if;

  return new;
end;
$$;

create trigger tasks_check_goal_consistency_trg
  before insert or update on public.tasks
  for each row execute function public.tasks_check_goal_consistency();

-- ---------------------------------------------------------------------------
-- schedule_blocks
-- ---------------------------------------------------------------------------
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  color text not null default '#2563eb',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_blocks_weekday_range check (weekday between 1 and 7),
  constraint schedule_blocks_time_order check (end_time > start_time)
);

create index schedule_blocks_user_id_weekday_idx on public.schedule_blocks (user_id, weekday);

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  body text,
  date date,
  week_id uuid references public.weeks (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_date_idx on public.notes (user_id, date);
create index notes_week_id_idx on public.notes (week_id);

-- note.week_id (если задан) должен принадлежать note.user_id
create or replace function public.notes_check_week_owner()
returns trigger
language plpgsql
as $$
declare
  v_week_user_id uuid;
begin
  if new.week_id is null then
    return new;
  end if;

  select user_id into v_week_user_id from public.weeks where id = new.week_id;

  if v_week_user_id is null then
    raise exception 'week % not found', new.week_id;
  end if;

  if v_week_user_id <> new.user_id then
    raise exception 'week does not belong to the note''s user';
  end if;

  return new;
end;
$$;

create trigger notes_check_week_owner_trg
  before insert or update on public.notes
  for each row execute function public.notes_check_week_owner();

-- ---------------------------------------------------------------------------
-- updated_at: общий триггер на все 5 таблиц
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger weeks_set_updated_at before update on public.weeks for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger schedule_blocks_set_updated_at before update on public.schedule_blocks for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: доступ только к своим строкам (user_id = auth.uid())
-- ---------------------------------------------------------------------------
alter table public.weeks enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.notes enable row level security;

create policy "weeks_select_own" on public.weeks for select using (user_id = auth.uid());
create policy "weeks_insert_own" on public.weeks for insert with check (user_id = auth.uid());
create policy "weeks_update_own" on public.weeks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weeks_delete_own" on public.weeks for delete using (user_id = auth.uid());

create policy "goals_select_own" on public.goals for select using (user_id = auth.uid());
create policy "goals_insert_own" on public.goals for insert with check (user_id = auth.uid());
create policy "goals_update_own" on public.goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete_own" on public.goals for delete using (user_id = auth.uid());

create policy "tasks_select_own" on public.tasks for select using (user_id = auth.uid());
create policy "tasks_insert_own" on public.tasks for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks for delete using (user_id = auth.uid());

create policy "schedule_blocks_select_own" on public.schedule_blocks for select using (user_id = auth.uid());
create policy "schedule_blocks_insert_own" on public.schedule_blocks for insert with check (user_id = auth.uid());
create policy "schedule_blocks_update_own" on public.schedule_blocks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "schedule_blocks_delete_own" on public.schedule_blocks for delete using (user_id = auth.uid());

create policy "notes_select_own" on public.notes for select using (user_id = auth.uid());
create policy "notes_insert_own" on public.notes for insert with check (user_id = auth.uid());
create policy "notes_update_own" on public.notes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes_delete_own" on public.notes for delete using (user_id = auth.uid());
