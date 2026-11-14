import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initAuthListener } from "@/lib/store/auth";
import { useThemeStore } from "@/lib/theme";

const queryClient = new QueryClient();

export default function RootLayout() {
  // На тёмной теме надписи статус-бара должны быть светлыми.
  const mode = useThemeStore((state) => state.mode);
  useEffect(() => {
    initAuthListener();
    // Тема сохраняется между запусками.
    void useThemeStore.getState().restore();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(app)" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
