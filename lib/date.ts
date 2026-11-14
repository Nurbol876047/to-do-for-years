// Вся модель времени — в часовом поясе Asia/Almaty (раздел 2 ТЗ), неделя с понедельника.

const ALMATY_TZ = "Asia/Almaty";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function almatyDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ALMATY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

/** Текущая календарная дата в Asia/Almaty, формат YYYY-MM-DD. */
export function todayInAlmaty(now: Date = new Date()): string {
  const { year, month, day } = almatyDateParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** dateKey + offsetDays дней (может быть отрицательным), формат YYYY-MM-DD. */
export function addDaysToKey(dateKey: string, offsetDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return utcDate.toISOString().slice(0, 10);
}

/** Номер дня недели (1 = Пн ... 7 = Вс) для dateKey (YYYY-MM-DD). */
export function isoWeekday(dateKey: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (weekday === 0 ? 7 : weekday) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Понедельник недели, в которую попадает dateKey (YYYY-MM-DD). */
export function weekStartOf(dateKey: string): string {
  const offsetFromMonday = isoWeekday(dateKey) - 1;
  return addDaysToKey(dateKey, -offsetFromMonday);
}

/** Понедельник текущей недели в Asia/Almaty, YYYY-MM-DD. */
export function currentWeekStart(now: Date = new Date()): string {
  return weekStartOf(todayInAlmaty(now));
}

/** 7 дат недели (Пн..Вс), начиная с weekStart. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
}

export const WEEKDAY_LABELS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const WEEKDAY_LABELS_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

/** Короткая подпись дня по dateKey, например "Пн, 04.11". */
export function formatDayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${WEEKDAY_LABELS_SHORT[isoWeekday(dateKey) - 1]}, ${pad(d)}.${pad(m)}`;
}

/** dateKey (YYYY-MM-DD) -> "15.11.2026" для показа и ввода. */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

/** "15.11.2026" -> dateKey (YYYY-MM-DD); null, если дата нереальная. */
export function parseDateInput(input: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const dateKey = `${y}-${m}-${d}`;
  // 31.02 отсеиваем обратным преобразованием: Date нормализует такую дату.
  const asDate = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime()) || asDate.toISOString().slice(0, 10) !== dateKey) return null;
  return dateKey;
}

/** "HH:MM" или "HH:MM:SS" -> минуты от начала суток. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM:SS" -> "HH:MM" для отображения. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Минуты от начала суток -> "HH:MM:SS". */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
}

/** Длительность в минутах -> "1 ч 10 мин" / "40 мин" / "2 ч". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} мин`;
  if (!m) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

// ---------------------------------------------------------------------------
// Календарь: месяцы и год
// ---------------------------------------------------------------------------

export const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

/** Сколько дней в месяце (month: 1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Все даты месяца подряд, YYYY-MM-DD. */
export function monthDays(year: number, month: number): string[] {
  const total = daysInMonth(year, month);
  return Array.from({ length: total }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

/**
 * Месяц как сетка недель: 6 строк по 7 дней, с понедельника. Дни соседних
 * месяцев — null, чтобы числа стояли под своими днями недели.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const days = monthDays(year, month);
  const leading = isoWeekday(days[0]) - 1;
  const cells: (string | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Все дни года подряд (365 или 366). */
export function yearDays(year: number): string[] {
  const days: string[] = [];
  for (let month = 1; month <= 12; month++) days.push(...monthDays(year, month));
  return days;
}

/** Какой это день года по счёту, начиная с 1. */
export function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = Date.UTC(y, 0, 1);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Напоминания
// ---------------------------------------------------------------------------

/** Казахстан живёт в одном поясе UTC+5 круглый год. */
const ALMATY_UTC_OFFSET = "+05:00";

/** Дата + "HH:mm" -> момент времени в Алматы, ISO со смещением. */
export function almatyTimestamp(dateKey: string, time: string): string {
  return `${dateKey}T${time.slice(0, 5)}:00${ALMATY_UTC_OFFSET}`;
}

/** Момент времени -> "HH:mm" в Алматы. */
export function almatyTimeOf(timestamp: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

/** Дата момента времени в Алматы, YYYY-MM-DD. */
export function almatyDateOf(timestamp: string): string {
  return todayInAlmaty(new Date(timestamp));
}
