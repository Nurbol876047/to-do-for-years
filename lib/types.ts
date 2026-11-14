export type TaskSource = "app" | "telegram";

/** На что уходит время — для бюджета недели в «Обзоре» (миграция 0010). */
export type BlockCategory = "study" | "work" | "sport" | "oscp" | "english" | "meals" | "other";

/** 1 = понедельник ... 7 = воскресенье. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Week {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD, понедельник
  theme: string | null;
  review_done: boolean;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  week_id: string;
  title: string;
  position: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  date: string | null; // null = входящие
  time: string | null; // HH:mm:ss
  goal_id: string | null;
  is_main: boolean;
  done: boolean;
  remind_at: string | null;
  source: TaskSource;
  created_at: string;
  updated_at: string;
}

export interface ScheduleBlock {
  id: string;
  user_id: string;
  title: string;
  weekday: Weekday;
  start_time: string; // HH:mm:ss
  end_time: string;
  color: string;
  category: BlockCategory;
  active: boolean;
  /** Срок действия пары, YYYY-MM-DD; null — без ограничения. */
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
}

/** Разовый блок дня (внеплановый): то же, что ScheduleBlock, но на конкретную дату. */
export interface Event {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string;
  color: string;
  category: BlockCategory;
  created_at: string;
  updated_at: string;
}

/** Настройки пользователя: границы дня для подсчёта свободного времени. */
export interface UserSettings {
  user_id: string;
  day_start: string; // HH:mm:ss — во сколько начинается день
  day_end: string;
  /** Часов сна в сутки — для бюджета недели в «Обзоре». */
  sleep_hours: number;
  created_at: string;
  updated_at: string;
}

/** Отметка дня в календаре: «что важного в этом дне». Без времени и без «сделано». */
export interface DayMark {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color: string;
  created_at: string;
  updated_at: string;
}

/** Списки заметок на «Входящих». */
export type NoteList = "focus" | "ideas" | "study" | "personal" | "archive";

export type TransactionDirection = "income" | "expense";

/** Операция по деньгам: сумма всегда положительная, знак — в direction. */
export interface Transaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  amount: number;
  direction: TransactionDirection;
  category: string;
  /** manual — внесена руками, import — разобрана из выписки. */
  source: "manual" | "import";
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  date: string | null; // null = заметка проекта
  week_id: string | null;
  /** Список на «Входящих»; null — заметка недели или дня. */
  list: NoteList | null;
  color: string;
  done: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Значения форм: что ввели в BlockForm / TaskForm. Сохранение — в lib/api.ts.
// ---------------------------------------------------------------------------

export type BlockFormValue =
  | {
      repeat: "weekly";
      title: string;
      weekday: Weekday;
      start_time: string;
      end_time: string;
      color: string;
      category: BlockCategory;
      active: boolean;
      starts_on: string | null;
      ends_on: string | null;
    }
  | {
      repeat: "once";
      title: string;
      date: string;
      start_time: string;
      end_time: string;
      color: string;
      category: BlockCategory;
    };

export interface TaskFormValue {
  title: string;
  date: string | null;
  time: string | null; // HH:mm:ss
  goal_id: string | null;
  is_main: boolean;
  /** Момент напоминания, ISO; null — не напоминать. */
  remind_at: string | null;
}
