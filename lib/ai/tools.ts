// Инструменты (OpenAI function calling) для чата: позволяют ассистенту не
// только читать снимок данных, но и менять задачи. Пишет в базу тот же
// клиент Supabase, что и остальное приложение (через lib/api, под RLS
// текущего пользователя) — ключ OpenAI тут ни при чём, он только для текста.

import { createTask, deleteTask, setTaskMain, updateTask } from "@/lib/api";

export const TASK_TOOLS = [
  {
    type: "function",
    name: "create_task",
    description:
      "Создать новую задачу. Без даты — попадает во «Входящие». is_main (главная задача дня) " +
      "учитывается, только если задана дата.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Текст задачи" },
        date: { type: ["string", "null"], description: "Дата YYYY-MM-DD или null для «Входящих»" },
        time: { type: ["string", "null"], description: "Время HH:MM, необязательно" },
        is_main: { type: "boolean", description: "Сделать главной задачей этого дня" },
      },
      required: ["title"],
    },
  },
  {
    type: "function",
    name: "update_task",
    description:
      "Изменить существующую задачу: название, дату, время, отметку «сделано» или «главная задача дня». " +
      "id берётся из списка задач в снимке данных. Указывай только поля, которые нужно изменить.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "id задачи из снимка данных" },
        title: { type: "string" },
        date: { type: ["string", "null"], description: "YYYY-MM-DD или null, чтобы убрать во «Входящие»" },
        time: { type: ["string", "null"] },
        done: { type: "boolean", description: "Отметить сделанной/не сделанной" },
        is_main: { type: "boolean", description: "Сделать/снять главную задачу дня" },
      },
      required: ["id"],
    },
  },
  {
    type: "function",
    name: "delete_task",
    description: "Удалить задачу безвозвратно. id берётся из списка задач в снимке данных.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "id задачи из снимка данных" },
      },
      required: ["id"],
    },
  },
];

function toolError(error: unknown): string {
  return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
}

export async function runTaskTool(name: string, rawArguments: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArguments || "{}");
  } catch {
    return toolError("Аргументы инструмента не JSON");
  }

  try {
    switch (name) {
      case "create_task": {
        const title = String(args.title ?? "").trim();
        if (!title) throw new Error("title обязателен");
        const date = (args.date as string | null | undefined) ?? null;
        const task = await createTask({
          title,
          date,
          time: (args.time as string | null | undefined) ?? null,
        });
        if (args.is_main && date) await setTaskMain(task.id, date, true);
        return JSON.stringify({ ok: true, task });
      }
      case "update_task": {
        const id = String(args.id ?? "");
        if (!id) throw new Error("id обязателен");
        const patch: Record<string, unknown> = {};
        for (const key of ["title", "date", "time", "done"] as const) {
          if (key in args) patch[key] = args[key];
        }
        const task = await updateTask(id, patch);
        if ("is_main" in args && task.date) {
          await setTaskMain(id, task.date, Boolean(args.is_main));
        }
        return JSON.stringify({ ok: true, task });
      }
      case "delete_task": {
        const id = String(args.id ?? "");
        if (!id) throw new Error("id обязателен");
        await deleteTask(id);
        return JSON.stringify({ ok: true });
      }
      default:
        return toolError(`Неизвестный инструмент: ${name}`);
    }
  } catch (error) {
    return toolError(error);
  }
}
