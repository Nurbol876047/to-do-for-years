// Разбор банковской выписки (PDF) моделью OpenAI.
//
// ВНИМАНИЕ ПРО КЛЮЧ: всё, что начинается с EXPO_PUBLIC_, попадает в бандл
// приложения — ключ увидит любой, у кого есть сборка. Так можно только для
// локальной проверки. Для настоящей работы запрос должен уходить с сервера
// (Supabase Edge Function), а приложение — ходить к нему; тогда поменяется
// только адрес и заголовок в analyseStatement() ниже.

import type { TransactionDirection } from "@/lib/types";

const API_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL ?? "gpt-4o-mini";

export const AI_KEY_SET = Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY);

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  title: string;
  amount: number;
  direction: TransactionDirection;
  category: string;
}

export interface StatementAnalysis {
  transactions: ParsedTransaction[];
  /** Короткий вывод: на что уходят деньги. */
  summary: string;
  /** Общие соображения, куда смотреть дальше. Не инвестиционная рекомендация. */
  advice: string[];
}

const PROMPT = `Ты разбираешь банковскую выписку из PDF.

Верни ТОЛЬКО JSON без markdown и пояснений, строго такой формы:
{
  "transactions": [
    { "date": "YYYY-MM-DD", "title": "кому или за что", "amount": 1234.56,
      "direction": "income" | "expense", "category": "одна из категорий ниже" }
  ],
  "summary": "2-3 предложения: куда уходят деньги, что заметно",
  "advice": ["3-5 общих соображений на русском"]
}

Правила:
- amount всегда положительное число, знак выражай через direction.
- Категории выбирай из: Еда, Транспорт, Жильё, Связь и интернет, Учёба,
  Здоровье, Одежда, Развлечения, Переводы, Подписки, Зарплата, Прочее.
- Если дата в выписке без года — возьми год из периода выписки.
- Пропускай служебные строки вроде «остаток» и «итого»; банковскую комиссию
  вноси как расход с категорией Прочее.
- В advice пиши общие и осторожные соображения о расходах и накоплениях:
  на чём видно перерасход, какую долю разумно откладывать, какую подушку
  безопасности держать. Не называй конкретные ценные бумаги, монеты, фонды или
  компании и не обещай доходность — это не индивидуальная инвестиционная
  рекомендация.`;

/** Достаёт текст ответа из формата Responses API. */
function outputText(payload: unknown): string {
  const data = payload as { output?: { content?: { type?: string; text?: string }[] }[] };
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const chunk of item.content ?? []) {
      if (chunk.type === "output_text" && chunk.text) parts.push(chunk.text);
    }
  }
  return parts.join("\n");
}

/** Модель иногда оборачивает JSON в ```json — снимаем обёртку. */
function parseJson(text: string): StatementAnalysis {
  const cleaned = text.trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Модель вернула не JSON");

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<StatementAnalysis>;
  const rows = (parsed.transactions ?? []).filter(
    (t) => t && t.date && t.title && Number.isFinite(Number(t.amount))
  );

  return {
    transactions: rows.map((t) => ({
      date: String(t.date).slice(0, 10),
      title: String(t.title).slice(0, 200),
      amount: Math.abs(Number(t.amount)),
      direction: t.direction === "income" ? "income" : "expense",
      category: t.category ? String(t.category) : "Прочее",
    })),
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    advice: Array.isArray(parsed.advice) ? parsed.advice.map(String) : [],
  };
}

/** Отправляет PDF целиком: модель сама читает и текст, и таблицы. */
export async function analyseStatement(fileName: string, base64: string): Promise<StatementAnalysis> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) throw new Error("Ключ OpenAI не задан: EXPO_PUBLIC_OPENAI_API_KEY в .env");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", filename: fileName, file_data: `data:application/pdf;base64,${base64}` },
            { type: "input_text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 300)}`);
  }

  return parseJson(outputText(await response.json()));
}
