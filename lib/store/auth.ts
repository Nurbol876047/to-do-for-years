import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  setSession: (session) => set({ session, isLoading: false }),
}));

let listenerStarted = false;

// Временный флаг для локальной разработки: пропускает экран входа, пока нет
// желания проходить email-код на каждый перезапуск. Экран логина и RLS не
// трогаем. Вход идёт под одним и тем же локальным dev-аккаунтом (не
// анонимным), чтобы данные были видны одинаково в любом браузере/вкладке —
// у анонимного входа auth.uid() новый в каждом отдельном localStorage, из-за
// чего RLS скрывал бы уже внесённые записи. Если Supabase ещё не настроен —
// экраны всё равно открываются (useCanEnter ниже), просто без сессии; на
// этом этапе экраны ещё не ходят в базу.
// Выключить — убрать EXPO_PUBLIC_DEV_SKIP_LOGIN из .env.
export const DEV_SKIP_LOGIN = process.env.EXPO_PUBLIC_DEV_SKIP_LOGIN === "true";

const DEV_EMAIL = "dev@notebook.local";
const DEV_PASSWORD = "notebook-dev-local";

/** Подписка на сессию Supabase. Вызывать один раз в корневом layout. */
export function initAuthListener(): void {
  if (listenerStarted) return;
  listenerStarted = true;

  supabase.auth.getSession().then(async ({ data }) => {
    // Закэшированная в localStorage сессия может принадлежать старому
    // анонимному пользователю (до перехода на фиксированный dev-аккаунт)
    // или пользователю, которого больше нет после `supabase db reset` —
    // в обоих случаях перелогиниваемся под dev-аккаунтом, а не оставляем
    // «протухшую» сессию висеть.
    const needsDevLogin = DEV_SKIP_LOGIN && (!data.session || data.session.user.email !== DEV_EMAIL);

    if (needsDevLogin) {
      const { data: devData, error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });
      if (!error) {
        useAuthStore.getState().setSession(devData.session);
        return;
      }
      console.warn("DEV_SKIP_LOGIN: вход под dev-аккаунтом не удался, нужен обычный логин.", error.message);
    }
    useAuthStore.getState().setSession(data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
  });
}

/** Можно ли открыть защищённые экраны: есть сессия, либо включён DEV_SKIP_LOGIN. */
export function useCanEnterApp(): boolean {
  const session = useAuthStore((s) => s.session);
  return Boolean(session) || DEV_SKIP_LOGIN;
}
