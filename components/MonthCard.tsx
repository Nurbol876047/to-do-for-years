import { useMemo } from "react";
// Месяц в календаре: числа по дням недели, под числом — метки дня.

import { Pressable, StyleSheet, Text, View } from "react-native";

import { MONTH_LABELS, monthGrid, WEEKDAY_LABELS_SHORT } from "@/lib/date";
import { useColors, type Palette } from "@/lib/theme";

export interface DayBadges {
  /** Цвета отметок «важное» — показываем до трёх точек. */
  markColors: string[];
  tasks: number;
  tasksDone: number;
  reminders: number;
}

interface Props {
  year: number;
  month: number; // 1..12
  todayKey: string;
  badges: Map<string, DayBadges>;
  selected: string | null;
  onPickDay: (dateKey: string) => void;
}

export function MonthCard({ year, month, todayKey, badges, selected, onPickDay }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const weeks = monthGrid(year, month);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{MONTH_LABELS[month - 1]}</Text>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS_SHORT.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((dateKey, j) => {
            if (!dateKey) return <View key={`e-${j}`} style={styles.dayCell} />;

            const day = badges.get(dateKey);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selected;
            const allDone = Boolean(day && day.tasks > 0 && day.tasksDone === day.tasks);

            return (
              <Pressable
                key={dateKey}
                style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && styles.dayCellToday]}
                onPress={() => onPickDay(dateKey)}
              >
                <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{Number(dateKey.slice(8))}</Text>

                <View style={styles.dots}>
                  {(day?.markColors ?? []).slice(0, 3).map((color, k) => (
                    <View key={`m-${k}`} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                  {day && day.tasks > 0 ? (
                    <View style={[styles.dot, allDone ? styles.dotDone : styles.dotTask]} />
                  ) : null}
                  {day && day.reminders > 0 ? <View style={[styles.dot, styles.dotReminder]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: colors.textFaint,
    fontWeight: "600",
  },
  week: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 1,
  },
  dayCellToday: {
    backgroundColor: colors.accentMuted,
  },
  dayCellSelected: {
    borderColor: colors.accent,
  },
  dayNumber: {
    fontSize: 12,
    lineHeight: 14,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  dayNumberToday: {
    fontWeight: "700",
    color: colors.accent,
  },
  dots: {
    flexDirection: "row",
    gap: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotTask: {
    backgroundColor: colors.textFaint,
  },
  dotDone: {
    backgroundColor: "#059669",
  },
  dotReminder: {
    backgroundColor: colors.accent,
  },
});
