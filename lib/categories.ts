// Куда уходит неделя: блоки дня разложены по категориям, сверху — сон (всё,
// что вне окна дня) и свободное время внутри окна. Сумма всегда 168 часов,
// поэтому «Обзор» показывает честный бюджет недели, а не просто «занято».

import { freeSlots } from "@/lib/blocks";
import { timeToMinutes } from "@/lib/date";
import type { DayItem, DayWindow } from "@/lib/blocks";
import type { BlockCategory } from "@/lib/types";

export const CATEGORY_ORDER: BlockCategory[] = ["study", "work", "oscp", "english", "sport", "meals", "other"];

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  study: "Учёба",
  work: "Работа",
  oscp: "OSCP",
  english: "Английский",
  sport: "Спорт",
  meals: "Еда",
  other: "Прочее",
};

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  study: "#2563EB",
  work: "#475569",
  oscp: "#4338CA",
  english: "#EA580C",
  sport: "#65A30D",
  meals: "#CA8A04",
  other: "#0891B2",
};

const MINUTES_IN_WEEK = 7 * 24 * 60;

export interface BudgetRow {
  key: BlockCategory | "sleep" | "life" | "free" | "gaps";
  label: string;
  color: string;
  minutes: number;
  /** Доля от 168 часов, 0..1. */
  share: number;
}

export interface WeekBudget {
  rows: BudgetRow[];
  /** Часы, размеченные блоками (без сна и свободного). */
  plannedMinutes: number;
  totalMinutes: number;
}

/**
 * Бюджет недели по дням. Блоки обрезаются окном дня — так же, как считается
 * свободное время, иначе сумма не сойдётся с 168 часами.
 */
export function weekBudget(days: DayItem[][], window: DayWindow, sleepHours: number): WeekBudget {
  const windowStart = timeToMinutes(window.start);
  const windowEnd = timeToMinutes(window.end);
  const windowLength = Math.max(0, windowEnd - windowStart);

  const byCategory = new Map<BlockCategory, number>();
  let busy = 0;
  let free = 0;

  for (const items of days) {
    free += freeSlots(items, window).reduce((sum, slot) => sum + slot.minutes, 0);

    // Пересекающиеся блоки не должны считаться дважды, поэтому занятость дня
    // собирается по тем же правилам, что и в freeSlots: курсор идёт вперёд.
    let cursor = windowStart;
    const sorted = [...items].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    for (const item of sorted) {
      const start = Math.max(cursor, Math.max(windowStart, timeToMinutes(item.start_time)));
      const end = Math.min(windowEnd, timeToMinutes(item.end_time));
      if (end <= start) continue;

      const category: BlockCategory = item.category ?? "other";
      byCategory.set(category, (byCategory.get(category) ?? 0) + (end - start));
      busy += end - start;
      cursor = end;
    }
  }

  // Свободное считаем тем же freeSlots, что и «Итоги недели», иначе две
  // карточки в «Обзоре» разойдутся. Окна короче MIN_FREE_MINUTES он отбрасывает
  // — это перемены между парами, они идут отдельной строкой.
  const freeMinutes = Math.min(free, Math.max(0, windowLength * days.length - busy));
  const gapMinutes = Math.max(0, windowLength * days.length - busy - freeMinutes);
  // Вне окна дня — сон плюс всё остальное (дорога, душ, то, что после отбоя).
  // Сон задан настройкой, поэтому его видно отдельной строкой: по ней сразу
  // понятно, сходится ли «7–8 часов каждый день» с остальной неделей.
  const offWindow = Math.max(0, MINUTES_IN_WEEK - windowLength * days.length);
  const sleepMinutes = Math.min(offWindow, Math.round(sleepHours * 60) * days.length);
  const lifeMinutes = offWindow - sleepMinutes;

  const rows: BudgetRow[] = CATEGORY_ORDER.filter((key) => (byCategory.get(key) ?? 0) > 0).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    color: CATEGORY_COLORS[key],
    minutes: byCategory.get(key) ?? 0,
    share: (byCategory.get(key) ?? 0) / MINUTES_IN_WEEK,
  }));

  if (gapMinutes > 0) {
    rows.push({
      key: "gaps",
      label: "Перемены и переезды",
      color: "#CBD5E1",
      minutes: gapMinutes,
      share: gapMinutes / MINUTES_IN_WEEK,
    });
  }
  rows.push({
    key: "free",
    label: "Свободно",
    color: "#94A3B8",
    minutes: freeMinutes,
    share: freeMinutes / MINUTES_IN_WEEK,
  });
  rows.push({
    key: "sleep",
    label: "Сон",
    color: "#64748B",
    minutes: sleepMinutes,
    share: sleepMinutes / MINUTES_IN_WEEK,
  });
  if (lifeMinutes > 0) {
    rows.push({
      key: "life",
      label: "Быт и дорога",
      color: "#A1A1AA",
      minutes: lifeMinutes,
      share: lifeMinutes / MINUTES_IN_WEEK,
    });
  }

  return { rows, plannedMinutes: busy, totalMinutes: MINUTES_IN_WEEK };
}
