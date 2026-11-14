// Заметка: текст и список, в котором она лежит. Отсюда же её переносят в архив.

import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { NOTE_LISTS } from "@/lib/noteLists";
import { BLOCK_COLORS, useColors, type Palette } from "@/lib/theme";
import type { Note, NoteList } from "@/lib/types";

interface Props {
  visible: boolean;
  initial: Note | null;
  defaultList: NoteList;
  saving?: boolean;
  onClose: () => void;
  onSave: (value: { body: string; list: NoteList; color: string }) => void;
  onDelete?: () => void;
}

// Как и остальные формы: родитель меняет `key`, состояние ставится один раз.
export function NoteForm({ visible, initial, defaultList, saving, onClose, onSave, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [body, setBody] = useState(initial?.body ?? "");
  const [list, setList] = useState<NoteList>(initial?.list ?? defaultList);
  const [color, setColor] = useState<string>(initial?.color ?? BLOCK_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Пустую заметку сохранять нечего");
      return;
    }
    setError(null);
    onSave({ body: trimmed, list, color });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
            <Text style={styles.heading}>{initial ? "Заметка" : "Новая заметка"}</Text>

            <TextInput
              style={styles.textarea}
              value={body}
              onChangeText={setBody}
              placeholder="Текст заметки"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Список</Text>
            <View style={styles.chipRow}>
              {NOTE_LISTS.map((info) => {
                const active = list === info.key;
                return (
                  <Pressable
                    key={info.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setList(info.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{info.label}</Text>
                  </Pressable>
                );
              })}
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
    maxHeight: "90%",
  },
  sheetContent: {
    padding: 20,
    gap: 10,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
  },
  colorRow: {
    flexDirection: "row",
    gap: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: {
    borderColor: colors.text,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  actionsRight: {
    flexDirection: "row",
    gap: 10,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  deleteButtonText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: "600",
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "600",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  saveButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
