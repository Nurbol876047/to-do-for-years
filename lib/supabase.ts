import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Не заданы EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Скопируйте .env.example в .env и заполните."
  );
}

// На вебе Expo Router рендерит первый экран на сервере (Node), где нет
// window/localStorage — AsyncStorage там падает. На этом проходе отдаём
// no-op-хранилище, в браузере и на устройстве работает обычный AsyncStorage.
const authStorage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) =>
          typeof window === "undefined" ? Promise.resolve(null) : AsyncStorage.getItem(key),
        setItem: (key: string, value: string) =>
          typeof window === "undefined" ? Promise.resolve() : AsyncStorage.setItem(key, value),
        removeItem: (key: string) =>
          typeof window === "undefined" ? Promise.resolve() : AsyncStorage.removeItem(key),
      }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
