import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { createTransactions, deleteTransaction, listTransactionsForRange } from "@/lib/api";
import { analyseStatement, type StatementAnalysis } from "@/lib/ai/statement";
import { pickPdf } from "@/lib/ai/pickPdf";
import { daysInMonth, formatDateKey, MONTH_LABELS, todayInAlmaty } from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import { BLOCK_COLORS, useColors, type Palette } from "@/lib/theme";
import type { Transaction, TransactionDirection } from "@/lib/types";

/** Деньги показываем без копеек — так столбец читается быстрее. */
function money(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₸`;
}

export default function FinanceScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();
  const todayKey = todayInAlmaty();

  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(todayKey.slice(5, 7)));

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const { data, isLoading } = useQuery({
    queryKey: qk.transactionsRange(from),
    queryFn: () => listTransactionsForRange(from, to),
  });

  const rows = data ?? [];
  const income = rows.filter((r) => r.direction === "income").reduce((sum, r) => sum + Number(r.amount), 0);
  const expense = rows.filter((r) => r.direction === "expense").reduce((sum, r) => sum + Number(r.amount), 0);

  // Траты по категориям, самые крупные сверху.
  const byCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.direction !== "expense") continue;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + Number(row.amount));
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.transactions });

  const addMutation = useMutation({
    mutationFn: createTransactions,
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({ mutationFn: deleteTransaction, onSuccess: invalidate });

  // --- ручной ввод ---
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<TransactionDirection>("expense");
  const [category, setCategory] = useState("Прочее");
  const [formError, setFormError] = useState<string | null>(null);

  function addManual() {
    const value = Number(amount.replace(",", ".").replace(/\s/g, ""));
    if (!title.trim()) {
      setFormError("Введите название");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Сумма должна быть числом больше нуля");
      return;
    }
    setFormError(null);
    addMutation.mutate([
      { date: todayKey, title: title.trim(), amount: value, direction, category: category.trim() || "Прочее" },
    ]);
    setTitle("");
    setAmount("");
  }

  // --- разбор выписки ---
  const [analysis, setAnalysis] = useState<StatementAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const analyseMutation = useMutation({
    mutationFn: async () => {
      const file = await pickPdf();
      if (!file) return null;
      return analyseStatement(file.name, file.base64);
    },
    onSuccess: (result) => {
      if (result) {
        setAnalysis(result);
        setAiError(null);
      }
    },
    onError: (error: Error) => {
      setAnalysis(null);
      setAiError(error.message);
    },
  });

  const saveParsedMutation = useMutation({
    mutationFn: (parsed: StatementAnalysis) =>
      createTransactions(parsed.transactions.map((t) => ({ ...t, source: "import" as const }))),
    onSuccess: () => {
      invalidate();
      setAnalysis(null);
    },
  });

  function shiftMonth(step: -1 | 1) {
    const next = month + step;
    if (next < 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else if (next > 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth(next);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Финансы</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      <View style={styles.monthNav}>
        <Pressable style={styles.navButton} onPress={() => shiftMonth(-1)}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTH_LABELS[month - 1]} {year}
        </Text>
        <Pressable style={styles.navButton} onPress={() => shiftMonth(1)}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.totals}>
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Пришло</Text>
              <Text style={[styles.totalValue, styles.income]}>{money(income)}</Text>
            </View>
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Ушло</Text>
              <Text style={[styles.totalValue, styles.expense]}>{money(expense)}</Text>
            </View>
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Остаток</Text>
              <Text style={styles.totalValue}>{money(income - expense)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Куда ушло</Text>
            {categories.length === 0 ? (
              <Text style={styles.empty}>Трат за этот месяц нет.</Text>
            ) : (
              categories.map(([name, sum], i) => (
                <View key={name} style={styles.categoryRow}>
                  <View style={styles.categoryHead}>
                    <View style={[styles.categoryDot, { backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length] }]} />
                    <Text style={styles.categoryName}>{name}</Text>
                    <Text style={styles.categorySum}>{money(sum)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${expense > 0 ? Math.round((sum / expense) * 100) : 0}%`,
                          backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length],
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Разобрать выписку (PDF)</Text>
            <Text style={styles.hint}>
              Файл уходит в OpenAI, оттуда возвращается список операций с категориями. Проверьте его глазами —
              модель может ошибиться в суммах и датах.
            </Text>

            <Pressable
              style={[styles.primaryButton, analyseMutation.isPending && styles.buttonBusy]}
              disabled={analyseMutation.isPending}
              onPress={() => analyseMutation.mutate()}
            >
              <Text style={styles.primaryButtonText}>
                {analyseMutation.isPending ? "Читаю выписку…" : "Выбрать PDF"}
              </Text>
            </Pressable>

            {aiError ? <Text style={styles.error}>{aiError}</Text> : null}

            {analysis ? (
              <View style={styles.analysis}>
                {analysis.summary ? <Text style={styles.summary}>{analysis.summary}</Text> : null}

                <Text style={styles.subTitle}>Найдено операций: {analysis.transactions.length}</Text>
                {analysis.transactions.slice(0, 8).map((t, i) => (
                  <View key={`${t.date}-${i}`} style={styles.parsedRow}>
                    <Text style={styles.parsedDate}>{formatDateKey(t.date)}</Text>
                    <Text style={styles.parsedTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={t.direction === "income" ? styles.income : styles.expense}>
                      {t.direction === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </Text>
                  </View>
                ))}
                {analysis.transactions.length > 8 ? (
                  <Text style={styles.hint}>…и ещё {analysis.transactions.length - 8}</Text>
                ) : null}

                {analysis.advice.length > 0 ? (
                  <>
                    <Text style={styles.subTitle}>Что стоит посмотреть</Text>
                    {analysis.advice.map((line, i) => (
                      <Text key={i} style={styles.adviceLine}>
                        • {line}
                      </Text>
                    ))}
                    <Text style={styles.disclaimer}>
                      Это общие соображения, а не индивидуальная инвестиционная рекомендация.
                    </Text>
                  </>
                ) : null}

                <View style={styles.analysisActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => setAnalysis(null)}>
                    <Text style={styles.secondaryButtonText}>Отменить</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryButton}
                    disabled={saveParsedMutation.isPending || analysis.transactions.length === 0}
                    onPress={() => saveParsedMutation.mutate(analysis)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {saveParsedMutation.isPending ? "Сохраняю…" : "Сохранить операции"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Добавить вручную</Text>
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, styles.inputWide]}
                value={title}
                onChangeText={setTitle}
                placeholder="На что или откуда"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="5000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, styles.inputWide]}
                value={category}
                onChangeText={setCategory}
                placeholder="Категория"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                style={[styles.toggle, direction === "expense" && styles.toggleActive]}
                onPress={() => setDirection("expense")}
              >
                <Text style={[styles.toggleText, direction === "expense" && styles.toggleTextActive]}>Расход</Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, direction === "income" && styles.toggleActive]}
                onPress={() => setDirection("income")}
              >
                <Text style={[styles.toggleText, direction === "income" && styles.toggleTextActive]}>Приход</Text>
              </Pressable>
            </View>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={addManual} disabled={addMutation.isPending}>
              <Text style={styles.primaryButtonText}>Добавить</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Операции</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty}>За этот месяц записей нет.</Text>
            ) : (
              rows.map((row: Transaction) => (
                <View key={row.id} style={styles.txRow}>
                  <Text style={styles.txDate}>{formatDateKey(row.date)}</Text>
                  <View style={styles.txBody}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text style={styles.txCategory}>
                      {row.category}
                      {row.source === "import" ? " · из выписки" : ""}
                    </Text>
                  </View>
                  <Text style={row.direction === "income" ? styles.income : styles.expense}>
                    {row.direction === "income" ? "+" : "−"}
                    {money(Number(row.amount))}
                  </Text>
                  <Pressable onPress={() => deleteMutation.mutate(row.id)}>
                    <Text style={styles.remove}>×</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
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
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginBottom: 14,
    },
    navButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    navButtonText: {
      fontSize: 16,
      lineHeight: 18,
      color: colors.text,
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    content: {
      gap: 12,
      paddingBottom: 24,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    totals: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    total: {
      flex: 1,
      minWidth: 140,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 4,
    },
    totalLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    income: {
      color: "#059669",
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    expense: {
      color: colors.danger,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    subTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      marginTop: 6,
    },
    empty: {
      fontSize: 13,
      color: colors.textFaint,
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textFaint,
    },
    error: {
      fontSize: 13,
      color: colors.danger,
    },
    categoryRow: {
      gap: 4,
    },
    categoryHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    categoryName: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    categorySum: {
      fontSize: 14,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    barFill: {
      height: 6,
      borderRadius: 3,
    },
    primaryButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: colors.accent,
    },
    buttonBusy: {
      opacity: 0.6,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    secondaryButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    analysis: {
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    parsedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    parsedDate: {
      fontSize: 12,
      color: colors.textMuted,
      width: 86,
      fontVariant: ["tabular-nums"],
    },
    parsedTitle: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },
    adviceLine: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.text,
    },
    disclaimer: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textFaint,
      marginTop: 4,
    },
    analysisActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
    },
    bubble: {
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      maxWidth: "90%",
    },
    bubbleUser: {
      alignSelf: "flex-end",
      backgroundColor: colors.accentMuted,
    },
    bubbleAnswer: {
      alignSelf: "flex-start",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    formRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
      minWidth: 110,
    },
    inputWide: {
      flex: 1,
      minWidth: 180,
    },
    toggle: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    toggleActive: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    toggleText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    toggleTextActive: {
      color: colors.accent,
    },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    txDate: {
      fontSize: 12,
      color: colors.textMuted,
      width: 86,
      fontVariant: ["tabular-nums"],
    },
    txBody: {
      flex: 1,
    },
    txTitle: {
      fontSize: 14,
      color: colors.text,
    },
    txCategory: {
      fontSize: 11,
      color: colors.textFaint,
    },
    remove: {
      fontSize: 16,
      color: colors.textFaint,
      paddingHorizontal: 4,
    },
  });
