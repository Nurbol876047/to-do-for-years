// Колонка доски «Входящих». Одна и та же для задач и для списков заметок —
// поэтому они и выглядят одинаково: кружок, текст, свёрнутый блок выполненных.

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useColors, type Palette } from "@/lib/theme";

export interface BoardItem {
  id: string;
  text: string;
  done: boolean;
  /** Цветная метка слева; у задач её нет. */
  color?: string | null;
}

interface Props {
  title: string;
  /** Что писать, когда в колонке совсем пусто. */
  hint: string;
  items: BoardItem[];
  addPlaceholder: string;
  onAdd: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BoardColumn({ title, hint, items, addPlaceholder, onAdd, onToggle, onOpen, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);

  const active = items.filter((i) => !i.done);
  const completed = items.filter((i) => i.done);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <View style={styles.column}>
      <Text style={styles.title}>{title}</Text>

      <TextInput
        style={styles.add}
        value={draft}
        onChangeText={setDraft}
        placeholder={addPlaceholder}
        placeholderTextColor={colors.accent}
        onSubmitEditing={submit}
        returnKeyType="done"
      />

      {active.map((item) => (
        <View key={item.id} style={styles.row}>
          <Pressable style={styles.circle} onPress={() => onToggle(item.id, true)} />
          {item.color ? <View style={[styles.mark, { backgroundColor: item.color }]} /> : null}
          <Pressable style={styles.textWrap} onPress={() => onOpen(item.id)}>
            <Text style={styles.text} numberOfLines={3}>
              {item.text}
            </Text>
          </Pressable>
          <Pressable style={styles.remove} onPress={() => onDelete(item.id)}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ))}

      {items.length === 0 ? <Text style={styles.hint}>{hint}</Text> : null}

      {items.length > 0 && active.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Всё закрыто</Text>
          <Text style={styles.emptyHint}>Ура!</Text>
        </View>
      ) : null}

      {completed.length > 0 ? (
        <>
          <Pressable style={styles.doneHeader} onPress={() => setDoneOpen((v) => !v)}>
            <Text style={styles.doneChevron}>{doneOpen ? "⌄" : "›"}</Text>
            <Text style={styles.doneHeaderText}>{completed.length} выполнено</Text>
          </Pressable>

          {doneOpen
            ? completed.map((item) => (
                <View key={item.id} style={styles.row}>
                  <Pressable style={[styles.circle, styles.circleDone]} onPress={() => onToggle(item.id, false)}>
                    <Text style={styles.circleMark}>✓</Text>
                  </Pressable>
                  <Pressable style={styles.textWrap} onPress={() => onOpen(item.id)}>
                    <Text style={[styles.text, styles.textDone]} numberOfLines={2}>
                      {item.text}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.remove} onPress={() => onDelete(item.id)}>
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  column: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  add: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  circleDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  circleMark: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  mark: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  textWrap: {
    flex: 1,
  },
  remove: {
    paddingHorizontal: 4,
  },
  removeText: {
    fontSize: 16,
    lineHeight: 18,
    color: colors.textFaint,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  textDone: {
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textFaint,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 14,
    gap: 2,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.textFaint,
  },
  doneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 2,
    paddingTop: 8,
  },
  doneChevron: {
    fontSize: 13,
    color: colors.textMuted,
    width: 12,
  },
  doneHeaderText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
