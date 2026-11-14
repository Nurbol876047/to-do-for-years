import { useMemo } from "react";
// «365 дней»: год одной полосой — квадрат на каждый день, по колонке на неделю.
// Прожитые дни заполняются, насыщенность — по числу сделанных задач.

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { addDaysToKey, dayOfYear, MONTH_LABELS, weekStartOf, yearDays } from "@/lib/date";
import { useColors, type Palette } from "@/lib/theme";

const CELL = 11;
const GAP = 3;

/** Четыре ступени заливки: прожитый день без задач → всё сделано. */
const LEVELS = ["#E8EBEF", "#BFD8FD", "#7FB0FA", "#2563EB"] as const;

export interface DayStat {
  done: number;
  marked: boolean;
}

interface Props {
  year: number;
  todayKey: string;
  /** dateKey -> что было в этот день. */
  stats: Map<string, DayStat>;
  onPickDay: (dateKey: string) => void;
}

export function YearSquares({ year, todayKey, stats, onPickDay }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const days = yearDays(year);
  const lastDay = days[days.length - 1];

  // Колонки — недели с понедельника, поэтому начинаем с понедельника перед 1 января.
  const columns: (string | null)[][] = [];
  let cursor = weekStartOf(days[0]);
  while (cursor <= lastDay) {
    const week: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = addDaysToKey(cursor, i);
      week.push(dateKey.slice(0, 4) === String(year) ? dateKey : null);
    }
    columns.push(week);
    cursor = addDaysToKey(cursor, 7);
  }

  const passed = todayKey.slice(0, 4) === String(year) ? dayOfYear(todayKey) : todayKey < days[0] ? 0 : days.length;
  const counter =
    passed === 0
      ? `${days.length} дней впереди`
      : `День ${passed} из ${days.length} · осталось ${days.length - passed}`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>365 дней</Text>
        <Text style={styles.counter}>{counter}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.monthRow, { width: columns.length * (CELL + GAP) }]}>
            {columns.map((week, i) => {
              // Подпись — над колонкой той недели, в которую попало 1-е число.
              // Она шире колонки, поэтому ставится поверх сетки, а не в ряд.
              const firstOfMonth = week.find((dateKey) => dateKey?.endsWith("-01"));
              if (!firstOfMonth) return null;
              const monthIndex = Number(firstOfMonth.slice(5, 7)) - 1;
              return (
                <Text key={`m-${i}`} style={[styles.monthLabel, { left: i * (CELL + GAP) }]} numberOfLines={1}>
                  {MONTH_LABELS[monthIndex].slice(0, 3)}
                </Text>
              );
            })}
          </View>

          <View style={styles.grid}>
            {columns.map((week, i) => (
              <View key={`w-${i}`} style={styles.column}>
                {week.map((dateKey, j) => {
                  if (!dateKey) return <View key={`e-${j}`} style={styles.cellEmpty} />;

                  const stat = stats.get(dateKey);
                  const future = dateKey > todayKey;
                  const level = future ? -1 : Math.min(stat?.done ?? 0, LEVELS.length - 1);

                  return (
                    <Pressable
                      key={dateKey}
                      onPress={() => onPickDay(dateKey)}
                      style={[
                        styles.cell,
                        future ? styles.cellFuture : { backgroundColor: LEVELS[level] },
                        stat?.marked && styles.cellMarked,
                        dateKey === todayKey && styles.cellToday,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendText}>меньше</Text>
        {LEVELS.map((color) => (
          <View key={color} style={[styles.cell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendText}>больше сделано</Text>
        <View style={[styles.cell, styles.cellFuture, { marginLeft: 10 }]} />
        <Text style={styles.legendText}>впереди</Text>
        <View style={[styles.cell, styles.cellMarked, { backgroundColor: LEVELS[0] }]} />
        <Text style={styles.legendText}>важный день</Text>
      </View>
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
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  counter: {
    fontSize: 13,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  monthRow: {
    height: 14,
    marginBottom: 2,
  },
  monthLabel: {
    position: "absolute",
    top: 0,
    fontSize: 10,
    color: colors.textFaint,
  },
  grid: {
    flexDirection: "row",
    gap: GAP,
  },
  column: {
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
  cellEmpty: {
    width: CELL,
    height: CELL,
  },
  cellFuture: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellMarked: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textFaint,
    marginHorizontal: 4,
  },
});
