// Чат по планировщику. Перед вопросом модель получает снимок данных: тема и
// цели недели, задачи, расписание, важные дни, заметки и деньги за месяц.
// Поэтому отвечает про конкретные планы, а не вообще.
// Запрос уходит через supabase/functions/openai-proxy — ключ OpenAI остаётся
// на сервере и не попадает в бандл приложения.
//
// Модель может не только отвечать текстом, но и звать инструменты
// (lib/ai/tools.ts), чтобы создавать, менять и удалять задачи. Сами записи в
// базу идут напрямую с клиента, под RLS текущего пользователя, — прокси тут
// не участвует, он только пересказывает OpenAI, какие есть инструменты и что
// они вернули.

import { proxyErrorMessage } from "@/lib/ai/proxy";
import { runTaskTool, TASK_TOOLS } from "@/lib/ai/tools";
import { supabase } from "@/lib/supabase";

const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL ?? "gpt-4o-mini";

/** Сколько раз подряд модель может звать инструменты на один вопрос. */
const MAX_TOOL_ROUNDS = 4;

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `Ты помощник внутри личного планировщика. Пользователь — студент.
Тебе дают снимок его данных: тема и цели недели, задачи, расписание пар,
отмеченные важные дни, заметки по спискам и деньги за текущий месяц.

Как отвечать:
- По-русски, коротко и по делу: 2-5 предложений или короткий список.
- Опирайся на снимок и ссылайся на конкретику: названия задач, дни, суммы.
- Если в снимке нужных данных нет — так и скажи, не выдумывай.
- Когда просят спланировать день или неделю, учитывай занятые часы из
  расписания и уже назначенные задачи.
- Про деньги: можно обсуждать бюджет, подушку безопасности, долю накоплений и
  как сократить траты. Не называй конкретные ценные бумаги, монеты, фонды или
  компании, не обещай доходность и не давай индивидуальных инвестиционных
  рекомендаций — только общие принципы.
- Можешь создавать, менять и удалять задачи через инструменты create_task /
  update_task / delete_task — но только когда пользователь явно просит
  добавить, изменить, отметить сделанной или удалить задачу. Не делай этого
  "заодно" и не выдумывай задачи сам.
  Для update_task и delete_task бери id строго из списка задач в снимке
  данных (формат "[id:...] название") — никогда не придумывай id.
  Если неясно, какую именно задачу или дату имеют в виду, сначала спроси
  уточнение текстом, не вызывай инструмент наугад.
  После вызова инструмента коротко подтверди словами, что именно сделано.`;

interface ResponsesOutputItem {
  type?: string;
  content?: { type?: string; text?: string }[];
  call_id?: string;
  name?: string;
  arguments?: string;
}

function outputText(output: ResponsesOutputItem[]): string {
  const parts: string[] = [];
  for (const item of output) {
    for (const chunk of item.content ?? []) {
      if (chunk.type === "output_text" && chunk.text) parts.push(chunk.text);
    }
  }
  return parts.join("\n").trim();
}

/** `snapshot` — текст из lib/ai/snapshot.ts. */
export async function askAssistant(history: ChatMessage[], snapshot: string): Promise<string> {
  let input: unknown[] = [
    { role: "system", content: [{ type: "input_text", text: SYSTEM }] },
    { role: "user", content: [{ type: "input_text", text: `Мои данные сейчас:\n\n${snapshot}` }] },
    ...history.map((message) => ({
      role: message.role,
      content: [
        message.role === "user"
          ? { type: "input_text", text: message.text }
          : { type: "output_text", text: message.text },
      ],
    })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { data, error } = await supabase.functions.invoke("openai-proxy", {
      body: { model: MODEL, input, tools: TASK_TOOLS },
    });
    if (error) throw new Error(await proxyErrorMessage(error));

    const output = ((data as { output?: ResponsesOutputItem[] }).output ?? []) as ResponsesOutputItem[];
    const calls = output.filter((item) => item.type === "function_call");

    if (calls.length === 0) {
      const text = outputText(output);
      if (!text) throw new Error("Пустой ответ модели");
      return text;
    }

    input = [...input, ...output];
    for (const call of calls) {
      const result = await runTaskTool(call.name ?? "", call.arguments ?? "{}");
      input.push({ type: "function_call_output", call_id: call.call_id, output: result });
    }
  }

  throw new Error("Модель слишком долго вызывала инструменты подряд");
}
