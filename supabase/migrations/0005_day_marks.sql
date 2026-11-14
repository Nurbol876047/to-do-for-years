-- Этап 4: календарь на год. Отметка дня — «что важного в этом дне».
-- Это не блок времени (schedule_blocks/events) и не задача: у отметки нет
-- ни времени, ни состояния «сделано». Она нужна, чтобы день был заметен в
-- календаре: экзамен, дедлайн, поездка, день рождения.

create table public.day_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text not null,
  color text not null default '#dc2626',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_marks_title_not_blank check (length(btrim(title)) > 0)
);

create index day_marks_user_id_date_idx on public.day_marks (user_id, date);

create trigger day_marks_set_updated_at before update on public.day_marks for each row execute function public.set_updated_at();

alter table public.day_marks enable row level security;

create policy "day_marks_select_own" on public.day_marks for select using (user_id = auth.uid());
create policy "day_marks_insert_own" on public.day_marks for insert with check (user_id = auth.uid());
create policy "day_marks_update_own" on public.day_marks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "day_marks_delete_own" on public.day_marks for delete using (user_id = auth.uid());
