import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import {
  createDayMark,
  createTask,
  deleteDayMark,
  deleteTask,
  getWeekByStart,
  listDayMarksForRange,
  listGoalsForWeek,
  listTasksForRange,
  saveTaskFromForm,
  setTaskDone,
} from "@/lib/api";
import { DayPanel } from "@/components/DayPanel";
import { MonthCard, type DayBadges } from "@/components/MonthCard";
import { TaskForm } from "@/components/TaskForm";
import { YearSquares, type DayStat } from "@/components/YearSquares";
import { todayInAlmaty, weekStartOf } from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";
import type { Task, TaskFormValue } from "@/lib/types";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function CalendarScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();
  const todayKey = todayInAlmaty();
  const { width } = useWindowDimensions();

  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [selected, setSelected] = useState<string | null>(null);

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: qk.tasksYear(year),
    queryFn: () => listTasksForRange(from, to),
  });

  const { data: marks, isLoading: marksLoading } = useQuery({
    queryKey: qk.dayMarksYear(year),
    queryFn: () => listDayMarksForRange(from, to),
  });

  // Цели нужны форме задачи — они привязаны к неделе выбранного дня.
  const selectedWeekStart = weekStartOf(selected ?? todayKey);
  const { data: week } = useQuery({
    queryKey: qk.week(selectedWeekStart),
    queryFn: () => getWeekByStart(selectedWeekStart),
  });
  const { data: goals } = useQuery({
    queryKey: qk.goals(week?.id ?? "none"),
    queryFn: () => listGoalsForWeek(week!.id),
    enabled: Boolean(week?.id),
  });

  const allTasks = tasks ?? [];
  const allMarks = marks ?? [];

  // Один проход по данным года: что показывать на числах и в квадратах.
  const badges = new Map<string, DayBadges>();
  const stats = new Map<string, DayStat>();

  function badgeOf(dateKey: string): DayBadges {
    let badge = badges.get(dateKey);
    if (!badge) {
      badge = { markColors: [], tasks: 0, tasksDone: 0, reminders: 0 };
      badges.set(dateKey, badge);
    }
    return badge;
  }

  for (const task of allTasks) {
    if (!task.date) continue;
    const badge = badgeOf(task.date);
    badge.tasks += 1;
    if (task.done) badge.tasksDone += 1;
    if (task.remind_at) badge.reminders += 1;
  }
  for (const mark of allMarks) {
    badgeOf(mark.date).markColors.push(mark.color);
  }
  for (const [dateKey, badge] of badges) {
    stats.set(dateKey, { done: badge.tasksDone, marked: badge.markColors.length > 0 });
  }

  const selectedMarks = selected ? allMarks.filter((m) => m.date === selected) : [];
  const selectedTasks = selected
    ? allTasks
        .filter((t) => t.date === selected)
        .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
    : [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.tasks });
    queryClient.invalidateQueries({ queryKey: qk.dayMarks });
  };

  const addMarkMutation = useMutation({
    mutationFn: ({ title, color }: { title: string; color: string }) =>
      createDayMark({ date: selected!, title, color }),
    onSuccess: invalidate,
  });

  const deleteMarkMutation = useMutation({ mutationFn: deleteDayMark, onSuccess: invalidate });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onSuccess: invalidate,
  });

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => createTask({ title, date: selected! }),
    onSuccess: invalidate,
  });

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormKey, setTaskFormKey] = useState(0);

  const saveTaskMutation = useMutation({
    mutationFn: (value: TaskFormValue) => saveTaskFromForm(editingTask, value),
    onSuccess: () => {
      invalidate();
      setTaskFormOpen(false);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: () => {
      invalidate();
      setTaskFormOpen(false);
    },
  });

  function openTask(task: Task) {
    setEditingTask(task);
    setTaskFormKey((k) => k + 1);
    setTaskFormOpen(true);
  }

  // Месяцы раскладываются в столько колонок, сколько влезает по ширине.
  const columns = width >= 1280 ? 4 : width >= 980 ? 3 : width >= 620 ? 2 : 1;
  const isLoading = tasksLoading || marksLoading;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Календарь</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <View style={styles.yearNav}>
        <Pressable style={styles.navButton} onPress={() => setYear((y) => y - 1)}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <Pressable style={styles.navButton} onPress={() => setYear((y) => y + 1)}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
        {year !== Number(todayKey.slice(0, 4)) ? (
          <Pressable style={styles.todayButton} onPress={() => setYear(Number(todayKey.slice(0, 4)))}>
            <Text style={styles.todayButtonText}>Текущий</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <YearSquares year={year} todayKey={todayKey} stats={stats} onPickDay={setSelected} />

          <View style={styles.monthsGrid}>
            {MONTHS.map((month) => (
              <View key={month} style={[styles.monthSlot, { width: `${100 / columns}%` }]}>
                <MonthCard
                  year={year}
                  month={month}
                  todayKey={todayKey}
                  badges={badges}
                  selected={selected}
                  onPickDay={setSelected}
                />
              </View>
            ))}
          </View>

          <Text style={styles.legend}>
            Точки под числом: цветные — важное, серая или зелёная — задачи дня, синяя — напоминание.
          </Text>
        </ScrollView>
      )}

      {selected ? (
        <DayPanel
          visible={Boolean(selected) && !taskFormOpen}
          dateKey={selected}
          marks={selectedMarks}
          tasks={selectedTasks}
          saving={addMarkMutation.isPending || deleteMarkMutation.isPending}
          onClose={() => setSelected(null)}
          onAddMark={(title, color) => addMarkMutation.mutate({ title, color })}
          onDeleteMark={(id) => deleteMarkMutation.mutate(id)}
          onToggleTask={(id, done) => toggleTaskMutation.mutate({ id, done })}
          onAddTask={(title) => addTaskMutation.mutate(title)}
          onOpenTask={openTask}
        />
      ) : null}

      {editingTask ? (
        <TaskForm
          key={`task-${taskFormKey}`}
          visible={taskFormOpen}
          initial={editingTask}
          weekStart={selectedWeekStart}
          goals={goals ?? []}
          defaultDate={selected}
          saving={saveTaskMutation.isPending || deleteTaskMutation.isPending}
          onClose={() => setTaskFormOpen(false)}
          onSave={(value) => saveTaskMutation.mutate(value)}
          onDelete={() => deleteTaskMutation.mutate(editingTask)}
        />
      ) : null}
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
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 18,
  },
  yearLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentMuted,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
  scroll: {
    paddingBottom: 24,
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthSlot: {
    padding: 5,
  },
  legend: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 10,
    paddingHorizontal: 5,
  },
});
