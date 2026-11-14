// Ключи react-query в одном месте: экраны читают одни и те же данные
// по-разному (неделя — диапазоном, «Сегодня» — одной датой, «Входящие» — без
// даты), поэтому инвалидация идёт по общему префиксу.

export const qk = {
  weeks: ["weeks"] as const,
  week: (weekStart: string) => ["weeks", weekStart] as const,
  goals: (weekId: string) => ["goals", weekId] as const,

  settings: ["userSettings"] as const,

  scheduleBlocks: ["scheduleBlocks"] as const,

  events: ["events"] as const,
  eventsRange: (weekStart: string) => ["events", "range", weekStart] as const,
  eventsDate: (date: string) => ["events", "date", date] as const,

  tasks: ["tasks"] as const,
  tasksRange: (weekStart: string) => ["tasks", "range", weekStart] as const,
  tasksDate: (date: string) => ["tasks", "date", date] as const,
  tasksInbox: ["tasks", "inbox"] as const,
  tasksYear: (year: number) => ["tasks", "year", year] as const,
  tasksReminders: ["tasks", "reminders"] as const,

  dayMarks: ["dayMarks"] as const,
  dayMarksYear: (year: number) => ["dayMarks", "year", year] as const,
  dayMarksRange: (from: string) => ["dayMarks", "range", from] as const,

  notes: ["notes"] as const,
  notesProject: ["notes", "project"] as const,
  notesList: (list: string) => ["notes", "list", list] as const,
  notesBoard: ["notes", "board"] as const,

  transactions: ["transactions"] as const,
  transactionsRange: (from: string) => ["transactions", "range", from] as const,
  notesWeek: (weekId: string) => ["notes", "week", weekId] as const,
};
