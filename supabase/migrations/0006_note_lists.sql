-- Этап 4: заметки разложены по спискам (как списки в Google Tasks).
-- Пять постоянных списков на экране «Входящие». Заметки недели (week_id)
-- и дня (date) к спискам не относятся — у них list остаётся null.

alter table public.notes add column list text;

alter table public.notes
  add constraint notes_list_known check (list is null or list in ('focus', 'ideas', 'study', 'personal', 'archive'));

create index notes_user_id_list_idx on public.notes (user_id, list);

comment on column public.notes.list is 'Список на «Входящих»: focus | ideas | study | personal | archive; null — заметка недели или дня.';
