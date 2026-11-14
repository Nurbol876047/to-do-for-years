// Переключатель темы одной кнопкой: видно текущую тему, нажатие даёт следующую.
// Три отдельные кнопки в узком меню переносились на две строки и терялись внизу.

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { THEME_OPTIONS, useColors, useThemeStore, type Palette, type ThemeMode } from "@/lib/theme";

const ICONS: Record<ThemeMode, string> = {
  light: "☀",
  dark: "☾",
  warm: "✦",
};

export function ThemeSwitch() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const index = THEME_OPTIONS.findIndex((o) => o.mode === mode);
  const current = THEME_OPTIONS[index === -1 ? 0 : index];
  const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length];

  return (
    <Pressable style={styles.button} onPress={() => setMode(next.mode)}>
      <Text style={styles.icon}>{ICONS[current.mode]}</Text>
      <Text style={styles.label}>{current.label}</Text>
      <View style={styles.dots}>
        {THEME_OPTIONS.map((option) => (
          <View key={option.mode} style={[styles.dot, option.mode === mode && styles.dotActive]} />
        ))}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    icon: {
      fontSize: 14,
      lineHeight: 18,
      color: colors.accent,
    },
    label: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    dots: {
      flexDirection: "row",
      gap: 3,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.accent,
    },
  });
