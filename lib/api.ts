// Вся работа с базой — только через этот файл (раздел 2 ТЗ).

import type { DayItem } from "@/lib/blocks";
import { supabase } from "@/lib/supabase";
import type {
  BlockFormValue,
  Event,
  Goal,
  Note,
  BlockCategory,
  ScheduleBlock,
  Task,
  TaskFormValue,
  TaskSource,
  UserSettings,
  DayMark,
  NoteList,
  Transaction,
  TransactionDirection,
  Week,
  Weekday,
} from "@/lib/types";

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Нет авторизованного пользователя");
  return data.user.id;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Нет данных");
  return data;
}

// ---------------------------------------------------------------------------
// weeks
// ---------------------------------------------------------------------------

export async function listWeeks(): Promise<Week[]> {
  const { data, error } = await supabase
    .from("weeks")
    .select("*")
    .order("week_start", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWeekByStart(weekStart: string): Promise<Week | null> {
  const { data, error } = await supabase
    .from("weeks")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createWeek(input: { week_start: string; theme?: string | null }): Promise<Week> {
  const userId = await getCurrentUserId();
  return unwrap<Week>(
    await supabase
      .from("weeks")
      .insert({ user_id: userId, week_start: input.week_start, theme: input.theme ?? null })
      .select("*")
      .single()
  );
}

export async function updateWeek(
  id: string,
  patch: Partial<Pick<Week, "theme" | "review_done" | "review_note">>
): Promise<Week> {
  return unwrap<Week>(await supabase.from("weeks").update(patch).eq("id", id).select("*").single());
}

/** Неделя создаётся лениво: строка нужна, только когда появились тема или цели. */
export async function ensureWeek(weekStart: string): Promise<Week> {
  const existing = await getWeekByStart(weekStart);
  return existing ?? createWeek({ week_start: weekStart });
}

export async function deleteWeek(id: string): Promise<void> {
  const { error } = await supabase.from("weeks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

export async function listGoalsForWeek(weekId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("week_id", weekId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createGoal(input: { week_id: string; title: string; position: 1 | 2 | 3 }): Promise<Goal> {
  const userId = await getCurrentUserId();
  return unwrap<Goal>(
    await supabase
      .from("goals")
      .insert({ user_id: userId, week_id: input.week_id, title: input.title, position: input.position })
      .select("*")
      .single()
  );
}

export async function updateGoal(id: string, patch: Partial<Pick<Goal, "title" | "position">>): Promise<Goal> {
  return unwrap<Goal>(await supabase.from("goals").update(patch).eq("id", id).select("*").single());
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export async function listInboxTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .is("date", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTasksForDate(date: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("date", date)
    .order("time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTasksForRange(startDate: string, endDate: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CreateTaskInput {
  title: string;
  date?: string | null;
  time?: string | null;
  goal_id?: string | null;
  is_main?: boolean;
  remind_at?: string | null;
  source?: TaskSource;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const userId = await getCurrentUserId();
  return unwrap<Task>(
    await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: input.title,
        date: input.date ?? null,
        time: input.time ?? null,
        goal_id: input.goal_id ?? null,
        is_main: input.is_main ?? false,
        remind_at: input.remind_at ?? null,
        source: input.source ?? "app",
      })
      .select("*")
      .single()
  );
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<Task, "title" | "date" | "time" | "goal_id" | "is_main" | "done" | "remind_at">
  >
): Promise<Task> {
  return unwrap<Task>(await supabase.from("tasks").update(patch).eq("id", id).select("*").single());
}

export async function setTaskDone(id: string, done: boolean): Promise<Task> {
  return updateTask(id, { done });
}

/**
 * Главная задача дня может быть только одна (уникальный индекс
 * tasks_one_main_per_date), поэтому сначала снимаем флаг с прежней.
 */
export async function setTaskMain(id: string, date: string, isMain: boolean): Promise<Task> {
  if (isMain) {
    const { error } = await supabase
      .from("tasks")
      .update({ is_main: false })
      .eq("date", date)
      .eq("is_main", true)
      .neq("id", id);
    if (error) throw new Error(error.message);
  }
  return updateTask(id, { is_main: isMain });
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// schedule_blocks
// ---------------------------------------------------------------------------

export async function listScheduleBlocks(): Promise<ScheduleBlock[]> {
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*")
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CreateScheduleBlockInput {
  title: string;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  color?: string;
  category?: BlockCategory;
  active?: boolean;
  starts_on?: string | null;
  ends_on?: string | null;
}

export async function createScheduleBlock(input: CreateScheduleBlockInput): Promise<ScheduleBlock> {
  const userId = await getCurrentUserId();
  return unwrap<ScheduleBlock>(
    await supabase
      .from("schedule_blocks")
      .insert({
        user_id: userId,
        title: input.title,
        weekday: input.weekday,
        start_time: input.start_time,
        end_time: input.end_time,
        color: input.color ?? "#2563eb",
        category: input.category ?? "other",
        active: input.active ?? true,
        starts_on: input.starts_on ?? null,
        ends_on: input.ends_on ?? null,
      })
      .select("*")
      .single()
  );
}

export async function updateScheduleBlock(
  id: string,
  patch: Partial<
    Pick<
      ScheduleBlock,
      | "title"
      | "weekday"
      | "start_time"
      | "end_time"
      | "color"
      | "category"
      | "active"
      | "starts_on"
      | "ends_on"
    >
  >
): Promise<ScheduleBlock> {
  return unwrap<ScheduleBlock>(
    await supabase.from("schedule_blocks").update(patch).eq("id", id).select("*").single()
  );
}

export async function deleteScheduleBlock(id: string): Promise<void> {
  const { error } = await supabase.from("schedule_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// events — разовые блоки дня (внеплановые)
// ---------------------------------------------------------------------------

export async function listEventsForRange(startDate: string, endDate: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listEventsForDate(date: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("date", date)
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CreateEventInput {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  color?: string;
  category?: BlockCategory;
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const userId = await getCurrentUserId();
  return unwrap<Event>(
    await supabase
      .from("events")
      .insert({
        user_id: userId,
        title: input.title,
        date: input.date,
        start_time: input.start_time,
        end_time: input.end_time,
        color: input.color ?? "#2563eb",
        category: input.category ?? "other",
      })
      .select("*")
      .single()
  );
}

export async function updateEvent(
  id: string,
  patch: Partial<Pick<Event, "title" | "date" | "start_time" | "end_time" | "color">>
): Promise<Event> {
  return unwrap<Event>(await supabase.from("events").update(patch).eq("id", id).select("*").single());
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// user_settings
// ---------------------------------------------------------------------------

/** Настроек может не быть — тогда действуют значения по умолчанию из lib/blocks. */
export async function getUserSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveUserSettings(patch: {
  day_start: string;
  day_end: string;
  sleep_hours: number;
}): Promise<UserSettings> {
  const userId = await getCurrentUserId();
  return unwrap<UserSettings>(
    await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
      .select("*")
      .single()
  );
}

/** Незакрытые задачи с напоминанием в будущем — по ним заводятся уведомления. */
export async function listUpcomingReminders(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .not("remind_at", "is", null)
    .eq("done", false)
    .gte("remind_at", new Date().toISOString())
    .order("remind_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// day_marks — «что важного в этом дне»
// ---------------------------------------------------------------------------

export async function listDayMarksForRange(from: string, to: string): Promise<DayMark[]> {
  const { data, error } = await supabase
    .from("day_marks")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDayMark(input: { date: string; title: string; color?: string }): Promise<DayMark> {
  const userId = await getCurrentUserId();
  return unwrap<DayMark>(
    await supabase
      .from("day_marks")
      .insert({ user_id: userId, date: input.date, title: input.title, color: input.color ?? "#dc2626" })
      .select("*")
      .single()
  );
}

export async function updateDayMark(
  id: string,
  patch: Partial<Pick<DayMark, "title" | "color" | "date">>
): Promise<DayMark> {
  return unwrap<DayMark>(await supabase.from("day_marks").update(patch).eq("id", id).select("*").single());
}

export async function deleteDayMark(id: string): Promise<void> {
  const { error } = await supabase.from("day_marks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// transactions — деньги
// ---------------------------------------------------------------------------

export async function listTransactionsForRange(from: string, to: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CreateTransactionInput {
  date: string;
  title: string;
  amount: number;
  direction: TransactionDirection;
  category?: string;
  source?: "manual" | "import";
}

export async function createTransactions(inputs: CreateTransactionInput[]): Promise<Transaction[]> {
  const userId = await getCurrentUserId();
  const rows = inputs.map((input) => ({
    user_id: userId,
    date: input.date,
    title: input.title,
    amount: input.amount,
    direction: input.direction,
    category: input.category ?? "Прочее",
    source: input.source ?? "manual",
  }));
  const { data, error } = await supabase.from("transactions").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

export async function listProjectNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .is("date", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Заметки одного списка «Входящих», свежие сверху. */
export async function listNotesByList(list: NoteList): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("list", list)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Все заметки всех списков — доска «Входящих» рисуется из одного запроса. */
export async function listBoardNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .not("list", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setNoteDone(id: string, done: boolean): Promise<Note> {
  return unwrap<Note>(await supabase.from("notes").update({ done }).eq("id", id).select("*").single());
}

export async function getNoteForDate(date: string): Promise<Note | null> {
  const { data, error } = await supabase.from("notes").select("*").eq("date", date).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listNotesForWeek(weekId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("week_id", weekId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface CreateNoteInput {
  title?: string | null;
  body?: string | null;
  date?: string | null;
  week_id?: string | null;
  list?: NoteList | null;
  color?: string;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const userId = await getCurrentUserId();
  return unwrap<Note>(
    await supabase
      .from("notes")
      .insert({
        user_id: userId,
        title: input.title ?? null,
        body: input.body ?? null,
        date: input.date ?? null,
        week_id: input.week_id ?? null,
        list: input.list ?? null,
        color: input.color ?? "#2563eb",
      })
      .select("*")
      .single()
  );
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, "title" | "body" | "list" | "color">>
): Promise<Note> {
  return unwrap<Note>(await supabase.from("notes").update(patch).eq("id", id).select("*").single());
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Составные операции форм
// ---------------------------------------------------------------------------

/**
 * Сохранение блока дня. Пользователь может переключить повтор, и тогда блок
 * переезжает между events (разовый) и schedule_blocks (постоянный): создаём
 * запись в новой таблице и удаляем старую.
 */
export async function saveBlockFromForm(editing: DayItem | null, value: BlockFormValue): Promise<void> {
  if (value.repeat === "once") {
    const patch = {
      title: value.title,
      date: value.date,
      start_time: value.start_time,
      end_time: value.end_time,
      color: value.color,
      category: value.category,
    };
    if (editing?.kind === "event") {
      await updateEvent(editing.id, patch);
      return;
    }
    await createEvent(patch);
    if (editing?.kind === "block") await deleteScheduleBlock(editing.id);
    return;
  }

  const patch = {
    title: value.title,
    weekday: value.weekday,
    start_time: value.start_time,
    end_time: value.end_time,
    color: value.color,
    category: value.category,
    active: value.active,
    starts_on: value.starts_on,
    ends_on: value.ends_on,
  };
  if (editing?.kind === "block") {
    await updateScheduleBlock(editing.id, patch);
    return;
  }
  await createScheduleBlock(patch);
  if (editing?.kind === "event") await deleteEvent(editing.id);
}

/**
 * Сохранение задачи. Флаг главной ставим вторым шагом: иначе перенос главной
 * задачи на день, где главная уже есть, упрётся в уникальный индекс.
 */
export async function saveTaskFromForm(editing: Task | null, value: TaskFormValue): Promise<void> {
  const patch = {
    title: value.title,
    date: value.date,
    time: value.time,
    goal_id: value.goal_id,
    remind_at: value.remind_at,
  };
  const saved = editing ? await updateTask(editing.id, { ...patch, is_main: false }) : await createTask(patch);
  if (value.is_main && value.date) await setTaskMain(saved.id, value.date, true);
}
