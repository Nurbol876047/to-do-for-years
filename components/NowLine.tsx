import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatMinutes } from "@/lib/date";
import { useColors, type Palette } from "@/lib/theme";

interface Props {
  /** Минуты от начала суток в Алматы. */
  minutes: number;
  /** Узкая колонка недели: подпись мельче. */
  compact?: boolean;
}

/**
 * Черта «сейчас» между строками дня — её видно, когда текущая минута попала
 * в промежуток между блоками (перемена, время до начала или после конца дня).
 * Если минута внутри блока, отметку несёт сам блок.
 */
export function NowLine({ minutes, compact = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row} pointerEvents="none">
      <Text style={[styles.time, compact && styles.timeCompact]}>{formatMinutes(minutes)}</Text>
      <View style={styles.dot} />
      <View style={styles.line} />
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginVertical: 2,
    },
    time: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      color: colors.danger,
      fontVariant: ["tabular-nums"],
    },
    timeCompact: {
      fontSize: 11,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    line: {
      flex: 1,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.danger,
    },
  });
