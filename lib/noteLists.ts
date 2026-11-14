// Пять постоянных списков заметок на «Входящих».
// Порядок задуман по пути мысли: сначала то, чем занят сейчас, в конце — архив.

import type { NoteList } from "@/lib/types";

export interface NoteListInfo {
  key: NoteList;
  label: string;
  /** Для пустого списка — подсказка, что сюда складывать. */
  hint: string;
}

export const NOTE_LISTS: NoteListInfo[] = [
  { key: "focus", label: "Фокус", hint: "Чем занят прямо сейчас — одна-две вещи, не больше." },
  { key: "ideas", label: "Идеи", hint: "Мысли, которые жалко забыть, но делать прямо сейчас не нужно." },
  { key: "study", label: "Учёба", hint: "Предметы, задания, вопросы преподавателю." },
  { key: "personal", label: "Личные", hint: "Всё, что не про учёбу: покупки, здоровье, дом." },
  { key: "archive", label: "Архив", hint: "Сюда переносится то, что отжило своё, но выбрасывать рано." },
];

export function noteListLabel(key: NoteList): string {
  return NOTE_LISTS.find((l) => l.key === key)?.label ?? key;
}
