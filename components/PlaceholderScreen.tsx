import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";

export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
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
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  signOut: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  note: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
