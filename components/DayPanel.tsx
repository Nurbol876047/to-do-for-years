// День из календаря: что в нём важного, какие задачи и напоминания.

import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { almatyTimeOf, formatDateKey, formatDayLabel, formatTime } from "@/lib/date";
import { BLOCK_COLORS, useColors, type Palette } from "@/lib/theme";
import type { DayMark, Task } from "@/lib/types";

interface Props {
  visible: boolean;
  dateKey: string;
  marks: DayMark[];
  tasks: Task[];
  saving?: boolean;
  onClose: () => void;
  onAddMark: (title: string, color: string) => void;
  onDeleteMark: (id: string) => void;
  onToggleTask: (id: string, done: boolean) => void;
  onAddTask: (title: string) => void;
  onOpenTask: (task: Task) => void;
}

export function DayPanel({
  visible,
  dateKey,
  marks,
  tasks,
  saving,
  onClose,
  onAddMark,
  onDeleteMark,
  onToggleTask,
  onAddTask,
  onOpenTask,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [markDraft, setMarkDraft] = useState("");
  const [markColor, setMarkColor] = useState<string>(BLOCK_COLORS[1]);
  const [taskDraft, setTaskDraft] = useState("");

  function submitMark() {
    const title = markDraft.trim();
    if (!title) return;
    onAddMark(title, markColor);
    setMarkDraft("");
  }

  function submitTask() {
    const title = taskDraft.trim();
    if (!title) return;
    onAddTask(title);
    setTaskDraft("");
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.heading}>{formatDayLabel(dateKey)}</Text>
                <Text style={styles.subheading}>{formatDateKey(dateKey)}</Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={styles.close}>Закрыть</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Важное</Text>
            {marks.length === 0 ? (
              <Text style={styles.empty}>Ничего не отмечено.</Text>
            ) : (
              marks.map((mark) => (
                <View key={mark.id} style={styles.markRow}>
                  <View style={[styles.markDot, { backgroundColor: mark.color }]} />
                  <Text style={styles.markTitle}>{mark.title}</Text>
                  <Pressable onPress={() => onDeleteMark(mark.id)} disabled={saving}>
                    <Text style={styles.remove}>×</Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.colorRow}>
              {BLOCK_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, markColor === c && styles.colorDotActive]}
                  onPress={() => setMarkColor(c)}
                />
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={markDraft}
              onChangeText={setMarkDraft}
              placeholder="+ экзамен, дедлайн, поездка"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={submitMark}
              returnKeyType="done"
            />

            <Text style={styles.sectionTitle}>Задачи и напоминания</Text>
            {tasks.length === 0 ? (
              <Text style={styles.empty}>Задач на этот день нет.</Text>
            ) : (
              tasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <Pressable
                    style={[styles.checkbox, task.done && styles.checkboxDone]}
                    onPress={() => onToggleTask(task.id, !task.done)}
                  >
                    {task.done ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </Pressable>
                  <Pressable style={styles.taskBody} onPress={() => onOpenTask(task)}>
                    <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
                    <View style={styles.taskMeta}>
                      {task.time ? <Text style={styles.taskMetaText}>{formatTime(task.time)}</Text> : null}
                      {task.remind_at ? (
                        <Text style={styles.reminder}>напомнить в {almatyTimeOf(task.remind_at)}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))
            )}

            <TextInput
              style={styles.input}
              value={taskDraft}
              onChangeText={setTaskDraft}
              placeholder="+ задача на этот день"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={submitTask}
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              Нажмите на задачу, чтобы поставить время, напоминание или цель недели.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 19, 24, 0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
    maxHeight: "85%",
  },
  sheetContent: {
    padding: 20,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  subheading: {
    fontSize: 13,
    color: colors.textMuted,
  },
  close: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 10,
  },
  empty: {
    fontSize: 13,
    color: colors.textFaint,
  },
  markRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  markTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  remove: {
    fontSize: 18,
    color: colors.textFaint,
    paddingHorizontal: 6,
  },
  colorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: {
    borderColor: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    color: colors.text,
  },
  taskTitleDone: {
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  taskMeta: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  taskMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  reminder: {
    fontSize: 12,
    color: colors.accent,
  },
  hint: {
    fontSize: 12,
    color: colors.textFaint,
  },
});
