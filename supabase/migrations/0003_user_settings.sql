-- Этап 3: границы дня пользователя.
-- Свободное время считается только внутри [day_start, day_end): раньше эти
-- границы были константой 08:00–22:00 в коде, теперь это настройка.

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day_start time not null default '08:00',
  day_end time not null default '22:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_day_order check (day_end > day_start)
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own" on public.user_settings for select using (user_id = auth.uid());
create policy "user_settings_insert_own" on public.user_settings for insert with check (user_id = auth.uid());
create policy "user_settings_update_own" on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_settings_delete_own" on public.user_settings for delete using (user_id = auth.uid());
