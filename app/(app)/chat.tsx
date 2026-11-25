import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  type TextInputKeyPressEvent,
  View,
} from "react-native";

import {
  getWeekByStart,
  listBoardNotes,
  listDayMarksForRange,
  listEventsForRange,
  listGoalsForWeek,
  listInboxTasks,
  listScheduleBlocks,
  listTasksForRange,
  listTransactionsForRange,
} from "@/lib/api";
import { askAssistant, type ChatMessage } from "@/lib/ai/chat";
import { buildSnapshot } from "@/lib/ai/snapshot";
import {
  addDaysToKey,
  currentWeekStart,
  daysInMonth,
  MONTH_LABELS,
  todayInAlmaty,
} from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";

/** С чего начать, когда экран пустой. */
const STARTERS = [
  "Много ли у меня свободного времени на этой неделе?",
  "Помоги спланировать сегодняшний день.",
  "Куда у меня уходит больше всего денег?",
];

/** Насколько вперёд смотрим на отметки в календаре. */
const MARKS_AHEAD_DAYS = 60;

export default function ChatScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const todayKey = todayInAlmaty();
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7));
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const weekStart = currentWeekStart();
  const weekEnd = addDaysToKey(weekStart, 6);
  const marksTo = addDaysToKey(todayKey, MARKS_AHEAD_DAYS);

  // Контекст разговора — весь планировщик, а не только деньги: неделя и цели,
  // задачи, расписание, отметки в календаре, заметки и траты за месяц.
  const { data: week } = useQuery({
    queryKey: qk.week(weekStart),
    queryFn: () => getWeekByStart(weekStart),
  });
  const { data: goals } = useQuery({
    queryKey: qk.goals(week?.id ?? "none"),
    queryFn: () => listGoalsForWeek(week!.id),
    enabled: Boolean(week?.id),
  });
  const { data: weekTasks } = useQuery({
    queryKey: qk.tasksRange(weekStart),
    queryFn: () => listTasksForRange(weekStart, weekEnd),
  });
  const { data: inboxTasks } = useQuery({
    queryKey: qk.tasksInbox,
    queryFn: listInboxTasks,
  });
  const { data: blocks } = useQuery({
    queryKey: qk.scheduleBlocks,
    queryFn: listScheduleBlocks,
  });
  const { data: events } = useQuery({
    queryKey: qk.eventsRange(weekStart),
    queryFn: () => listEventsForRange(weekStart, weekEnd),
  });
  const { data: marks } = useQuery({
    queryKey: qk.dayMarksRange(todayKey),
    queryFn: () => listDayMarksForRange(todayKey, marksTo),
  });
  const { data: notes } = useQuery({
    queryKey: qk.notesBoard,
    queryFn: listBoardNotes,
  });
  const { data } = useQuery({
    queryKey: qk.transactionsRange(from),
    queryFn: () => listTransactionsForRange(from, to),
  });

  const rows = data ?? [];
  const income = rows.filter((r) => r.direction === "income").reduce((sum, r) => sum + Number(r.amount), 0);
  const expense = rows.filter((r) => r.direction === "expense").reduce((sum, r) => sum + Number(r.amount), 0);

  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<ScrollViewInstance>(null);

  const askMutation = useMutation({
    mutationFn: (history: ChatMessage[]) =>
      askAssistant(
        history,
        buildSnapshot({
          todayKey,
          weekStart,
          week: week ?? null,
          goals: goals ?? [],
          weekTasks: weekTasks ?? [],
          inboxTasks: inboxTasks ?? [],
          blocks: blocks ?? [],
          events: events ?? [],
          notes: notes ?? [],
          marks: marks ?? [],
          transactions: rows,
          monthLabel,
        })
      ),
    onSuccess: (answer) => {
      setChat((prev) => [...prev, { role: "assistant", text: answer }]);
      setError(null);
      // Ответ мог прийти через инструменты, которые поменяли задачи, —
      // перечитываем их везде, где они показаны (неделя, сегодня, входящие).
      queryClient.invalidateQueries({ queryKey: qk.tasks });
    },
    onError: (e: Error) => setError(e.message),
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || askMutation.isPending) return;
    const history: ChatMessage[] = [...chat, { role: "user", text: trimmed }];
    setChat(history);
    setQuestion("");
    askMutation.mutate(history);
    // Свежие сообщения внизу — прокручиваем к ним.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  /**
   * Поле многострочное, поэтому Enter по умолчанию делает перенос строки.
   * В чате ждут обратного: Enter отправляет, перенос — через Shift+Enter.
   */
  function handleKeyPress(event: TextInputKeyPressEvent) {
    const native = event.nativeEvent as { key: string; shiftKey?: boolean };
    if (native.key !== "Enter" || native.shiftKey) return;
    // На вебе иначе в поле останется пустая строка.
    (event as unknown as { preventDefault?: () => void }).preventDefault?.();
    send(question);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Чат</Text>
          <Text style={styles.subtitle}>
            Помощник по планировщику: видит неделю, задачи, расписание, заметки и деньги за{" "}
            {MONTH_LABELS[month - 1].toLowerCase()} (пришло {Math.round(income).toLocaleString("ru-RU")} ₸, ушло{" "}
            {Math.round(expense).toLocaleString("ru-RU")} ₸).
          </Text>
        </View>
        <View style={styles.headerActions}>
          {chat.length > 0 ? (
            <Pressable onPress={() => setChat([])}>
              <Text style={styles.clear}>Очистить</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>Выйти</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView ref={listRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {chat.length === 0 ? (
          <View style={styles.starters}>
            <Text style={styles.startersTitle}>С чего начать</Text>
            {STARTERS.map((text) => (
              <Pressable key={text} style={styles.starter} onPress={() => send(text)}>
                <Text style={styles.starterText}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {chat.map((message, i) => (
          <View
            key={i}
            style={[styles.bubble, message.role === "user" ? styles.bubbleUser : styles.bubbleAnswer]}
          >
            <Text style={styles.bubbleText}>{message.text}</Text>
          </View>
        ))}

        {askMutation.isPending ? <Text style={styles.pending}>Думаю…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Спросите про неделю, задачи или деньги"
          placeholderTextColor={colors.textMuted}
          onKeyPress={handleKeyPress}
          onSubmitEditing={() => send(question)}
          returnKeyType="send"
          multiline
          submitBehavior="submit"
        />
        <Pressable
          style={[styles.sendButton, askMutation.isPending && styles.sendButtonOff]}
          disabled={askMutation.isPending}
          onPress={() => send(question)}
        >
          <Text style={styles.sendButtonText}>Отправить</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Enter отправляет, Shift+Enter переносит строку. Ответы — общие соображения, а не индивидуальная
        инвестиционная рекомендация. Переписка не сохраняется.
      </Text>
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
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    headerText: {
      flex: 1,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    clear: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "600",
    },
    signOut: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: "600",
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: 10,
      paddingBottom: 12,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    starters: {
      gap: 8,
    },
    startersTitle: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textFaint,
    },
    starter: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    starterText: {
      fontSize: 13,
      color: colors.text,
    },
    bubble: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: "88%",
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: colors.accentMuted,
    },
    bubbleAnswer: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    pending: {
      fontSize: 13,
      color: colors.textFaint,
    },
    error: {
      fontSize: 13,
      color: colors.danger,
    },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    sendButton: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    sendButtonOff: {
      opacity: 0.5,
    },
    sendButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    disclaimer: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textFaint,
      marginTop: 8,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
  });
