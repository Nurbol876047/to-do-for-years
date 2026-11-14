import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import {
  createGoal,
  createTask,
  deleteEvent,
  deleteGoal,
  deleteScheduleBlock,
  deleteTask,
  ensureWeek,
  getWeekByStart,
  listEventsForRange,
  listGoalsForWeek,
  listScheduleBlocks,
  listTasksForRange,
  saveBlockFromForm,
  saveTaskFromForm,
  setTaskDone,
  updateGoal,
  updateWeek,
} from "@/lib/api";
import { BlockForm, type BlockFormValue } from "@/components/BlockForm";
import { TaskForm, type TaskFormValue } from "@/components/TaskForm";
import { WeekDayCard } from "@/components/WeekDayCard";
import { WeekGoals } from "@/components/WeekGoals";
import { blocksForDate, dayItems, type DayItem, type FreeSlot } from "@/lib/blocks";
import {
  addDaysToKey,
  currentWeekStart,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  todayInAlmaty,
  weekDates,
  weekStartOf,
} from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { useDayWindow } from "@/lib/useDayWindow";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";
import type { Task, Weekday } from "@/lib/types";

// С этой ширины окна все 7 дней помещаются без прокрутки; уже — листаем вбок.
const FIT_ALL_DAYS_BREAKPOINT = 1360;

export default function WeekScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { width } = useWindowDimensions();
  const fitAllDays = width >= FIT_ALL_DAYS_BREAKPOINT;
  const queryClient = useQueryClient();

  // Неделя живёт в адресе (?start=YYYY-MM-DD) — чтобы «Обзор» мог открыть
  // любую неделю из архива, а ссылка на неделю оставалась рабочей.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const weekStart = start ? weekStartOf(start) : currentWeekStart();
  const goToWeek = (next: string) => router.setParams({ start: next });

  const dates = weekDates(weekStart);
  const weekEnd = dates[6];
  const todayKey = todayInAlmaty();

  const { data: week } = useQuery({
    queryKey: qk.week(weekStart),
    queryFn: () => getWeekByStart(weekStart),
  });

  const { data: goals } = useQuery({
    queryKey: qk.goals(week?.id ?? "none"),
    queryFn: () => listGoalsForWeek(week!.id),
    enabled: Boolean(week?.id),
  });

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: qk.scheduleBlocks,
    queryFn: listScheduleBlocks,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: qk.eventsRange(weekStart),
    queryFn: () => listEventsForRange(weekStart, weekEnd),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: qk.tasksRange(weekStart),
    queryFn: () => listTasksForRange(weekStart, weekEnd),
  });

  const dayWindow = useDayWindow();
  const weekGoals = goals ?? [];

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: qk.tasks });
  const invalidateWeek = () => {
    queryClient.invalidateQueries({ queryKey: qk.weeks });
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  };

  // Блок мог переехать между разовым и постоянным, поэтому обновляем оба списка.
  const invalidateBlocks = () => {
    queryClient.invalidateQueries({ queryKey: qk.scheduleBlocks });
    queryClient.invalidateQueries({ queryKey: qk.events });
  };

  const saveThemeMutation = useMutation({
    mutationFn: async (theme: string) => {
      const row = await ensureWeek(weekStart);
      await updateWeek(row.id, { theme: theme || null });
    },
    onSuccess: invalidateWeek,
  });

  const saveGoalMutation = useMutation({
    mutationFn: async ({ position, title }: { position: 1 | 2 | 3; title: string }) => {
      const existing = weekGoals.find((g) => g.position === position);
      if (!title) {
        if (existing) await deleteGoal(existing.id);
        return;
      }
      if (existing) {
        await updateGoal(existing.id, { title });
        return;
      }
      const row = await ensureWeek(weekStart);
      await createGoal({ week_id: row.id, title, position });
    },
    onSuccess: invalidateWeek,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onSuccess: invalidateTasks,
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ title, date }: { title: string; date: string }) => createTask({ title, date }),
    onSuccess: invalidateTasks,
  });

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormKey, setTaskFormKey] = useState(0);

  const saveTaskMutation = useMutation({
    mutationFn: (value: TaskFormValue) => saveTaskFromForm(editingTask, value),
    onSuccess: () => {
      invalidateTasks();
      setTaskFormOpen(false);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: () => {
      invalidateTasks();
      setTaskFormOpen(false);
    },
  });

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskFormKey((k) => k + 1);
    setTaskFormOpen(true);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DayItem | null>(null);
  const [formWeekday, setFormWeekday] = useState<Weekday>(1);
  const [formTimes, setFormTimes] = useState<{ start: string; end: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const saveBlockMutation = useMutation({
    mutationFn: (value: BlockFormValue) => saveBlockFromForm(editingItem, value),
    onSuccess: () => {
      invalidateBlocks();
      setFormOpen(false);
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (item: DayItem) => (item.kind === "event" ? deleteEvent(item.id) : deleteScheduleBlock(item.id)),
    onSuccess: () => {
      invalidateBlocks();
      setFormOpen(false);
    },
  });

  function openCreateBlock(weekday: Weekday, slot?: FreeSlot) {
    setEditingItem(null);
    setFormWeekday(weekday);
    setFormTimes(slot ? slotDefaultTimes(slot) : null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEditBlock(item: DayItem) {
    setEditingItem(item);
    setFormWeekday(item.kind === "event" ? isoWeekday(item.date) : item.weekday);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  const isLoading = blocksLoading || eventsLoading || tasksLoading;
  const weekRangeLabel = formatWeekRange(dates[0], dates[6]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Неделя</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <View style={styles.weekNav}>
        <Pressable style={styles.navButton} onPress={() => goToWeek(addDaysToKey(weekStart, -7))}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.weekRange}>{weekRangeLabel}</Text>
        <Pressable style={styles.navButton} onPress={() => goToWeek(addDaysToKey(weekStart, 7))}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
        {weekStart !== currentWeekStart() ? (
          <Pressable style={styles.todayButton} onPress={() => goToWeek(currentWeekStart())}>
            <Text style={styles.todayButtonText}>Текущая</Text>
          </Pressable>
        ) : null}
      </View>

      <WeekGoals
        theme={week?.theme ?? null}
        goals={weekGoals}
        onSaveTheme={(value) => saveThemeMutation.mutate(value)}
        onSaveGoal={(position, title) => saveGoalMutation.mutate({ position, title })}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <WeekGrid fitAllDays={fitAllDays}>
          {dates.map((dateKey) => {
            const weekday = isoWeekday(dateKey);
            const items = dayItems(
              blocksForDate(blocks ?? [], dateKey),
              (events ?? []).filter((e) => e.date === dateKey)
            );
            const dayTasks = (tasks ?? []).filter((t) => t.date === dateKey);

            return (
              <View key={dateKey} style={fitAllDays ? styles.columnFit : styles.column}>
                <WeekDayCard
                  dateKey={dateKey}
                  isToday={dateKey === todayKey}
                  compact={fitAllDays}
                  items={items}
                  tasks={dayTasks}
                  goals={weekGoals}
                  dayWindow={dayWindow}
                  onToggleTask={(id, done) => toggleTaskMutation.mutate({ id, done })}
                  onAddTask={(title) => addTaskMutation.mutate({ title, date: dateKey })}
                  onEditTask={openEditTask}
                  onEditItem={openEditBlock}
                  onAddBlock={(slot) => openCreateBlock(weekday, slot)}
                />
              </View>
            );
          })}
        </WeekGrid>
      )}

      <BlockForm
        key={`block-${formKey}`}
        visible={formOpen}
        initial={editingItem}
        defaultWeekday={formWeekday}
        defaultStartTime={formTimes?.start}
        defaultEndTime={formTimes?.end}
        weekStart={weekStart}
        saving={saveBlockMutation.isPending || deleteBlockMutation.isPending}
        onClose={() => setFormOpen(false)}
        onSave={(value) => saveBlockMutation.mutate(value)}
        onDelete={editingItem ? () => deleteBlockMutation.mutate(editingItem) : undefined}
      />

      <TaskForm
        key={`task-${taskFormKey}`}
        visible={taskFormOpen}
        initial={editingTask}
        weekStart={weekStart}
        goals={weekGoals}
        saving={saveTaskMutation.isPending || deleteTaskMutation.isPending}
        onClose={() => setTaskFormOpen(false)}
        onSave={(value) => saveTaskMutation.mutate(value)}
        onDelete={editingTask ? () => deleteTaskMutation.mutate(editingTask) : undefined}
      />
    </View>
  );
}

/** Свободное окно предзаполняем целиком, но не длиннее часа — так удобнее дробить. */
function slotDefaultTimes(slot: FreeSlot): { start: string; end: string } {
  const start = timeToMinutes(slot.start_time);
  const end = Math.min(timeToMinutes(slot.end_time), start + 60);
  return { start: slot.start_time, end: minutesToTime(end) };
}

function WeekGrid({ fitAllDays, children }: { fitAllDays: boolean; children: ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {fitAllDays ? (
        <View style={styles.grid}>{children}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {children}
        </ScrollView>
      )}
    </ScrollView>
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
    alignItems: "flex-start",
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
  grid: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 20,
  },
  column: {
    width: 280,
  },
  columnFit: {
    flex: 1,
  },
});
