import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import {
  createNote,
  deleteNote,
  ensureWeek,
  getWeekByStart,
  listEventsForRange,
  listGoalsForWeek,
  listNotesForWeek,
  listScheduleBlocks,
  listTasksForRange,
  listWeeks,
  updateWeek,
} from "@/lib/api";
import { blocksForDate, busyMinutes, dayItems, freeSlots, type DayItem } from "@/lib/blocks";
import { weekBudget, type BudgetRow } from "@/lib/categories";
import { addDaysToKey, currentWeekStart, formatDuration, formatTime, weekDates, weekStartOf } from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { useDayWindow, useSleepHours } from "@/lib/useDayWindow";
import { supabase } from "@/lib/supabase";
import { goalColor, useColors, type Palette } from "@/lib/theme";

export default function ReviewScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const weekStart = start ? weekStartOf(start) : currentWeekStart();
  const goToWeek = (next: string) => router.setParams({ start: next });

  const dates = weekDates(weekStart);
  const weekEnd = dates[6];

  const { data: week, isLoading: weekLoading } = useQuery({
    queryKey: qk.week(weekStart),
    queryFn: () => getWeekByStart(weekStart),
  });

  const { data: goals } = useQuery({
    queryKey: qk.goals(week?.id ?? "none"),
    queryFn: () => listGoalsForWeek(week!.id),
    enabled: Boolean(week?.id),
  });

  const { data: notes } = useQuery({
    queryKey: qk.notesWeek(week?.id ?? "none"),
    queryFn: () => listNotesForWeek(week!.id),
    enabled: Boolean(week?.id),
  });

  const { data: blocks } = useQuery({ queryKey: qk.scheduleBlocks, queryFn: listScheduleBlocks });
  const { data: events } = useQuery({
    queryKey: qk.eventsRange(weekStart),
    queryFn: () => listEventsForRange(weekStart, weekEnd),
  });
  const { data: tasks } = useQuery({
    queryKey: qk.tasksRange(weekStart),
    queryFn: () => listTasksForRange(weekStart, weekEnd),
  });
  const { data: archive } = useQuery({ queryKey: qk.weeks, queryFn: listWeeks });

  const dayWindow = useDayWindow();
  const sleepHours = useSleepHours();
  const weekGoals = goals ?? [];
  const weekTasks = tasks ?? [];
  const doneCount = weekTasks.filter((t) => t.done).length;

  let busy = 0;
  let free = 0;
  const weekItems: DayItem[][] = [];
  for (const dateKey of dates) {
    const items = dayItems(
      blocksForDate(blocks ?? [], dateKey),
      (events ?? []).filter((e) => e.date === dateKey)
    );
    weekItems.push(items);
    busy += busyMinutes(items);
    free += freeSlots(items, dayWindow).reduce((sum, slot) => sum + slot.minutes, 0);
  }

  const budget = weekBudget(weekItems, dayWindow, sleepHours);

  const invalidateWeek = () => {
    queryClient.invalidateQueries({ queryKey: qk.weeks });
    queryClient.invalidateQueries({ queryKey: qk.notes });
  };

  const saveReviewMutation = useMutation({
    mutationFn: async (patch: { review_done?: boolean; review_note?: string | null }) => {
      const row = await ensureWeek(weekStart);
      await updateWeek(row.id, patch);
    },
    onSuccess: invalidateWeek,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const row = await ensureWeek(weekStart);
      await createNote({ body, week_id: row.id });
    },
    onSuccess: invalidateWeek,
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: invalidateWeek,
  });

  const [noteDraft, setNoteDraft] = useState("");

  function handleAddNote() {
    const body = noteDraft.trim();
    if (!body) return;
    addNoteMutation.mutate(body);
    setNoteDraft("");
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Обзор и заметки</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <View style={styles.weekNav}>
        <Pressable style={styles.navButton} onPress={() => goToWeek(addDaysToKey(weekStart, -7))}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.weekRange}>{formatWeekRange(dates[0], dates[6])}</Text>
        <Pressable style={styles.navButton} onPress={() => goToWeek(addDaysToKey(weekStart, 7))}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
        {weekStart !== currentWeekStart() ? (
          <Pressable style={styles.todayButton} onPress={() => goToWeek(currentWeekStart())}>
            <Text style={styles.todayButtonText}>Текущая</Text>
          </Pressable>
        ) : null}
      </View>

      {weekLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Тема недели</Text>
            <Text style={week?.theme ? styles.themeText : styles.empty}>
              {week?.theme ?? "Не задана — её можно вписать на экране «Неделя»."}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Цели</Text>
            {weekGoals.length === 0 ? <Text style={styles.empty}>Цели не заданы.</Text> : null}
            {weekGoals.map((goal) => {
              const goalTasks = weekTasks.filter((t) => t.goal_id === goal.id);
              const goalDone = goalTasks.filter((t) => t.done).length;
              return (
                <View key={goal.id} style={styles.goalRow}>
                  <View style={[styles.goalDot, { backgroundColor: goalColor(goal.position) }]} />
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.goalCount}>
                    {goalDone}/{goalTasks.length}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Итоги недели</Text>
            <View style={styles.statsRow}>
              <Stat label="Задачи" value={`${doneCount}/${weekTasks.length}`} />
              <Stat label="Занято" value={formatDuration(busy)} />
              <Stat label="Свободно" value={formatDuration(free)} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Куда уходит неделя</Text>
            {budget.plannedMinutes === 0 ? (
              <Text style={styles.empty}>В этой неделе нет ни одного блока.</Text>
            ) : (
              budget.rows.map((row) => <BudgetBar key={row.key} row={row} />)
            )}
            <Text style={styles.budgetHint}>
              Всего 168 ч в неделю. Сон — {sleepHours} ч в сутки, остальное вне окна дня (
              {formatTime(dayWindow.start)}–{formatTime(dayWindow.end)}) идёт в «Быт и дорогу». И окно, и сон
              меняются на экране «Расписание».
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Разбор недели</Text>
              <Switch
                value={week?.review_done ?? false}
                onValueChange={(value) => saveReviewMutation.mutate({ review_done: value })}
              />
            </View>
            <ReviewNote
              key={`note-${week?.review_note ?? ""}`}
              value={week?.review_note ?? ""}
              onCommit={(value) => saveReviewMutation.mutate({ review_note: value || null })}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Заметки недели</Text>
            {(notes ?? []).length === 0 ? <Text style={styles.empty}>Заметок пока нет.</Text> : null}
            {(notes ?? []).map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <Text style={styles.noteText}>{note.body ?? note.title ?? ""}</Text>
                <Pressable onPress={() => deleteNoteMutation.mutate(note.id)}>
                  <Text style={styles.noteDelete}>Удалить</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              style={styles.input}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="+ заметка"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleAddNote}
              returnKeyType="done"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Архив недель</Text>
            {(archive ?? []).length === 0 ? <Text style={styles.empty}>Пока только текущая неделя.</Text> : null}
            {(archive ?? []).map((row) => {
              const rowDates = weekDates(row.week_start);
              return (
                <View key={row.id} style={styles.archiveRow}>
                  <Pressable style={styles.archiveMain} onPress={() => goToWeek(row.week_start)}>
                    <Text style={styles.archiveRange}>{formatWeekRange(rowDates[0], rowDates[6])}</Text>
                    <Text style={styles.archiveTheme} numberOfLines={1}>
                      {row.theme ?? "без темы"}
                    </Text>
                  </Pressable>
                  {row.review_done ? <Text style={styles.archiveBadge}>разобрана</Text> : null}
                  <Link href={{ pathname: "/week", params: { start: row.week_start } }} style={styles.archiveLink}>
                    неделя →
                  </Link>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** Строка бюджета: название, часы и полоса доли от 168 часов недели. */
function BudgetBar({ row }: { row: BudgetRow }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.budgetRow}>
      <View style={styles.budgetHeader}>
        <View style={[styles.budgetDot, { backgroundColor: row.color }]} />
        <Text style={styles.budgetLabel}>{row.label}</Text>
        <Text style={styles.budgetValue}>{formatDuration(row.minutes)}</Text>
        <Text style={styles.budgetShare}>{Math.round(row.share * 100)}%</Text>
      </View>
      <View style={styles.budgetTrack}>
        <View
          style={[styles.budgetFill, { backgroundColor: row.color, width: `${Math.max(1, row.share * 100)}%` }]}
        />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Как InlineField в WeekGoals: правка по месту, сохранение по потере фокуса. */
function ReviewNote({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState(value);
  return (
    <TextInput
      style={[styles.input, styles.noteInput]}
      value={draft}
      onChangeText={setDraft}
      placeholder="Что получилось, что мешало, что меняем на следующей неделе"
      placeholderTextColor={colors.textMuted}
      multiline
      onBlur={() => {
        const next = draft.trim();
        if (next !== value) onCommit(next);
      }}
    />
  );
}

function formatWeekRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-");
  const [, em, ed] = end.split("-");
  return `${sd}.${sm} – ${ed}.${em}`;
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
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  signOut: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "700",
  },
  weekRange: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    minWidth: 120,
    textAlign: "center",
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.accentMuted,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  content: {
    gap: 12,
    paddingBottom: 24,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  themeText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalTitle: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  goalCount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  budgetRow: {
    gap: 4,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  budgetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  budgetLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  budgetShare: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
    minWidth: 34,
    textAlign: "right",
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  budgetFill: {
    height: "100%",
    borderRadius: 3,
  },
  budgetHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  noteDelete: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  archiveMain: {
    flex: 1,
  },
  archiveRange: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  archiveTheme: {
    fontSize: 12,
    color: colors.textMuted,
  },
  archiveBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archiveLink: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
});
