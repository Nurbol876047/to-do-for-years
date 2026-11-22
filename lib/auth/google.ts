import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * Результат попытки входа через Google.
 * `cancelled` — пользователь сам закрыл окно Google, это не ошибка.
 */
export interface GoogleSignInResult {
  error: string | null;
  cancelled: boolean;
}

const OK: GoogleSignInResult = { error: null, cancelled: false };
const CANCELLED: GoogleSignInResult = { error: null, cancelled: true };

function fail(message: string): GoogleSignInResult {
  return { error: message, cancelled: false };
}

/**
 * Куда Supabase вернёт пользователя после Google.
 *
 * Веб: тот же origin, что и сейчас — адрес обязан быть в списке Redirect URLs
 * в Supabase, иначе вернёт на Site URL.
 * Телефон: `Linking.createURL` сам подставит схему приложения из app.json
 * (`notebook://auth-callback`), а в Expo Go — адрес dev-сервера
 * (`exp://127.0.0.1:8081/--/auth-callback`).
 */
function redirectUrl(): string {
  if (Platform.OS === "web") {
    return `${window.location.origin}/login`;
  }
  return Linking.createURL("auth-callback");
}

/**
 * Проверяет ссылку на вход, не уводя с неё пользователя.
 *
 * Про выключенный провайдер или кривой адрес возврата Supabase сообщает не
 * ответом на вызов `signInWithOAuth`, а уже на своей странице `/authorize`.
 * Если просто уйти туда браузером, человек увидит голый JSON с английской
 * ошибкой. Поэтому сначала дёргаем адрес тихо: рабочая настройка отвечает
 * редиректом на Google, сломанная — читаемым JSON, который мы и показываем
 * на экране входа.
 *
 * Запрос идемпотентный: `/authorize` только собирает ссылку, ничего не тратя.
 */
async function describeAuthorizeProblem(url: string): Promise<string | null> {
  try {
    // В браузере редирект на чужой домен ловим «непрозрачным» ответом.
    // В React Native параметра `redirect` нет — fetch сам идёт по редиректу,
    // и мы оказываемся уже на стороне Google.
    const response = await fetch(url, {
      redirect: Platform.OS === "web" ? "manual" : "follow",
    });

    if (response.type === "opaqueredirect" || response.status === 0 || response.ok) {
      return null;
    }

    // Телефон: ушли по редиректу и получили ошибку не от Supabase, а от
    // Google — это уже его дело, окно авторизации покажет всё само.
    if (response.url && new URL(response.url).origin !== new URL(url).origin) {
      return null;
    }

    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object"
        ? ((body as Record<string, unknown>).msg ??
          (body as Record<string, unknown>).error_description ??
          (body as Record<string, unknown>).error)
        : null;

    return typeof message === "string"
      ? message
      : `Supabase ответил ${response.status} на запрос входа через Google.`;
  } catch {
    // CORS, офлайн, блокировщик — не повод рубить заведомо рабочий вход.
    return null;
  }
}

/** Собирает ссылку на страницу согласия Google и проверяет, что она рабочая. */
async function buildAuthorizeUrl(redirectTo: string): Promise<{ url: string } | GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Редирект делаем сами: на вебе — после проверки ссылки, на телефоне —
      // через системное окно авторизации.
      skipBrowserRedirect: true,
      // Без этого Google молча входит под единственным аккаунтом,
      // и сменить пользователя уже нельзя.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    return fail(error.message);
  }
  if (!data?.url) {
    return fail("Supabase не вернул ссылку на Google.");
  }

  const problem = await describeAuthorizeProblem(data.url);
  return problem ? fail(problem) : { url: data.url };
}

/**
 * Вход через аккаунт Google.
 *
 * На вебе уводим страницу на Google сами; возврат с `?code=...` разбирает
 * `completeGoogleRedirect` при следующей загрузке экрана входа.
 *
 * На телефоне открываем системное окно авторизации и меняем код на сессию
 * прямо здесь — там адресную строку за нас никто не разберёт.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = redirectUrl();
  const authorize = await buildAuthorizeUrl(redirectTo);

  if (!("url" in authorize)) {
    return authorize;
  }

  if (Platform.OS === "web") {
    window.location.assign(authorize.url);
    return OK;
  }

  const result = await WebBrowser.openAuthSessionAsync(authorize.url, redirectTo);

  // 'locked' — окно авторизации уже открыто другим вызовом.
  if (result.type === "locked") {
    return fail("Окно входа через Google уже открыто. Закройте его и попробуйте снова.");
  }
  // 'cancel' — закрыли окно, 'dismiss' — свернули. Ругаться не на что.
  if (result.type !== "success") {
    return CANCELLED;
  }

  return exchangeCallbackUrl(result.url);
}

/** Меняет `?code=...` из адреса возврата на сессию Supabase. */
async function exchangeCallbackUrl(callbackUrl: string): Promise<GoogleSignInResult> {
  const params = new URL(callbackUrl).searchParams;
  const outcome = readCallbackOutcome(params);

  if (outcome) {
    return outcome;
  }

  const code = params.get("code");
  if (!code) {
    return fail("Google вернулся без кода авторизации.");
  }

  return exchangeCode(code);
}

/**
 * Меняет одноразовый код на сессию.
 *
 * Код сгорает при первом обмене, а вызвать обмен успевают двое: в dev-режиме
 * экран монтируется дважды. Поэтому на ошибку смотрим только вместе с
 * сессией — если её уже положил параллельный вызов, жаловаться не на что.
 */
async function exchangeCode(code: string): Promise<GoogleSignInResult> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    return OK;
  }

  const { data } = await supabase.auth.getSession();
  return data.session ? OK : fail(error.message);
}

/** Разбирает отказ, пришедший в адресе возврата. `null` — отказа не было. */
function readCallbackOutcome(params: URLSearchParams): GoogleSignInResult | null {
  const error = params.get("error");
  if (!error) {
    return null;
  }

  // Человек нажал «Отмена» на странице согласия Google — это не поломка.
  if (error === "access_denied") {
    return CANCELLED;
  }

  return fail(params.get("error_description") ?? params.get("error_code") ?? error);
}

/**
 * Есть ли в адресной строке ответ от Google, который надо доразобрать.
 * Нужно синхронно, чтобы экран входа сразу показал «завершаем вход», а не
 * моргнул формой поверх уже идущего входа.
 */
export function hasPendingGoogleRedirect(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error");
}

// Обмен кода одноразовый: второй раз Supabase ответит ошибкой. В dev-режиме
// эффекты монтируются дважды, поэтому держим флаг на уровне модуля.
let redirectHandled = false;

/**
 * Завершает веб-вход после возврата от Google.
 *
 * `detectSessionInUrl` у supabase-js выключен намеренно: он делает то же
 * самое, но про неудачный обмен молчит — человек видит пустую форму входа и
 * `?code=` в адресе, без единой подсказки. Здесь ошибка возвращается наружу.
 *
 * Адрес чистит экран входа: историей на вебе распоряжается Expo Router, и
 * `history.replaceState` мимо него он во время гидратации просто откатывает.
 *
 * `null` — разбирать было нечего (обычная загрузка экрана входа).
 */
export async function completeGoogleRedirect(): Promise<GoogleSignInResult | null> {
  if (!hasPendingGoogleRedirect() || redirectHandled) {
    return null;
  }
  redirectHandled = true;

  const params = new URLSearchParams(window.location.search);
  const outcome = readCallbackOutcome(params);
  const code = params.get("code");

  if (outcome) {
    return outcome;
  }
  if (!code) {
    return null;
  }

  return exchangeCode(code);
}
