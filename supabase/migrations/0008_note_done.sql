-- Этап 4: заметка закрывается галочкой, как задача в списке.
-- Списки на «Входящих» показываются колонками рядом, и в каждой колонке
-- закрытые записи уезжают в свёрнутый блок «выполнено» — значит, заметке
-- нужно состояние, а не только удаление.

alter table public.notes add column done boolean not null default false;

create index notes_user_id_list_done_idx on public.notes (user_id, list, done);

comment on column public.notes.done is 'Заметка закрыта: уходит в блок «выполнено» в своей колонке.';
