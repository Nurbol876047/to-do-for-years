import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  createNote,
  createTask,
  deleteNote,
  deleteTask,
  getWeekByStart,
  listBoardNotes,
  listGoalsForWeek,
  listInboxTasks,
  saveTaskFromForm,
  setNoteDone,
  setTaskDone,
  updateNote,
} from "@/lib/api";
import { BoardColumn, type BoardItem } from "@/components/BoardColumn";
import { NoteForm } from "@/components/NoteForm";
import { TaskForm } from "@/components/TaskForm";
import { NOTE_LISTS } from "@/lib/noteLists";
import { currentWeekStart } from "@/lib/date";
import { qk } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase";
import { BLOCK_COLORS, useColors, type Palette } from "@/lib/theme";
import type { Note, NoteList, Task, TaskFormValue } from "@/lib/types";

export default function InboxScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const weekStart = currentWeekStart();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const { data: week } = useQuery({ queryKey: qk.week(weekStart), queryFn: () => getWeekByStart(weekStart) });

  const { data: goals } = useQuery({
    queryKey: qk.goals(week?.id ?? "none"),
    queryFn: () => listGoalsForWeek(week!.id),
    enabled: Boolean(week?.id),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: qk.tasksInbox,
    queryFn: listInboxTasks,
  });

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: qk.notesBoard,
    queryFn: listBoardNotes,
  });

  const weekGoals = goals ?? [];
  const inboxTasks = tasks ?? [];
  const allNotes = notes ?? [];

  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: qk.tasks });
  const invalidateNotes = () => queryClient.invalidateQueries({ queryKey: qk.notes });

  // --- задачи ---

  const addTaskMutation = useMutation({
    mutationFn: (title: string) => createTask({ title }),
    onSuccess: invalidateTasks,
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setTaskDone(id, done),
    onSuccess: invalidateTasks,
  });

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormKey, setTaskFormKey] = useState(0);

  const saveTaskMutation = useMutation({
    mutationFn: (value: TaskFormValue) => saveTaskFromForm(editingTask, value),
    onSuccess: () => {
      invalidateTasks();
      setTaskFormOpen(false);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: Task) => deleteTask(task.id),
    onSuccess: () => {
      invalidateTasks();
      setTaskFormOpen(false);
    },
  });

  function openTask(id: string) {
    setEditingTask(inboxTasks.find((t) => t.id === id) ?? null);
    setTaskFormKey((k) => k + 1);
    setTaskFormOpen(true);
  }

  // --- заметки ---

  const addNoteMutation = useMutation({
    mutationFn: ({ body, list }: { body: string; list: NoteList }) =>
      createNote({ body, list, color: BLOCK_COLORS[0] }),
    onSuccess: invalidateNotes,
  });

  const toggleNoteMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setNoteDone(id, done),
    onSuccess: invalidateNotes,
  });

  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteFormKey, setNoteFormKey] = useState(0);

  const saveNoteMutation = useMutation({
    mutationFn: (value: { body: string; list: NoteList; color: string }) =>
      editingNote ? updateNote(editingNote.id, value) : createNote(value),
    onSuccess: () => {
      invalidateNotes();
      setNoteFormOpen(false);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (note: Note) => deleteNote(note.id),
    onSuccess: () => {
      invalidateNotes();
      setNoteFormOpen(false);
    },
  });

  function openNote(id: string) {
    setEditingNote(allNotes.find((n) => n.id === id) ?? null);
    setNoteFormKey((k) => k + 1);
    setNoteFormOpen(true);
  }

  const taskItems: BoardItem[] = inboxTasks.map((task) => ({
    id: task.id,
    text: task.title,
    done: task.done,
  }));

  // Колонки одной ширины: на широком экране рядом, на телефоне листаются вбок.
  const columnWidth = Math.min(320, Math.max(240, width - 72));
  const isLoading = tasksLoading || notesLoading;

  // Стрелки под доской: мышью горизонтальную полосу крутить неудобно.
  // Размеры берём из самого события прокрутки — отдельные замеры успевают
  // устареть, пока колонки раскладываются, и тогда стрелки упираются раньше
  // края. До первой прокрутки работают onLayout/onContentSizeChange.
  const boardRef = useRef<ScrollViewInstance>(null);
  const [board, setBoard] = useState({ x: 0, width: 0, content: 0 });

  const maxScroll = Math.max(0, board.content - board.width);
  const canScrollLeft = board.x > 4;
  const canScrollRight = board.x < maxScroll - 4;

  function scrollBoard(direction: -1 | 1) {
    // Край не считаем сами: scrollTo за пределами обрезается до края.
    const step = columnWidth + 12;
    boardRef.current?.scrollTo({ x: Math.max(0, board.x + direction * step), animated: true });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Входящие</Text>
          <Text style={styles.subtitle}>
            Задачи без даты и заметки по спискам. Галочка закрывает запись, нажатие — открывает.
          </Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Выйти</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.boardArea}>
          <ScrollView
            ref={boardRef}
            horizontal
            showsHorizontalScrollIndicator
            persistentScrollbar
            contentContainerStyle={styles.board}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              setBoard({ x: contentOffset.x, width: layoutMeasurement.width, content: contentSize.width });
            }}
            scrollEventThrottle={16}
            onLayout={(e) => {
              const { width: w } = e.nativeEvent.layout;
              setBoard((prev) => (prev.width === w ? prev : { ...prev, width: w }));
            }}
            onContentSizeChange={(w) => setBoard((prev) => (prev.content === w ? prev : { ...prev, content: w }))}
          >
          <View style={{ width: columnWidth }}>
            <BoardColumn
              title="Задачи"
              hint="Задачи без даты. Откройте задачу, чтобы дать ей день, время или цель."
              items={taskItems}
              addPlaceholder="+ Добавить задачу"
              onAdd={(text) => addTaskMutation.mutate(text)}
              onToggle={(id, done) => toggleTaskMutation.mutate({ id, done })}
              onOpen={openTask}
              onDelete={(id) => {
                const task = inboxTasks.find((t) => t.id === id);
                if (task) deleteTaskMutation.mutate(task);
              }}
            />
          </View>

          {NOTE_LISTS.map((info) => {
            const items: BoardItem[] = allNotes
              .filter((note) => note.list === info.key)
              .map((note) => ({ id: note.id, text: note.body ?? "", done: note.done, color: note.color }));

            return (
              <View key={info.key} style={{ width: columnWidth }}>
                <BoardColumn
                  title={info.label}
                  hint={info.hint}
                  items={items}
                  addPlaceholder="+ Добавить заметку"
                  onAdd={(text) => addNoteMutation.mutate({ body: text, list: info.key })}
                  onToggle={(id, done) => toggleNoteMutation.mutate({ id, done })}
                  onOpen={openNote}
                  onDelete={(id) => {
                    const note = allNotes.find((n) => n.id === id);
                    if (note) deleteNoteMutation.mutate(note);
                  }}
                />
              </View>
            );
          })}
          </ScrollView>

          {maxScroll > 0 ? (
            <View style={styles.arrows} pointerEvents="box-none">
              <Pressable
                style={[styles.arrow, !canScrollLeft && styles.arrowOff]}
                disabled={!canScrollLeft}
                onPress={() => scrollBoard(-1)}
              >
                <Text style={styles.arrowText}>‹</Text>
              </Pressable>
              <Pressable
                style={[styles.arrow, !canScrollRight && styles.arrowOff]}
                disabled={!canScrollRight}
                onPress={() => scrollBoard(1)}
              >
                <Text style={styles.arrowText}>›</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      <NoteForm
        key={`note-${noteFormKey}`}
        visible={noteFormOpen}
        initial={editingNote}
        defaultList={editingNote?.list ?? "ideas"}
        saving={saveNoteMutation.isPending || deleteNoteMutation.isPending}
        onClose={() => setNoteFormOpen(false)}
        onSave={(value) => saveNoteMutation.mutate(value)}
        onDelete={editingNote ? () => deleteNoteMutation.mutate(editingNote) : undefined}
      />

      <TaskForm
        key={`task-${taskFormKey}`}
        visible={taskFormOpen}
        initial={editingTask}
        weekStart={weekStart}
        goals={weekGoals}
        saving={saveTaskMutation.isPending || deleteTaskMutation.isPending}
        onClose={() => setTaskFormOpen(false)}
        onSave={(value) => saveTaskMutation.mutate(value)}
        onDelete={editingTask ? () => deleteTaskMutation.mutate(editingTask) : undefined}
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
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  headerText: {
    flex: 1,
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
  signOut: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  boardArea: {
    flex: 1,
  },
  board: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 16,
  },
  arrows: {
    position: "absolute",
    right: 0,
    bottom: 14,
    flexDirection: "row",
    gap: 10,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowOff: {
    opacity: 0.35,
  },
  arrowText: {
    fontSize: 18,
    lineHeight: 20,
    color: colors.text,
  },
});
