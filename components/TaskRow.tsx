import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatTime } from "@/lib/date";
import { goalColor, useColors, type Palette } from "@/lib/theme";
import type { Goal, Task } from "@/lib/types";

interface Props {
  task: Task;
  /** Цель задачи — цветная метка слева от текста. */
  goal?: Goal | null;
  /** Узкая колонка недели. */
  compact?: boolean;
  onToggleDone: () => void;
  /** Нажатие на текст — редактирование. Без него строка только отмечается. */
  onPress?: () => void;
}

export function TaskRow({ task, goal, compact = false, onToggleDone, onPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.checkbox, task.done && styles.checkboxDone]}
        onPress={onToggleDone}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
      >
        {task.done ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>

      <Pressable style={styles.body} onPress={onPress} disabled={!onPress}>
        {task.is_main ? <Text style={styles.mainStar}>★</Text> : null}
        {goal ? <View style={[styles.goalDot, { backgroundColor: goalColor(goal.position) }]} /> : null}
        {task.time ? <Text style={styles.time}>{formatTime(task.time)}</Text> : null}
        <Text style={[styles.title, compact && styles.titleCompact, task.done && styles.titleDone]}>{task.title}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mainStar: {
    fontSize: 13,
    color: colors.overloaded,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  time: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  title: {
    fontSize: 15,
    color: colors.text,
    flexShrink: 1,
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
});
