// Блоки дня: постоянные (schedule_blocks, повтор по дню недели) и разовые
// (events, на конкретную дату). В неделе они выглядят одинаково, поэтому
// сводятся к одному списку DayItem.

import { isoWeekday, minutesToTime, timeToMinutes } from "@/lib/date";
import type { Event, ScheduleBlock } from "@/lib/types";

/** В title хранится «Название — преподаватель, аудитория» (см. seed.sql). */
const TITLE_SEPARATOR = " — ";

export function splitBlockTitle(title: string): { name: string; details: string } {
  const index = title.indexOf(TITLE_SEPARATOR);
  if (index === -1) return { name: title, details: "" };
  return { name: title.slice(0, index), details: title.slice(index + TITLE_SEPARATOR.length) };
}

export function joinBlockTitle(name: string, details: string): string {
  return details ? `${name}${TITLE_SEPARATOR}${details}` : name;
}

export type DayItem = ({ kind: "block" } & ScheduleBlock) | ({ kind: "event" } & Event);

/**
 * Идёт ли пара в этот день: совпал день недели и дата попала в срок действия
 * (starts_on/ends_on, границы включительно; null — без ограничения).
 * Даты в формате YYYY-MM-DD, поэтому сравниваются как строки.
 */
export function blockRunsOn(block: ScheduleBlock, dateKey: string): boolean {
  if (block.weekday !== isoWeekday(dateKey)) return false;
  if (block.starts_on && dateKey < block.starts_on) return false;
  if (block.ends_on && dateKey > block.ends_on) return false;
  return true;
}

/** Пары расписания, которые идут в эту дату. */
export function blocksForDate(blocks: ScheduleBlock[], dateKey: string): ScheduleBlock[] {
  return blocks.filter((b) => blockRunsOn(b, dateKey));
}

/** Активные блоки расписания + разовые события дня, по времени начала. */
export function dayItems(blocks: ScheduleBlock[], events: Event[]): DayItem[] {
  const items: DayItem[] = [
    ...blocks.filter((b) => b.active).map((b) => ({ kind: "block" as const, ...b })),
    ...events.map((e) => ({ kind: "event" as const, ...e })),
  ];
  return items.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
}

/** Суммарная занятость дня в минутах. */
export function busyMinutes(items: DayItem[]): number {
  return items.reduce((sum, i) => sum + (timeToMinutes(i.end_time) - timeToMinutes(i.start_time)), 0);
}

// ---------------------------------------------------------------------------
// Свободное время
// ---------------------------------------------------------------------------

/** Границы дня по умолчанию — пока пользователь не задал свои (user_settings). */
export const DAY_WINDOW: DayWindow = { start: "08:00:00", end: "22:00:00" };

export interface DayWindow {
  start: string; // HH:mm:ss
  end: string;
}

/** Окно дня из настроек; без них — значения по умолчанию. */
export function dayWindowOf(settings: { day_start: string; day_end: string } | null | undefined): DayWindow {
  return settings ? { start: settings.day_start, end: settings.day_end } : DAY_WINDOW;
}

/** Часов сна в сутки — пока пользователь не задал своё значение. */
export const DEFAULT_SLEEP_HOURS = 8;

/** Окно короче — это перемена между парами, а не свободное время. */
export const MIN_FREE_MINUTES = 30;

export interface FreeSlot {
  start_time: string;
  end_time: string;
  minutes: number;
}

/**
 * Промежутки дня, не занятые блоками, внутри DAY_WINDOW. Пересекающиеся блоки
 * схлопываются (курсор идёт только вперёд), короткие окна отбрасываются.
 */
export function freeSlots(items: DayItem[], window: DayWindow = DAY_WINDOW): FreeSlot[] {
  const windowStart = timeToMinutes(window.start);
  const windowEnd = timeToMinutes(window.end);

  const busy = items
    .map((i) => [Math.max(windowStart, timeToMinutes(i.start_time)), Math.min(windowEnd, timeToMinutes(i.end_time))])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  const slots: FreeSlot[] = [];
  const push = (start: number, end: number) => {
    if (end - start >= MIN_FREE_MINUTES) {
      slots.push({ start_time: minutesToTime(start), end_time: minutesToTime(end), minutes: end - start });
    }
  };

  let cursor = windowStart;
  for (const [start, end] of busy) {
    push(cursor, start);
    cursor = Math.max(cursor, end);
  }
  push(cursor, windowEnd);

  return slots;
}

export type DayRow = { type: "item"; item: DayItem } | { type: "free"; slot: FreeSlot };

/** Блоки дня вперемешку со свободными окнами, по времени начала. */
export function dayRows(items: DayItem[], window: DayWindow = DAY_WINDOW): DayRow[] {
  const rows: DayRow[] = [
    ...items.map((item) => ({ type: "item" as const, item })),
    ...freeSlots(items, window).map((slot) => ({ type: "free" as const, slot })),
  ];
  return rows.sort((a, b) => {
    const at = timeToMinutes(a.type === "item" ? a.item.start_time : a.slot.start_time);
    const bt = timeToMinutes(b.type === "item" ? b.item.start_time : b.slot.start_time);
    return at - bt;
  });
}

// ---------------------------------------------------------------------------
// Отметка «сейчас»
// ---------------------------------------------------------------------------

/** Строка дня уже прошла, идёт прямо сейчас или ещё впереди. */
export type RowPhase = "past" | "now" | "future";

/** Границы строки в минутах от начала суток. */
export function rowRange(row: DayRow): { start: number; end: number } {
  const source = row.type === "item" ? row.item : row.slot;
  return { start: timeToMinutes(source.start_time), end: timeToMinutes(source.end_time) };
}

export function rowPhase(row: DayRow, nowMinutes: number): RowPhase {
  const { start, end } = rowRange(row);
  if (nowMinutes >= end) return "past";
  if (nowMinutes >= start) return "now";
  return "future";
}

/**
 * Куда вставить черту «сейчас» — индекс строки, перед которой она идёт
 * (rows.length — в самый низ). null, когда минута попала внутрь строки:
 * там отметку несёт сама строка, отдельная черта только дублировала бы её.
 *
 * Строки отсортированы по началу, поэтому после первой будущей строки
 * текущей уже не встретится.
 */
export function nowLineIndex(rows: DayRow[], nowMinutes: number): number | null {
  let index = 0;
  for (const row of rows) {
    const phase = rowPhase(row, nowMinutes);
    if (phase === "now") return null;
    if (phase === "future") break;
    index += 1;
  }
  return index;
}
