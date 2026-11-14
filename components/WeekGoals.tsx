import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { goalColor, useColors, type Palette } from "@/lib/theme";
import type { Goal } from "@/lib/types";

const POSITIONS = [1, 2, 3] as const;

interface Props {
  theme: string | null;
  goals: Goal[];
  onSaveTheme: (theme: string) => void;
  /** Пустая строка — цель снимается. */
  onSaveGoal: (position: 1 | 2 | 3, title: string) => void;
}

export function WeekGoals({ theme, goals, onSaveTheme, onSaveGoal }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.themeBlock}>
        <Text style={styles.label}>Тема недели</Text>
        <InlineField
          key={`theme-${theme ?? ""}`}
          value={theme ?? ""}
          placeholder="Одна формулировка на неделю"
          textStyle={styles.themeInput}
          onCommit={onSaveTheme}
        />
      </View>

      <View style={styles.goalsRow}>
        {POSITIONS.map((position) => {
          const goal = goals.find((g) => g.position === position) ?? null;
          return (
            <View key={position} style={styles.goalSlot}>
              <View style={[styles.goalDot, { backgroundColor: goalColor(position) }, !goal && styles.goalDotEmpty]} />
              <InlineField
                key={`goal-${position}-${goal?.title ?? ""}`}
                value={goal?.title ?? ""}
                placeholder={`Цель ${position}`}
                textStyle={styles.goalInput}
                onCommit={(title) => onSaveGoal(position, title)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Поле правится по месту и сохраняется при потере фокуса или по Enter.
 * Родитель меняет `key` при изменении значения на сервере — компонент
 * перемонтируется уже без фокуса, поэтому синхронизация не нужна.
 */
function InlineField({
  value,
  placeholder,
  textStyle,
  onCommit,
}: {
  value: string;
  placeholder: string;
  textStyle: object;
  onCommit: (value: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [draft, setDraft] = useState(value);

  function commit() {
    const next = draft.trim();
    if (next !== value) onCommit(next);
  }

  return (
    <TextInput
      style={[styles.input, textStyle]}
      value={draft}
      onChangeText={setDraft}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
    />
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
    marginBottom: 12,
    gap: 10,
  },
  themeBlock: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: colors.background,
  },
  themeInput: {
    fontSize: 16,
    fontWeight: "600",
  },
  goalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  goalSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexGrow: 1,
    flexBasis: 220,
  },
  goalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalDotEmpty: {
    opacity: 0.3,
  },
  goalInput: {
    flex: 1,
    fontSize: 14,
  },
});
