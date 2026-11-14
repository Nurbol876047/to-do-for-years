import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { almatyTimeOf, almatyTimestamp, formatDayLabel, weekDates, WEEKDAY_LABELS_SHORT } from "@/lib/date";
import { REMINDERS_SUPPORTED } from "@/lib/notifications";
import { goalColor, useColors, type Palette } from "@/lib/theme";
import type { Goal, Task, TaskFormValue } from "@/lib/types";

export type { TaskFormValue };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface Props {
  visible: boolean;
  /** Задача на редактирование; null — создаём новую. */
  initial?: Task | null;
  /** Понедельник недели, из дней которой выбирается дата. */
  weekStart: string;
  /** Цели этой недели — задача может быть привязана только к ним (ограничение БД). */
  goals: Goal[];
  defaultDate?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (value: TaskFormValue) => void;
  onDelete?: () => void;
}

// Как и BlockForm: родитель меняет `key`, состояние инициализируется один раз.
export function TaskForm({
  visible,
  initial,
  weekStart,
  goals,
  defaultDate = null,
  saving,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState<string | null>(initial ? initial.date : defaultDate);
  const [time, setTime] = useState(initial?.time ? initial.time.slice(0, 5) : "");
  const [goalId, setGoalId] = useState<string | null>(initial?.goal_id ?? null);
  const [isMain, setIsMain] = useState(initial?.is_main ?? false);
  const [remindAt, setRemindAt] = useState(initial?.remind_at ? almatyTimeOf(initial.remind_at) : "");
  const [error, setError] = useState<string | null>(null);

  const dates = weekDates(weekStart);

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Введите название");
      return;
    }
    if (time && !TIME_RE.test(time)) {
      setError("Время в формате ЧЧ:ММ");
      return;
    }
    if (remindAt && !TIME_RE.test(remindAt)) {
      setError("Время напоминания в формате ЧЧ:ММ");
      return;
    }
    if (remindAt && !date) {
      setError("Напоминание нужно привязать ко дню");
      return;
    }

    setError(null);
    onSave({
      title: trimmed,
      date,
      time: time ? `${time}:00` : null,
      goal_id: goalId,
      is_main: date ? isMain : false,
      remind_at: remindAt && date ? almatyTimestamp(date, remindAt) : null,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <Text style={styles.heading}>{initial ? "Задача" : "Новая задача"}</Text>

            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Дочитать главу"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>День</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, date === null && styles.chipActive]}
                onPress={() => setDate(null)}
              >
                <Text style={[styles.chipText, date === null && styles.chipTextActive]}>Входящие</Text>
              </Pressable>
              {dates.map((dateKey, i) => {
                const active = date === dateKey;
                return (
                  <Pressable
                    key={dateKey}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDate(dateKey)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {WEEKDAY_LABELS_SHORT[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{date ? formatDayLabel(date) : "Без даты — попадёт во «Входящие»"}</Text>

            <Text style={styles.label}>Время (необязательно)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="14:00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Напомнить в (необязательно)</Text>
            <TextInput
              style={styles.input}
              value={remindAt}
              onChangeText={setRemindAt}
              placeholder="09:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>
              {REMINDERS_SUPPORTED
                ? "В это время придёт уведомление. Пусто — не напоминать."
                : "В браузере напоминание только сохранится — уведомление придёт в приложении на телефоне."}
            </Text>

            <Text style={styles.label}>Цель недели</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, goalId === null && styles.chipActive]}
                onPress={() => setGoalId(null)}
              >
                <Text style={[styles.chipText, goalId === null && styles.chipTextActive]}>Без цели</Text>
              </Pressable>
              {goals.map((goal) => {
                const active = goalId === goal.id;
                return (
                  <Pressable
                    key={goal.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setGoalId(goal.id)}
                  >
                    <View style={[styles.goalDot, { backgroundColor: goalColor(goal.position) }]} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {goal.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {goals.length === 0 ? <Text style={styles.hint}>Цели недели пока не заданы.</Text> : null}

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Главная задача дня</Text>
                <Text style={styles.hint}>Одна на день — прежняя снимется.</Text>
              </View>
              <Switch value={isMain} onValueChange={setIsMain} disabled={!date} />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              {initial && onDelete ? (
                <Pressable style={styles.deleteButton} onPress={onDelete} disabled={saving}>
                  <Text style={styles.deleteButtonText}>Удалить</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.actionsRight}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Отмена</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveButtonText}>Сохранить</Text>
                </Pressable>
              </View>
            </View>
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
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxWidth: 480,
    maxHeight: "90%",
    width: "100%",
    alignSelf: "center",
  },
  sheetContent: {
    padding: 20,
    gap: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
    flexShrink: 1,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  switchLabel: {
    flexShrink: 1,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  actionsRight: {
    flexDirection: "row",
    gap: 10,
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
