// Прокси к OpenAI Responses API. Ключ живёт только здесь, на сервере
// (секрет OPENAI_API_KEY), и никогда не попадает в бандл приложения.
// Вызывается из lib/ai/chat.ts и lib/ai/statement.ts через
// supabase.functions.invoke("openai-proxy", { body }).
//
// По умолчанию Supabase проверяет JWT пользователя ещё на шлюзе, до того как
// управление дойдёт сюда, — анонимный вызов отбивается раньше этого кода.

const OPENAI_URL = "https://api.openai.com/v1/responses";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY не задан на сервере" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Тело запроса не JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
});
