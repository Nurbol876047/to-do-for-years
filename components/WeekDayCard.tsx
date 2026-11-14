import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  busyMinutes,
  DAY_WINDOW,
  dayRows,
  splitBlockTitle,
  type DayItem,
  type DayWindow,
  type FreeSlot,
} from "@/lib/blocks";
import { formatDayLabel, formatDuration, formatTime } from "@/lib/date";
import { TaskRow } from "@/components/TaskRow";
import { useColors, type Palette } from "@/lib/theme";
import type { Goal, Task } from "@/lib/types";

const OVERLOAD_MINUTES = 8 * 60;

interface Props {
  dateKey: string;
  isToday: boolean;
  /** Узкая колонка: все 7 дней на одном экране. */
  compact?: boolean;
  /** Блоки расписания и внеплановые блоки дня, уже отсортированные по времени. */
  items: DayItem[];
  tasks: Task[];
  /** Цели недели — цветные метки задач. */
  goals: Goal[];
  /** Границы дня из настроек — внутри них считается свободное время. */
  dayWindow?: DayWindow;
  onToggleTask: (id: string, done: boolean) => void;
  onAddTask: (title: string) => void;
  onEditTask: (task: Task) => void;
  onEditItem: (item: DayItem) => void;
  /** Со слотом — создание блока в готовом свободном окне. */
  onAddBlock: (slot?: FreeSlot) => void;
}

export function WeekDayCard({
  dateKey,
  isToday,
  compact = false,
  items,
  tasks,
  goals,
  dayWindow = DAY_WINDOW,
  onToggleTask,
  onAddTask,
  onEditTask,
  onEditItem,
  onAddBlock,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState("");

  const isOverloaded = busyMinutes(items) > OVERLOAD_MINUTES;
  const doneCount = tasks.filter((t) => t.done).length;
  const rows = dayRows(items, dayWindow);

  function handleSubmit() {
    const title = draft.trim();
    if (!title) return;
    onAddTask(title);
    setDraft("");
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact, isToday && styles.cardToday]}>
      <View style={styles.header}>
        <Text style={[styles.dateLabel, compact && styles.dateLabelCompact]}>{formatDayLabel(dateKey)}</Text>
        <View style={styles.badges}>
          {isToday ? <Text style={styles.todayBadge}>сегодня</Text> : null}
          {isOverloaded ? <Text style={styles.overloadBadge}>перегружен</Text> : null}
          {tasks.length > 0 ? (
            <Text style={styles.counter}>
              {doneCount}/{tasks.length}
            </Text>
          ) : null}
        </View>
      </View>

      {rows.map((row) => {
        if (row.type === "free") {
          const { slot } = row;
          return (
            <Pressable key={`free-${slot.start_time}`} style={styles.blockRow} onPress={() => onAddBlock(slot)}>
              <View style={styles.freeBar} />
              <Text style={styles.freeText}>
                {formatTime(slot.start_time)}–{formatTime(slot.end_time)} · свободно {formatDuration(slot.minutes)}
              </Text>
            </Pressable>
          );
        }

        const { item } = row;
        const { name, details } = splitBlockTitle(item.title);
        return (
          <Pressable key={`${item.kind}-${item.id}`} style={styles.blockRow} onPress={() => onEditItem(item)}>
            <View style={[styles.blockBar, { backgroundColor: item.color }]} />
            <View style={styles.blockBody}>
              <View style={styles.blockTimeRow}>
                <Text style={styles.blockTime}>
                  {formatTime(item.start_time)}–{formatTime(item.end_time)}
                </Text>
                {item.kind === "event" ? <Text style={styles.oneOffBadge}>вне плана</Text> : null}
              </View>
              <Text style={[styles.blockName, compact && styles.blockNameCompact]}>{name}</Text>
              {details ? <Text style={styles.blockDetails}>{details}</Text> : null}
            </View>
          </Pressable>
        );
      })}

      <Pressable style={styles.addBlockButton} onPress={() => onAddBlock()}>
        <Text style={styles.addBlockButtonText}>+ блок</Text>
      </Pressable>

      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          goal={goals.find((g) => g.id === task.goal_id) ?? null}
          compact={compact}
          onToggleDone={() => onToggleTask(task.id, !task.done)}
          onPress={() => onEditTask(task)}
        />
      ))}

      <TextInput
        style={[styles.input, compact && styles.inputCompact]}
        value={draft}
        onChangeText={setDraft}
        placeholder="+ задача"
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />
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
    marginBottom: 10,
    gap: 12,
  },
  cardCompact: {
    padding: 10,
  },
  cardToday: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  dateLabelCompact: {
    fontSize: 15,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  todayBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overloadBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    backgroundColor: colors.overloaded,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  counter: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  blockRow: {
    flexDirection: "row",
    gap: 8,
  },
  blockBar: {
    width: 3,
    borderRadius: 2,
  },
  freeBar: {
    width: 3,
    borderRadius: 2,
  },
  freeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textFaint,
    fontVariant: ["tabular-nums"],
  },
  blockBody: {
    flex: 1,
    gap: 2,
  },
  blockTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
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
  addBlockButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  addBlockButtonText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  blockTime: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  blockName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.text,
  },
  blockNameCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  blockDetails: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
  },
  inputCompact: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
});
