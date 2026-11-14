-- Сколько часов в сутки уходит на сон. Раньше «Обзор» считал всё время вне
-- окна дня одной строкой «Сон и быт» — по ней не видно, высыпается он или нет.
-- Теперь сон задаётся явно, а остаток вне окна становится «Бытом и дорогой».
--
-- numeric(3,1): 7.5 часа — нормальная настройка, целых часов мало.

alter table public.user_settings
  add column sleep_hours numeric(3, 1) not null default 8;

alter table public.user_settings
  add constraint user_settings_sleep_hours_range check (sleep_hours >= 0 and sleep_hours <= 14);

comment on column public.user_settings.sleep_hours is 'Часов сна в сутки — для бюджета недели в «Обзоре».';
