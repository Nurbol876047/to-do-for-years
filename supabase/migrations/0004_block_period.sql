-- Этап 3: срок действия постоянного блока расписания.
-- Курс может идти не весь семестр: пара ведётся по какую-то дату, после неё
-- блок больше не должен попадать в «Неделю», «Сегодня» и «Обзор». Раньше это
-- приходилось делать вручную переключателем active.
-- Обе границы необязательны: null = «с начала» / «без конца».

alter table public.schedule_blocks
  add column starts_on date,
  add column ends_on date;

alter table public.schedule_blocks
  add constraint schedule_blocks_period_order check (ends_on is null or starts_on is null or ends_on >= starts_on);

comment on column public.schedule_blocks.starts_on is 'С какой даты пара идёт; null — с начала.';
comment on column public.schedule_blocks.ends_on is 'По какую дату включительно пара идёт; null — без конца.';
