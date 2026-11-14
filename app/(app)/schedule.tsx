import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import {
  createScheduleBlock,
  deleteScheduleBlock,
  listScheduleBlocks,
  updateScheduleBlock,
  type CreateScheduleBlockInput,
} from "@/lib/api";
import { BlockForm, type BlockFormValue } from "@/components/BlockForm";
import { DayWindowSettings } from "@/components/DayWindowSettings";
import { formatDateKey, formatTime, todayInAlmaty, WEEKDAY_LABELS_SHORT } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";
import type { ScheduleBlock, Weekday } from "@/lib/types";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Подпись срока действия пары; null — срок не задан. */
function periodLabel(block: ScheduleBlock): string | null {
  if (block.starts_on && block.ends_on) return `${formatDateKey(block.starts_on)} – ${formatDateKey(block.ends_on)}`;
  if (block.ends_on) return `по ${formatDateKey(block.ends_on)}`;
  if (block.starts_on) return `с ${formatDateKey(block.starts_on)}`;
  return null;
}

export default function ScheduleScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();
  const { data: blocks, isLoading } = useQuery({
    queryKey: ["scheduleBlocks"],
    queryFn: listScheduleBlocks,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [formWeekday, setFormWeekday] = useState<Weekday>(1);
  const [formKey, setFormKey] = useState(0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["scheduleBlocks"] });

  const createMutation = useMutation({
    mutationFn: createScheduleBlock,
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateScheduleBlockInput> }) =>
      updateScheduleBlock(id, patch),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduleBlock,
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateScheduleBlock(id, { active }),
    onSuccess: invalidate,
  });

  function openCreate(weekday: Weekday) {
    setEditingBlock(null);
    setFormWeekday(weekday);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(block: ScheduleBlock) {
    setEditingBlock(block);
    setFormWeekday(block.weekday);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function handleSave(value: BlockFormValue) {
    // Экран расписания открывает форму без weekStart — разовых блоков здесь нет.
    if (value.repeat !== "weekly") return;
    const patch: CreateScheduleBlockInput = {
      title: value.title,
      weekday: value.weekday,
      start_time: value.start_time,
      end_time: value.end_time,
      color: value.color,
      active: value.active,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
    };
    if (editingBlock) {
      updateMutation.mutate({ id: editingBlock.id, patch });
    } else {
      createMutation.mutate(patch);
    }
  }

  function handleDelete() {
    if (editingBlock) deleteMutation.mutate(editingBlock.id);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const todayKey = todayInAlmaty();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Расписание</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <DayWindowSettings />

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {WEEKDAYS.map((weekday) => {
            const dayBlocks = (blocks ?? [])
              .filter((b) => b.weekday === weekday)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <View key={weekday} style={styles.column}>
                <Text style={styles.columnTitle}>{WEEKDAY_LABELS_SHORT[weekday - 1]}</Text>

                {dayBlocks.map((block) => {
                  const period = periodLabel(block);
                  // Срок вышел — в «Неделе» и «Сегодня» пары уже нет, здесь показываем блёкло.
                  const expired = Boolean(block.ends_on && block.ends_on < todayKey);

                  return (
                  <Pressable
                    key={block.id}
                    style={[
                      styles.block,
                      { borderLeftColor: block.color },
                      (!block.active || expired) && styles.blockInactive,
                    ]}
                    onPress={() => openEdit(block)}
                  >
                    <Text style={styles.blockTime}>
                      {formatTime(block.start_time)}–{formatTime(block.end_time)}
                    </Text>
                    <Text style={styles.blockTitle} numberOfLines={2}>
                      {block.title}
                    </Text>
                    {period ? (
                      <Text style={styles.blockPeriod}>{expired ? `завершена · ${period}` : period}</Text>
                    ) : null}
                    <View style={styles.blockFooter}>
                      <Text style={styles.blockFooterLabel}>активен</Text>
                      <Switch
                        value={block.active}
                        onValueChange={(value) => toggleActiveMutation.mutate({ id: block.id, active: value })}
                      />
                    </View>
                  </Pressable>
                  );
                })}

                <Pressable style={styles.addButton} onPress={() => openCreate(weekday)}>
                  <Text style={styles.addButtonText}>+ блок</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      <BlockForm
        key={formKey}
        visible={formOpen}
        initial={editingBlock ? { kind: "block", ...editingBlock } : null}
        defaultWeekday={formWeekday}
        saving={isSaving}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        onDelete={editingBlock ? handleDelete : undefined}
      />
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
    marginBottom: 16,
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
  grid: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 20,
  },
  column: {
    width: 160,
    gap: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 10,
    gap: 4,
  },
  blockInactive: {
    opacity: 0.45,
  },
  blockTime: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  blockTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },
  blockPeriod: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  blockFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  blockFooterLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
});
