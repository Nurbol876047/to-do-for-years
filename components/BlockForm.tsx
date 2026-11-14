import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { joinBlockTitle, splitBlockTitle, type DayItem } from "@/lib/blocks";
import {
  addDaysToKey,
  formatDateKey,
  formatDayLabel,
  isoWeekday,
  parseDateInput,
  WEEKDAY_LABELS_SHORT,
} from "@/lib/date";
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { BLOCK_COLORS, useColors, type Palette } from "@/lib/theme";
import type { BlockCategory, BlockFormValue, Weekday } from "@/lib/types";

export type { BlockFormValue };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface Props {
  visible: boolean;
  /** Блок на редактирование; null — создаём новый. */
  initial?: DayItem | null;
  /** День недели для нового блока. */
  defaultWeekday: Weekday;
  /** Время нового блока, "HH:mm:ss" — например из свободного окна дня. */
  defaultStartTime?: string;
  defaultEndTime?: string;
  /**
   * Понедельник недели, из которой открыли форму. Задан — доступны разовые
   * (внеплановые) блоки: дата считается от выбранного дня недели.
   */
  weekStart?: string;
  /** Разовый или повторяющийся блок по умолчанию. */
  defaultRepeat?: "once" | "weekly";
  saving?: boolean;
  onClose: () => void;
  onSave: (value: BlockFormValue) => void;
  onDelete?: () => void;
}

// Родитель меняет `key` при каждом открытии формы (новый блок / другой блок
// на редактирование) — компонент перемонтируется, и useState ниже сразу
// инициализируется нужными значениями, без синхронизирующего useEffect.
export function BlockForm({
  visible,
  initial,
  defaultWeekday,
  defaultStartTime,
  defaultEndTime,
  weekStart,
  defaultRepeat = "once",
  saving,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const allowOnce = Boolean(weekStart);
  const initialTitle = initial ? splitBlockTitle(initial.title) : null;

  const [name, setName] = useState(initialTitle?.name ?? "");
  const [details, setDetails] = useState(initialTitle?.details ?? "");
  const [repeat, setRepeat] = useState<"once" | "weekly">(
    initial ? (initial.kind === "event" ? "once" : "weekly") : allowOnce ? defaultRepeat : "weekly"
  );
  const [weekday, setWeekday] = useState<Weekday>(
    initial ? (initial.kind === "event" ? isoWeekday(initial.date) : initial.weekday) : defaultWeekday
  );
  const [startTime, setStartTime] = useState((initial?.start_time ?? defaultStartTime ?? "09:00").slice(0, 5));
  const [endTime, setEndTime] = useState((initial?.end_time ?? defaultEndTime ?? "10:00").slice(0, 5));
  const [color, setColor] = useState<string>(initial?.color ?? BLOCK_COLORS[0]);
  const [category, setCategory] = useState<BlockCategory>(initial?.category ?? "other");
  const [active, setActive] = useState(initial?.kind === "block" ? initial.active : true);
  // Срок действия пары: пустая строка = без ограничения.
  const [startsOn, setStartsOn] = useState(
    initial?.kind === "block" && initial.starts_on ? formatDateKey(initial.starts_on) : ""
  );
  const [endsOn, setEndsOn] = useState(
    initial?.kind === "block" && initial.ends_on ? formatDateKey(initial.ends_on) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const dateKey = weekStart ? addDaysToKey(weekStart, weekday - 1) : null;

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Введите название");
      return;
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      setError("Время в формате ЧЧ:ММ");
      return;
    }
    if (endTime <= startTime) {
      setError("Время «по» должно быть позже «с»");
      return;
    }

    const periodStart = startsOn.trim() ? parseDateInput(startsOn) : null;
    const periodEnd = endsOn.trim() ? parseDateInput(endsOn) : null;
    if ((startsOn.trim() && !periodStart) || (endsOn.trim() && !periodEnd)) {
      setError("Дата в формате ДД.ММ.ГГГГ");
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setError("Дата «по» должна быть не раньше «с»");
      return;
    }

    setError(null);
    const common = {
      title: joinBlockTitle(trimmedName, details.trim()),
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      color,
      category,
    };

    if (repeat === "once" && dateKey) {
      onSave({ repeat: "once", date: dateKey, ...common });
    } else {
      onSave({ repeat: "weekly", weekday, active, starts_on: periodStart, ends_on: periodEnd, ...common });
    }
  }

  const heading = initial ? "Блок" : repeat === "once" ? "Внеплановый блок" : "Блок расписания";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <Text style={styles.heading}>{heading}</Text>

            {allowOnce ? (
              <>
                <Text style={styles.label}>Повтор</Text>
                <View style={styles.repeatRow}>
                  <RepeatChip
                    label={dateKey ? `Только ${formatDayLabel(dateKey).split(", ")[1]}` : "Только в этот день"}
                    active={repeat === "once"}
                    onPress={() => setRepeat("once")}
                  />
                  <RepeatChip
                    label="Каждую неделю"
                    active={repeat === "weekly"}
                    onPress={() => setRepeat("weekly")}
                  />
                </View>
                {repeat === "weekly" ? (
                  <Text style={styles.hint}>Попадёт в расписание и будет повторяться каждую неделю.</Text>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Философия"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Преподаватель, аудитория</Text>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder="Иманмолдаева Б.З., ауд. 301"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Куда уходит время</Text>
            <View style={styles.categoryRow}>
              {CATEGORY_ORDER.map((value) => {
                const isActive = category === value;
                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.categoryChip,
                      isActive && { backgroundColor: CATEGORY_COLORS[value], borderColor: CATEGORY_COLORS[value] },
                    ]}
                    onPress={() => setCategory(value)}
                  >
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {CATEGORY_LABELS[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>Из этого «Обзор» собирает бюджет недели.</Text>

            <Text style={styles.label}>День</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS_SHORT.map((label, i) => {
                const value = (i + 1) as Weekday;
                const isActive = weekday === value;
                return (
                  <Pressable
                    key={label}
                    style={[styles.weekdayChip, isActive && styles.weekdayChipActive]}
                    onPress={() => setWeekday(value)}
                  >
                    <Text style={[styles.weekdayChipText, isActive && styles.weekdayChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {repeat === "once" && dateKey ? <Text style={styles.hint}>{formatDayLabel(dateKey)}</Text> : null}

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.label}>С</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.label}>По</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="10:00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={styles.label}>Цвет</Text>
            <View style={styles.colorRow}>
              {BLOCK_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            {repeat === "weekly" ? (
              <>
                <Text style={styles.label}>Пара идёт</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.subLabel}>с</Text>
                    <TextInput
                      style={styles.input}
                      value={startsOn}
                      onChangeText={setStartsOn}
                      placeholder="без ограничения"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.subLabel}>по</Text>
                    <TextInput
                      style={styles.input}
                      value={endsOn}
                      onChangeText={setEndsOn}
                      placeholder="15.11.2026"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <Text style={styles.hint}>
                  Курс закончился — впишите последнюю дату в «по», и пара сама исчезнет из расписания со
                  следующей недели. Пустые поля — пара идёт всегда.
                </Text>

                <View style={styles.activeRow}>
                  <Text style={styles.label}>Активен</Text>
                  <Switch value={active} onValueChange={setActive} />
                </View>
              </>
            ) : null}

            {initial?.kind === "block" ? (
              <Text style={styles.hint}>Это блок расписания — изменения применятся ко всем неделям.</Text>
            ) : null}

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

function RepeatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={[styles.repeatChip, active && styles.repeatChipActive]} onPress={onPress}>
      <Text style={[styles.repeatChipText, active && styles.repeatChipTextActive]}>{label}</Text>
    </Pressable>
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
  repeatRow: {
    flexDirection: "row",
    gap: 8,
  },
  repeatChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  repeatChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  repeatChipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  repeatChipTextActive: {
    color: colors.accent,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 6,
  },
  weekdayChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekdayChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  weekdayChipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  weekdayChipTextActive: {
    color: "#FFFFFF",
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  subLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  timeField: {
    flex: 1,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: colors.text,
  },
  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
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
