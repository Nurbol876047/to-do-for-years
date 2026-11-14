import { Redirect, Slot } from "expo-router";

import { AppShell } from "@/components/AppShell";
import { useAuthStore, useCanEnterApp } from "@/lib/store/auth";
import { useReminderSync } from "@/lib/useReminderSync";

export default function AppLayout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const canEnterApp = useCanEnterApp();
  useReminderSync();

  if (isLoading) return null;
  if (!canEnterApp) return <Redirect href="/login" />;

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
