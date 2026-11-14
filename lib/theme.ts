// Три темы под разное освещение: светлая, тёмная и тёплая («жёлтая») —
// последняя без чистого белого, чтобы глаза меньше уставали вечером.
// Компоненты берут палитру хуком useColors() и строят стили от неё.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "warm";

export interface Palette {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** Третий уровень: свободные окна, подписи — не должны спорить с делами. */
  textFaint: string;
  accent: string;
  accentMuted: string;
  danger: string;
  overloaded: string;
}

const LIGHT: Palette = {
  background: "#F5F6F8",
  surface: "#FFFFFF",
  border: "#E2E5EA",
  text: "#1A1D23",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  accent: "#2563EB",
  accentMuted: "#DBEAFE",
  danger: "#DC2626",
  overloaded: "#F59E0B",
};

const DARK: Palette = {
  background: "#15181D",
  surface: "#1D2128",
  border: "#2C323B",
  text: "#E7EAEE",
  textMuted: "#9AA2AE",
  textFaint: "#6E7682",
  accent: "#5A93F7",
  accentMuted: "#1E2B40",
  danger: "#F27171",
  overloaded: "#D99A2B",
};

const WARM: Palette = {
  background: "#F6EEDD",
  surface: "#FDF8EC",
  border: "#E4D7BC",
  text: "#332E22",
  textMuted: "#776B55",
  textFaint: "#A2947A",
  accent: "#9A6516",
  accentMuted: "#F0E2C4",
  danger: "#B03F28",
  overloaded: "#C0801A",
};

const PALETTES: Record<ThemeMode, Palette> = { light: LIGHT, dark: DARK, warm: WARM };

export const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "Светлая" },
  { mode: "dark", label: "Тёмная" },
  { mode: "warm", label: "Тёплая" },
];

const STORAGE_KEY = "notebook.theme";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Поднять сохранённый выбор при запуске. */
  restore: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  },
  restore: async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "warm") set({ mode: saved });
  },
}));

/** Палитра текущей темы. */
export function useColors(): Palette {
  return PALETTES[useThemeStore((s) => s.mode)];
}

export const SIDEBAR_BREAKPOINT = 768;

/** Палитра для блоков расписания, заметок и цветных меток целей. */
export const BLOCK_COLORS = [
  "#2563EB",
  "#DC2626",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#DB2777",
] as const;

/** Цвет цели по её позиции (1..3) — метки на задачах. */
export const GOAL_COLORS = ["#2563EB", "#059669", "#D97706"] as const;

export function goalColor(position: 1 | 2 | 3): string {
  return GOAL_COLORS[position - 1];
}
