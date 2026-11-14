-- Этап 4: цвет заметки. Списки держат порядок, цвет помогает глазу внутри списка:
-- срочное, учебное, бытовое. Цвет берётся из той же палитры, что у блоков и отметок.

alter table public.notes add column color text not null default '#2563eb';

comment on column public.notes.color is 'Цвет метки заметки из палитры BLOCK_COLORS.';
