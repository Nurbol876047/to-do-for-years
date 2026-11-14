// Чат по планировщику. Перед вопросом модель получает снимок данных: тема и
// цели недели, задачи, расписание, важные дни, заметки и деньги за месяц.
// Поэтому отвечает про конкретные планы, а не вообще.
// Про ключ — то же предупреждение, что в statement.ts: EXPO_PUBLIC_* виден всем.

const API_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL ?? "gpt-4o-mini";

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
  рекомендаций — только общие принципы.`;

function outputText(payload: unknown): string {
  const data = payload as { output?: { content?: { type?: string; text?: string }[] }[] };
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const chunk of item.content ?? []) {
      if (chunk.type === "output_text" && chunk.text) parts.push(chunk.text);
    }
  }
  return parts.join("\n").trim();
}

/** `snapshot` — текст из lib/ai/snapshot.ts. */
export async function askAssistant(history: ChatMessage[], snapshot: string): Promise<string> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) throw new Error("Ключ OpenAI не задан: EXPO_PUBLIC_OPENAI_API_KEY в .env");

  const input = [
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

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 300)}`);
  }

  const text = outputText(await response.json());
  if (!text) throw new Error("Пустой ответ модели");
  return text;
}
