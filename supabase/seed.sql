-- Автосид для локальной разработки. Supabase CLI применяет этот файл сам
-- при каждом `supabase start` (первый запуск) и `supabase db reset` — после
-- `git pull`/клона main ничего руками делать не нужно, расписание и
-- dev-аккаунт появляются сразу.
--
-- 1) dev-пользователь (dev@notebook.local / notebook-dev-local), под которым
--    заходит EXPO_PUBLIC_DEV_SKIP_LOGIN=true (lib/store/auth.ts). Фиксированный
--    UUID — чтобы данные ниже всегда попадали на один и тот же auth.uid(),
--    а не на нового анонимного пользователя в каждом браузере.
-- 2) Расписание CSAI-24-1, подгруппа II (schedule_blocks) на этого пользователя,
--    плюс работа (Пн–Пт 09:00–13:00, кроме среды), курс английского (Вт/Чт)
--    блоки подготовки к OSCP, бассейн, две тренировки и рутину (обед, ужин).
--
-- В таблице schedule_blocks нет отдельных полей под преподавателя и
-- аудиторию (так в схеме раздела 3 ТЗ) — кабинет и преподаватель добавлены
-- в title.

do $$
declare
  v_user_id uuid := '8841a834-9b44-4331-8430-3895d49e30e8';
  v_email text := 'dev@notebook.local';
  v_password text := 'notebook-dev-local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{"email_verified":true}'::jsonb,
    false, false, now(), now()
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  insert into public.user_settings (user_id, day_start, day_end, sleep_hours)
  values (v_user_id, '06:00', '22:00', 7.5)
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.schedule_blocks where user_id = v_user_id) then
    -- ends_on = '2026-11-15' — пары, помеченные в расписании «1-10»: идут по
    -- 10-ю учебную неделю включительно (она кончается воскресеньем 15.11.2026),
    -- с 11-й недели их уже нет. Остальные пары «1-15» — без срока.
    insert into public.schedule_blocks (user_id, title, weekday, start_time, end_time, color, active, ends_on) values
      -- Дүйсенбі (Пн)
      (v_user_id, 'Работа', 1, '09:00', '13:00', '#475569', true, null),
      (v_user_id, 'Математикалық криптография — Нажен С.Б., ауд. 300', 1, '13:50', '14:40', '#2563eb', true, null),
      (v_user_id, 'Сандық дизайн негіздері — Мусагулова Г.Ш., ауд. 300', 1, '15:50', '16:40', '#7c3aed', true, null),
      (v_user_id, 'Бассейн', 1, '17:00', '19:00', '#0284c7', true, null),

      -- Сейсенбі (Вт)
      (v_user_id, 'Работа — ухожу в 11:50, в 12:50 пара', 2, '09:00', '11:50', '#475569', true, null),
      (v_user_id, 'Деректер ғылымына кіріспе (пр) — Өмір С.У., ауд. 300', 2, '12:50', '13:40', '#0d9488', true, null),
      (v_user_id, 'Философия (лек) — Иманмолдаева Б.З., ауд. 301', 2, '13:50', '14:40', '#d97706', true, null),
      (v_user_id, 'Математикалық криптография (пр) — Нажен С.Б., ауд. 305', 2, '14:50', '15:40', '#2563eb', true, null),
      (v_user_id, 'Python тілін қолдана отырып бағд. жасақтама жасау (лаб, II) — Қажымұрат Ғ., ауд. 307', 2, '15:50', '16:40', '#16a34a', true, '2026-11-15'),
      (v_user_id, 'Деректер ғылымына кіріспе (лаб, II) — Өмір С.У., ауд. 305', 2, '16:50', '17:40', '#0d9488', true, '2026-11-15'),
      (v_user_id, 'АК және комп. криминалистика: ұйымд.-құқ. аспектілері (лек) — Қаржаубаева Л.М., ауд. 307', 2, '17:50', '18:40', '#dc2626', true, null),
      (v_user_id, 'Английский язык (курс)', 2, '18:45', '20:20', '#ea580c', true, null),

      -- Сәрсенбі (Ср) — работы нет: пара в 09:30, отпрашивается на весь день
      -- Тренировка = пробежка 3 км, сразу после силовая (отжимания, иногда ноги).
      (v_user_id, 'Тренировка — пробежка 3 км, после неё силовая 40–50 мин', 3, '07:00', '08:30', '#65a30d', true, null),
      (v_user_id, 'АҚ жүйелерін аппараттық-техн. қолдау (лек) — Турлугулова Н.А., ауд. 311', 3, '09:30', '10:20', '#db2777', true, null),
      (v_user_id, 'АҚ жүйелерін аппараттық-техн. қолдау (лаб, II) — Турлугулова Н.А., ауд. 304', 3, '11:30', '12:20', '#db2777', true, null),
      (v_user_id, 'Python тілін қолдана отырып бағд. жасақтама жасау (лек) — Турлугулова Н.А., ауд. 301', 3, '13:50', '14:40', '#16a34a', true, null),
      (v_user_id, 'Сандық дизайн негіздері (лаб, II) — Нажен С.Б., ауд. 307', 3, '14:50', '15:40', '#7c3aed', true, '2026-11-15'),
      (v_user_id, 'Python тілін қолдана отырып бағд. жасақтама жасау (пр) — Қажымұрат Ғ., ауд. 300', 3, '16:50', '17:40', '#16a34a', true, null),
      (v_user_id, 'АК және комп. криминалистика: ұйымд.-құқ. аспектілері (пр) — Каржаубаева Л.М., ауд. 300', 3, '17:50', '18:40', '#dc2626', true, null),

      -- Бейсенбі (Чт)
      (v_user_id, 'Работа', 4, '09:00', '13:00', '#475569', true, null),
      (v_user_id, 'Математикалық криптография (пр, II) — Нажен С.Б., ауд. 311', 4, '13:50', '14:40', '#2563eb', true, '2026-11-15'),
      (v_user_id, 'Сандық дизайн негіздері (пр) — Мусагулова Г.Ш., ауд. 300', 4, '15:50', '16:40', '#7c3aed', true, null),
      (v_user_id, 'Философия (пр, сдвоенная) — Иманмолдаева Б.З., ауд. 311', 4, '16:50', '18:40', '#d97706', true, null),
      (v_user_id, 'Английский язык (курс)', 4, '18:45', '20:20', '#ea580c', true, null),

      -- Жұма (Пт)
      (v_user_id, 'Работа', 5, '09:00', '13:00', '#475569', true, null),
      (v_user_id, 'АҚ жүйелерін аппараттық-техн. қолдау (пр) — Турлугулова Н.А., ауд. 304', 5, '13:50', '14:40', '#db2777', true, null),
      -- В фото строка выглядит зачёркнутой, но пара идёт — включено вручную.
      (v_user_id, 'Деректер ғылымына кіріспе (лек) — Ғалымжанқызы Ә., ауд. 300', 5, '14:50', '15:40', '#0d9488', true, null),
      (v_user_id, 'АК және комп. криминалистика: ұйымд.-құқ. аспектілері (лаб, II) — Садыков М.А., 1-оқу ғимараты', 5, '17:50', '18:40', '#dc2626', true, '2026-11-15'),

      -- Сенбі (Сб)
      (v_user_id, 'Тренировка — пробежка 3 км, после неё силовая 40–50 мин', 6, '08:00', '09:30', '#65a30d', true, null),
      (v_user_id, 'Основной курс', 6, '11:00', '18:00', '#0891b2', true, null),

      -- Жексенбі (Вс)
      (v_user_id, 'Основной курс', 7, '11:00', '18:00', '#0891b2', true, null);

    -- Подготовка к OSCP (18 машин HTB, 13.11–28.12.2026, материалы в ~/htb).
    -- Окна подобраны под реальную загрузку: выходные днём занимает «Основной
    -- курс», вторник и четверг вечером — курс английского, поэтому длинные
    -- машины встали на вечера субботы и воскресенья, третья — на пятницу.
    -- Всё после « — » в title «Неделя» рисует второй строкой (splitBlockTitle),
    -- поэтому суть задачи вынесена туда — видно прямо в карточке дня.
    insert into public.schedule_blocks (user_id, title, weekday, start_time, end_time, color, active, starts_on, ends_on) values
      -- Разбор стоял в понедельник, но туда встал бассейн 17:00–19:00; работа
      -- лёгкая (видео + заметки), поэтому перенесена в окно между парами во вторник.
      (v_user_id, 'OSCP · разбор + IppSec — видео по машинам недели, время до рута в progress.md', 2, '15:40', '17:10', '#4338ca', true, '2026-11-16', '2026-12-28'),
      -- Четвёртая машина недели двумя заходами: неделя по плану ~/htb стартует
      -- в пятницу, поэтому понедельник — её середина, а четверг — добивка.
      (v_user_id, 'OSCP · машина №4 — старт: recon и первый вектор', 1, '20:00', '22:00', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · машина №4 — добить и записать технику', 4, '13:50', '15:50', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · машина между парами — короткая, без цели дорутать', 3, '14:50', '16:40', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · теория — одна новая техника в конспект', 3, '20:00', '21:00', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · HTB машина №3 — покороче: recon → foothold → root', 5, '15:40', '19:00', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · добивка машины №3', 5, '20:00', '21:00', '#4338ca', true, '2026-11-16', '2026-12-28'),
      (v_user_id, 'OSCP · HTB машина №1 — длинная: recon → foothold → root. Без Metasploit, заметки в ~/htb/machines', 6, '19:00', '22:00', '#4338ca', true, '2026-11-13', '2026-12-28'),
      (v_user_id, 'OSCP · HTB машина №2 — длинная: recon → foothold → root. Застрял больше 40 мин — подсказка', 7, '19:00', '22:00', '#4338ca', true, '2026-11-13', '2026-12-28');

    -- Рутина: обед всегда перед первой парой дня, ужин в 19:00. Исключения —
    -- вторник и четверг (английский до 20:20, ужин после) и выходные (курс
    -- кончается в 18:00, едим сразу и садимся за машину).
    insert into public.schedule_blocks (user_id, title, weekday, start_time, end_time, color, active) values
      (v_user_id, 'Обед', 1, '13:00', '13:50', '#ca8a04', true),
      (v_user_id, 'Обед', 2, '11:50', '12:40', '#ca8a04', true),
      (v_user_id, 'Обед', 3, '12:20', '13:10', '#ca8a04', true),
      (v_user_id, 'Обед', 4, '13:00', '13:50', '#ca8a04', true),
      (v_user_id, 'Обед', 5, '13:00', '13:50', '#ca8a04', true),
      (v_user_id, 'Ужин', 1, '19:00', '20:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 2, '20:20', '21:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 3, '19:00', '20:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 4, '20:20', '21:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 5, '19:00', '20:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 6, '18:00', '19:00', '#ca8a04', true),
      (v_user_id, 'Ужин', 7, '18:00', '19:00', '#ca8a04', true),
      -- Часовые окна между парами заняты книгой.
      (v_user_id, 'Чтение — книга по теме недели', 1, '14:40', '15:50', '#0f766e', true),
      (v_user_id, 'Чтение — книга по теме недели', 3, '10:20', '11:30', '#0f766e', true);

    -- Категория (миграция 0010) — из неё «Обзор» собирает бюджет недели.
    -- Проставляется отдельными update, чтобы не раздувать списки выше.
    update public.schedule_blocks set category = 'work'    where user_id = v_user_id and title like 'Работа%';
    update public.schedule_blocks set category = 'english' where user_id = v_user_id and title like 'Английский язык%';
    update public.schedule_blocks set category = 'sport'   where user_id = v_user_id and (title = 'Бассейн' or title like 'Тренировка%');
    update public.schedule_blocks set category = 'oscp'    where user_id = v_user_id and title like 'OSCP%';
    update public.schedule_blocks set category = 'meals'   where user_id = v_user_id and title in ('Обед', 'Ужин');
    update public.schedule_blocks set category = 'study'   where user_id = v_user_id and category = 'other';
  end if;
end $$;
