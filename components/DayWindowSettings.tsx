// Границы дня и часы сна (user_settings): внутри окна «Неделя», «Сегодня» и
// «Обзор» считают свободное время, а сон «Обзор» показывает отдельной строкой
// бюджета. Живут на экране расписания — это тоже каркас дня.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { getUserSettings, saveUserSettings } from "@/lib/api";
import { DAY_WINDOW, DEFAULT_SLEEP_HOURS } from "@/lib/blocks";
import { formatTime } from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { useColors, type Palette } from "@/lib/theme";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SLEEP_RE = /^\d{1,2}([.,]\d)?$/;

export function DayWindowSettings() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: qk.settings, queryFn: getUserSettings });

  const savedStart = formatTime(settings?.day_start ?? DAY_WINDOW.start);
  const savedEnd = formatTime(settings?.day_end ?? DAY_WINDOW.end);
  const savedSleep = String(settings?.sleep_hours ?? DEFAULT_SLEEP_HOURS);

  const [start, setStart] = useState(savedStart);
  const [end, setEnd] = useState(savedEnd);
  const [sleep, setSleep] = useState(savedSleep);
  const [error, setError] = useState<string | null>(null);

  // Настройки приезжают после первого рендера (и меняются после сохранения) —
  // подставляем их в поля во время рендера, без эффекта.
  const [syncedTo, setSyncedTo] = useState({ start: savedStart, end: savedEnd, sleep: savedSleep });
  if (syncedTo.start !== savedStart || syncedTo.end !== savedEnd || syncedTo.sleep !== savedSleep) {
    setSyncedTo({ start: savedStart, end: savedEnd, sleep: savedSleep });
    setStart(savedStart);
    setEnd(savedEnd);
    setSleep(savedSleep);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      saveUserSettings({
        day_start: `${start}:00`,
        day_end: `${end}:00`,
        sleep_hours: Number(sleep.replace(",", ".")),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings }),
    onError: (e: Error) => setError(e.message),
  });

  const changed = start !== savedStart || end !== savedEnd || sleep !== savedSleep;

  function handleSave() {
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      setError("Время в формате ЧЧ:ММ");
      return;
    }
    if (end <= start) {
      setError("Конец дня должен быть позже начала");
      return;
    }
    if (!SLEEP_RE.test(sleep.trim()) || Number(sleep.replace(",", ".")) > 14) {
      setError("Сон — число часов, например 7.5");
      return;
    }
    setError(null);
    saveMutation.mutate();
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Границы дня</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>С</Text>
              <TextInput
                style={styles.input}
                value={start}
                onChangeText={setStart}
                placeholder="08:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>По</Text>
              <TextInput
                style={styles.input}
                value={end}
                onChangeText={setEnd}
                placeholder="22:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Сон, ч</Text>
              <TextInput
                style={styles.input}
                value={sleep}
                onChangeText={setSleep}
                placeholder="8"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Pressable
              style={[styles.saveButton, (!changed || saveMutation.isPending) && styles.saveButtonDisabled]}
              disabled={!changed || saveMutation.isPending}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>{saveMutation.isPending ? "Сохраняю…" : "Сохранить"}</Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={error ? styles.error : styles.hint}>
        {error ?? "Свободное время считается внутри границ, сон — в бюджете недели на «Обзоре»."}
      </Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  input: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
});
