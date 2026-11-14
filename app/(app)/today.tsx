import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createTask,
  deleteEvent,
  deleteScheduleBlock,
  deleteTask,
  getWeekByStart,
  listEventsForDate,
  listGoalsForWeek,
  listScheduleBlocks,
  listTasksForDate,
  saveBlockFromForm,
  saveTaskFromForm,
  setTaskDone,
} from "@/lib/api";
import { BlockForm } from "@/components/BlockForm";
import { TaskForm } from "@/components/TaskForm";
import { TaskRow } from "@/components/TaskRow";
import {
  blocksForDate,
  busyMinutes,
  dayItems,
  dayRows,
  splitBlockTitle,
  type DayItem,
  type FreeSlot,
} from "@/lib/blocks";
import {
  formatDayLabel,
  formatDuration,
  formatTime,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  todayInAlmaty,
  weekStartOf,
} from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { useDayWindow } from "@/lib/useDayWindow";
import { supabase } from "@/lib/supabase";
import { goalColor, useColors, type Palette } from "@/lib/theme";
import type { BlockFormValue, Task, TaskFormValue } from "@/lib/types";

export default function TodayScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dateKey = todayInAlmaty();
  const weekStart = weekStartOf(dateKey);
  const weekday = isoWeekday(dateKey);
  const queryClient = useQueryClient();

  const { data: week } = useQuery({ queryKey: qk.week(weekStart), queryFn: () => getWeekByStart(weekStart) });

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
    queryKey: qk.eventsDate(dateKey),
    queryFn: () => listEventsForDate(dateKey),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: qk.tasksDate(dateKey),
    queryFn: () => listTasksForDate(dateKey),
  });

  const dayWindow = useDayWindow();
  const weekGoals = goals ?? [];
  const dayTasks = tasks ?? [];
  const items = dayItems(blocksForDate(blocks ?? [], dateKey), events ?? []);
  const rows = dayRows(items, dayWindow);
  const mainTask = dayTasks.find((t) => t.is_main) ?? null;
  const doneCount = dayTasks.filter((t) => t.done).length;

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: qk.tasks });
  const invalidateBlocks = () => {
    queryClient.invalidateQueries({ queryKey: qk.scheduleBlocks });
    queryClient.invalidateQueries({ queryKey: qk.events });
  };

  const [draft, setDraft] = useState("");

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onSuccess: invalidateTasks,
  });

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => createTask({ title, date: dateKey }),
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

  function openTask(task: Task | null) {
    setEditingTask(task);
    setTaskFormKey((k) => k + 1);
    setTaskFormOpen(true);
  }

  const [blockFormOpen, setBlockFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DayItem | null>(null);
  const [formTimes, setFormTimes] = useState<{ start: string; end: string } | null>(null);
  const [blockFormKey, setBlockFormKey] = useState(0);

  const saveBlockMutation = useMutation({
    mutationFn: (value: BlockFormValue) => saveBlockFromForm(editingItem, value),
    onSuccess: () => {
      invalidateBlocks();
      setBlockFormOpen(false);
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (item: DayItem) => (item.kind === "event" ? deleteEvent(item.id) : deleteScheduleBlock(item.id)),
    onSuccess: () => {
      invalidateBlocks();
      setBlockFormOpen(false);
    },
  });

  function openBlock(item: DayItem | null, slot?: FreeSlot) {
    setEditingItem(item);
    setFormTimes(slot ? slotDefaultTimes(slot) : null);
    setBlockFormKey((k) => k + 1);
    setBlockFormOpen(true);
  }

  function handleAddTask() {
    const title = draft.trim();
    if (!title) return;
    addTaskMutation.mutate(title);
    setDraft("");
  }

  const isLoading = blocksLoading || eventsLoading || tasksLoading;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Сегодня</Text>
          <Text style={styles.subtitle}>{formatDayLabel(dateKey)}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {week?.theme ? (
            <View style={styles.themeCard}>
              <Text style={styles.cardLabel}>Тема недели</Text>
              <Text style={styles.themeText}>{week.theme}</Text>
            </View>
          ) : null}

          <View style={[styles.card, styles.mainCard]}>
            <Text style={styles.cardLabel}>Главная задача дня</Text>
            {mainTask ? (
              <TaskRow
                task={mainTask}
                goal={weekGoals.find((g) => g.id === mainTask.goal_id) ?? null}
                onToggleDone={() => toggleTaskMutation.mutate({ id: mainTask.id, done: !mainTask.done })}
                onPress={() => openTask(mainTask)}
              />
            ) : (
              <Text style={styles.empty}>
                Не выбрана. Откройте задачу и включите «Главная задача дня» — она одна на день.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>План дня</Text>
              <Text style={styles.cardMeta}>занято {formatDuration(busyMinutes(items))}</Text>
            </View>

            {rows.map((row) => {
              if (row.type === "free") {
                const { slot } = row;
                return (
                  <Pressable
                    key={`free-${slot.start_time}`}
                    style={styles.itemRow}
                    onPress={() => openBlock(null, slot)}
                  >
                    <View style={styles.freeBar} />
                    <View style={styles.itemBody}>
                      <Text style={styles.freeTime}>
                        {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                      </Text>
                      <Text style={styles.freeLabel}>Свободно · {formatDuration(slot.minutes)}</Text>
                    </View>
                  </Pressable>
                );
              }

              const { item } = row;
              const { name, details } = splitBlockTitle(item.title);
              return (
                <Pressable key={`${item.kind}-${item.id}`} style={styles.itemRow} onPress={() => openBlock(item)}>
                  <View style={[styles.itemBar, { backgroundColor: item.color }]} />
                  <View style={styles.itemBody}>
                    <View style={styles.itemTimeRow}>
                      <Text style={styles.itemTime}>
                        {formatTime(item.start_time)}–{formatTime(item.end_time)}
                      </Text>
                      {item.kind === "event" ? <Text style={styles.oneOffBadge}>вне плана</Text> : null}
                    </View>
                    <Text style={styles.itemName}>{name}</Text>
                    {details ? <Text style={styles.itemDetails}>{details}</Text> : null}
                  </View>
                </Pressable>
              );
            })}

            <Pressable style={styles.dashedButton} onPress={() => openBlock(null)}>
              <Text style={styles.dashedButtonText}>+ блок</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Задачи</Text>
              <Text style={styles.cardMeta}>
                {doneCount}/{dayTasks.length}
              </Text>
            </View>

            {dayTasks.length === 0 ? <Text style={styles.empty}>На сегодня задач нет.</Text> : null}
            {dayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                goal={weekGoals.find((g) => g.id === task.goal_id) ?? null}
                onToggleDone={() => toggleTaskMutation.mutate({ id: task.id, done: !task.done })}
                onPress={() => openTask(task)}
              />
            ))}

            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="+ задача"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleAddTask}
              returnKeyType="done"
            />
          </View>

          {weekGoals.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Цели недели</Text>
              {weekGoals.map((goal) => (
                <View key={goal.id} style={styles.goalRow}>
                  <View style={[styles.goalDot, { backgroundColor: goalColor(goal.position) }]} />
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <TaskForm
        key={`task-${taskFormKey}`}
        visible={taskFormOpen}
        initial={editingTask}
        weekStart={weekStart}
        goals={weekGoals}
        defaultDate={dateKey}
        saving={saveTaskMutation.isPending || deleteTaskMutation.isPending}
        onClose={() => setTaskFormOpen(false)}
        onSave={(value) => saveTaskMutation.mutate(value)}
        onDelete={editingTask ? () => deleteTaskMutation.mutate(editingTask) : undefined}
      />

      <BlockForm
        key={`block-${blockFormKey}`}
        visible={blockFormOpen}
        initial={editingItem}
        defaultWeekday={weekday}
        defaultStartTime={formTimes?.start}
        defaultEndTime={formTimes?.end}
        weekStart={weekStart}
        saving={saveBlockMutation.isPending || deleteBlockMutation.isPending}
        onClose={() => setBlockFormOpen(false)}
        onSave={(value) => saveBlockMutation.mutate(value)}
        onDelete={editingItem ? () => deleteBlockMutation.mutate(editingItem) : undefined}
      />
    </View>
  );
}

/** Как и в неделе: окно предзаполняем целиком, но не длиннее часа. */
function slotDefaultTimes(slot: FreeSlot): { start: string; end: string } {
  const start = timeToMinutes(slot.start_time);
  const end = Math.min(timeToMinutes(slot.end_time), start + 60);
  return { start: slot.start_time, end: minutesToTime(end) };
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
  mainCard: {
    borderColor: colors.accent,
  },
  themeCard: {
    backgroundColor: colors.accentMuted,
    borderRadius: 12,
    padding: 14,
    gap: 2,
  },
  themeText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
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
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  itemRow: {
    flexDirection: "row",
    gap: 8,
  },
  itemBar: {
    width: 3,
    borderRadius: 2,
  },
  freeBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  itemTime: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  itemDetails: {
    fontSize: 12,
    color: colors.textMuted,
  },
  oneOffBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  freeTime: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  freeLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dashedButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  dashedButtonText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
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
    flexShrink: 1,
  },
});
