// Общая обработка ошибок supabase.functions.invoke("openai-proxy", ...)
// для lib/ai/chat.ts и lib/ai/statement.ts.

import type { FunctionsError } from "@supabase/supabase-js";

/** Достаёт текст ошибки из тела ответа функции, если он доступен. */
export async function proxyErrorMessage(error: FunctionsError): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context instanceof Response) {
    try {
      const body = await context.text();
      if (body) return `OpenAI через прокси: ${body.slice(0, 300)}`;
    } catch {
      // тело недоступно — используем error.message ниже
    }
  }
  return `OpenAI через прокси: ${error.message}`;
}
