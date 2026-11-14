// Снимок планировщика для чата: что сейчас происходит у человека.
//
// Модель получает его текстом перед вопросом, поэтому важно уместить главное
// и не раздувать: списки подрезаны, суммы округлены, прошлое не тянем.

import { busyMinutes, dayItems, splitBlockTitle } from "@/lib/blocks";
import {
  formatDateKey,
  formatDayLabel,
  formatDuration,
  formatTime,
  isoWeekday,
  weekDates,
  WEEKDAY_LABELS_SHORT,
} from "@/lib/date";
import { noteListLabel } from "@/lib/noteLists";
import type {
  DayMark,
  Event,
  Goal,
  Note,
  ScheduleBlock,
  Task,
  Transaction,
  Week,
} from "@/lib/types";

/** Сколько строк одного вида отдаём максимум. */
const LIMIT = 15;

export interface SnapshotInput {
  todayKey: string;
  weekStart: string;
  week: Week | null;
  goals: Goal[];
  weekTasks: Task[];
  inboxTasks: Task[];
  blocks: ScheduleBlock[];
  events: Event[];
  notes: Note[];
  marks: DayMark[];
  transactions: Transaction[];
  monthLabel: string;
}

function taskLine(task: Task): string {
  const when = task.date ? formatDayLabel(task.date) : "без даты";
  const flags = [task.done ? "сделана" : null, task.is_main ? "главная задача дня" : null].filter(Boolean);
  const time = task.time ? `, ${formatTime(task.time)}` : "";
  return `- ${task.title} (${when}${time}${flags.length ? ", " + flags.join(", ") : ""})`;
}

export function buildSnapshot(input: SnapshotInput): string {
  const sections: string[] = [];

  sections.push(`Сегодня ${formatDayLabel(input.todayKey)} (${input.todayKey}).`);

  // --- неделя: тема и цели ---
  const goals = [...input.goals].sort((a, b) => a.position - b.position);
  sections.push(
    [
      `Неделя с ${input.weekStart}.`,
      `Тема недели: ${input.week?.theme?.trim() || "не задана"}.`,
      goals.length > 0
        ? `Цели недели:\n${goals.map((g) => `${g.position}. ${g.title}`).join("\n")}`
        : "Цели недели не заданы.",
    ].join("\n")
  );

  // --- задачи ---
  const open = input.weekTasks.filter((t) => !t.done);
  const done = input.weekTasks.filter((t) => t.done);
  const todayTasks = input.weekTasks.filter((t) => t.date === input.todayKey);
  sections.push(
    [
      `Задачи недели: всего ${input.weekTasks.length}, сделано ${done.length}.`,
      todayTasks.length > 0
        ? `На сегодня:\n${todayTasks.slice(0, LIMIT).map(taskLine).join("\n")}`
        : "На сегодня задач нет.",
      open.length > 0 ? `Открытые на неделе:\n${open.slice(0, LIMIT).map(taskLine).join("\n")}` : "",
      input.inboxTasks.length > 0
        ? `Во «Входящих» без даты: ${input.inboxTasks
            .filter((t) => !t.done)
            .slice(0, LIMIT)
            .map((t) => t.title)
            .join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  // --- расписание на всю неделю ---
  //
  // Раньше сюда шло только «сегодня» плюс счётчик пар по дням, и на вопрос про
  // завтра модель пересказывала сегодняшний день. Поэтому даём каждый день
  // целиком: по нему же модель считает, где у человека свободные окна.
  const dayLines = weekDates(input.weekStart).map((date) => {
    const items = dayItems(
      input.blocks.filter((b) => b.weekday === isoWeekday(date)),
      input.events.filter((e) => e.date === date)
    );
    const label = `${WEEKDAY_LABELS_SHORT[isoWeekday(date) - 1]} ${formatDateKey(date)}`;
    const when = date === input.todayKey ? " (сегодня)" : "";
    if (items.length === 0) return `${label}${when}: пусто`;
    const busy = formatDuration(busyMinutes(items));
    const rows = items
      .slice(0, LIMIT)
      .map((item) => {
        const { name } = splitBlockTitle(item.title);
        return `  - ${formatTime(item.start_time)}–${formatTime(item.end_time)} ${name}`;
      })
      .join("\n");
    return `${label}${when}, занято ${busy}:\n${rows}`;
  });
  sections.push(`Расписание недели:\n${dayLines.join("\n")}`);

  // --- важные дни впереди ---
  if (input.marks.length > 0) {
    sections.push(
      `Отмечено в календаре впереди:\n${input.marks
        .slice(0, LIMIT)
        .map((m) => `- ${formatDayLabel(m.date)}: ${m.title}`)
        .join("\n")}`
    );
  }

  // --- заметки по спискам ---
  const openNotes = input.notes.filter((n) => !n.done && n.list);
  if (openNotes.length > 0) {
    const byList = new Map<string, string[]>();
    for (const note of openNotes) {
      const label = noteListLabel(note.list!);
      const bucket = byList.get(label) ?? [];
      if (bucket.length < 8) bucket.push(note.body ?? "");
      byList.set(label, bucket);
    }
    sections.push(
      `Заметки:\n${[...byList.entries()].map(([label, items]) => `${label}: ${items.join("; ")}`).join("\n")}`
    );
  }

  // --- деньги ---
  const income = input.transactions
    .filter((t) => t.direction === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = input.transactions
    .filter((t) => t.direction === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const byCategory = new Map<string, number>();
  for (const row of input.transactions) {
    if (row.direction !== "expense") continue;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + Number(row.amount));
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  sections.push(
    [
      `Деньги за ${input.monthLabel}: пришло ${Math.round(income)}, ушло ${Math.round(expense)}, остаток ${Math.round(income - expense)} (тенге).`,
      categories.length > 0
        ? `Траты по категориям: ${categories.map(([name, sum]) => `${name} ${Math.round(sum)}`).join(", ")}`
        : "Трат за месяц нет.",
    ].join("\n")
  );

  return sections.join("\n\n");
}
