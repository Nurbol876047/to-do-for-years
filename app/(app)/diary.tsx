import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { addDaysToKey, formatDayLabel, todayInAlmaty } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";

interface DiaryPlan {
  id: string;
  text: string;
  done: boolean;
}

interface DiaryEntry {
  id: string;
  /** Смещение от сегодня в днях: 0 — сегодня, -1 — вчера. */
  dayOffset: number;
  mood: string;
  body: string;
  plans: DiaryPlan[];
}

/**
 * Заглушка: записи живут в памяти и пропадают при перезагрузке.
 * Заменить на запрос к api, когда появится таблица дневника в Supabase.
 */
const MOCK_ENTRIES: DiaryEntry[] = [
  {
    id: "today",
    dayOffset: 0,
    mood: "Собранный",
    body:
      "Утро ушло на криптографию — наконец понял, зачем в схеме нужен второй раунд. " +
      "День плотный, но окно после обеда оставил пустым специально.",
    plans: [
      { id: "t1", text: "Дописать конспект по мат. криптографии", done: true },
      { id: "t2", text: "Подготовить заметки к созвону в 15:00", done: false },
      { id: "t3", text: "Вечером 40 минут на чтение", done: false },
    ],
  },
  {
    id: "yesterday",
    dayOffset: -1,
    mood: "Рассеянный",
    body:
      "Весь день дёргали мелкие задачи, большие сдвинулись. Вывод простой: " +
      "входящие разбирать утром, а не между делом.",
    plans: [
      { id: "y1", text: "Разобрать входящие до нуля", done: true },
      { id: "y2", text: "Тренировка в 19:00", done: true },
      { id: "y3", text: "Записать траты за неделю", done: false },
    ],
  },
];

export default function DiaryScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState(MOCK_ENTRIES);
  const todayKey = todayInAlmaty();

  function togglePlan(entryId: string, planId: string) {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id !== entryId
          ? entry
          : {
              ...entry,
              plans: entry.plans.map((plan) =>
                plan.id === planId ? { ...plan, done: !plan.done } : plan
              ),
            }
      )
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Дневник</Text>
          <Text style={styles.subtitle}>Как прошёл день и что было в планах.</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {entries.map((entry) => {
          const dateKey = addDaysToKey(todayKey, entry.dayOffset);
          const doneCount = entry.plans.filter((plan) => plan.done).length;

          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.date}>{formatDayLabel(dateKey)}</Text>
                <View style={styles.mood}>
                  <Text style={styles.moodText}>{entry.mood}</Text>
                </View>
              </View>

              <Text style={styles.body}>{entry.body}</Text>

              <View style={styles.plansHeader}>
                <Text style={styles.plansTitle}>Планы</Text>
                <Text style={styles.plansCount}>
                  {doneCount} из {entry.plans.length}
                </Text>
              </View>

              <View style={styles.plans}>
                {entry.plans.map((plan) => (
                  <Pressable
                    key={plan.id}
                    style={styles.plan}
                    onPress={() => togglePlan(entry.id, plan.id)}
                  >
                    <View style={StyleSheet.flatten([styles.box, plan.done && styles.boxDone])}>
                      {plan.done ? <Text style={styles.boxMark}>✓</Text> : null}
                    </View>
                    <Text style={StyleSheet.flatten([styles.planText, plan.done && styles.planTextDone])}>
                      {plan.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={styles.note}>Записи пока демонстрационные — хранилище ещё не подключено.</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    signOut: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: "600",
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: 12,
      paddingBottom: 16,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    date: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    mood: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.accentMuted,
    },
    moodText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    plansHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },
    plansTitle: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textFaint,
    },
    plansCount: {
      fontSize: 12,
      color: colors.textFaint,
    },
    plans: {
      gap: 8,
    },
    plan: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    box: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    boxDone: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    boxMark: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    planText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    planTextDone: {
      color: colors.textFaint,
      textDecorationLine: "line-through",
    },
    note: {
      fontSize: 11,
      color: colors.textFaint,
      marginTop: 2,
    },
  });
