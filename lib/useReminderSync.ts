// Держит системные уведомления в согласии с задачами: как только список
// будущих напоминаний в базе меняется, расписание уведомлений переназначается.

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { listUpcomingReminders } from "@/lib/api";
import { REMINDERS_SUPPORTED, syncReminders } from "@/lib/notifications";
import { qk } from "@/lib/queryKeys";

export function useReminderSync(): void {
  const { data } = useQuery({
    queryKey: qk.tasksReminders,
    queryFn: listUpcomingReminders,
    enabled: REMINDERS_SUPPORTED,
  });

  useEffect(() => {
    if (!data) return;
    // Планирование — работа с системой, а не с состоянием React: ошибку здесь
    // гасим, иначе отказ в правах уронил бы экран.
    void syncReminders(data).catch(() => undefined);
  }, [data]);
}
