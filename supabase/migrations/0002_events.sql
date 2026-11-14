-- Этап 2: разовые блоки дня (внеплановые) — events.
-- schedule_blocks — это постоянное расписание (повтор каждую неделю по weekday).
-- events — то же самое, но привязано к конкретной дате и не повторяется.
-- Поля title/start_time/end_time/color совпадают по именам с schedule_blocks,
-- чтобы неделя рисовала оба вида блоков одинаково.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  color text not null default '#2563eb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (end_time > start_time)
);

create index events_user_id_date_idx on public.events (user_id, date);

create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "events_select_own" on public.events for select using (user_id = auth.uid());
create policy "events_insert_own" on public.events for insert with check (user_id = auth.uid());
create policy "events_update_own" on public.events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "events_delete_own" on public.events for delete using (user_id = auth.uid());
