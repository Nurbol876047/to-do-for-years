-- Категория блока: на что именно уходит время (учёба, работа, спорт, OSCP,
-- английский). Нужна разделу «Обзор» — он сводит неделю в бюджет часов, а по
-- названию блока категорию не угадать: «Работа» и «Основной курс» выглядят
-- одинаково, а значат разное.
--
-- Сон отдельной категорией не заводится: это всё, что вне окна дня
-- (user_settings.day_start/day_end), блоками его размечать не нужно.

create type public.block_category as enum ('study', 'work', 'sport', 'oscp', 'english', 'other');

alter table public.schedule_blocks
  add column category public.block_category not null default 'other';

alter table public.events
  add column category public.block_category not null default 'other';

comment on column public.schedule_blocks.category is 'На что уходит время — для бюджета недели в «Обзоре».';
comment on column public.events.category is 'На что уходит время — для бюджета недели в «Обзоре».';
