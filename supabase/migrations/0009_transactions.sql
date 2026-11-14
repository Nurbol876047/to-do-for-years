-- Этап 5: финансы. Операция — приход или трата с категорией.
-- Сумма всегда положительная, направление хранится отдельно: так агрегаты
-- («сколько пришло», «сколько ушло») считаются без фильтров по знаку, а
-- случайный минус не ломает статистику.
-- source показывает, откуда операция: руками или разобрана из выписки.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text not null,
  amount numeric(14, 2) not null,
  direction text not null,
  category text not null default 'Прочее',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_direction_known check (direction in ('income', 'expense')),
  constraint transactions_source_known check (source in ('manual', 'import')),
  constraint transactions_title_not_blank check (length(btrim(title)) > 0)
);

create index transactions_user_id_date_idx on public.transactions (user_id, date);

create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions for select using (user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions for insert with check (user_id = auth.uid());
create policy "transactions_update_own" on public.transactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions for delete using (user_id = auth.uid());
