// Системные напоминания о задачах (локальные уведомления).
//
// Источник правды — tasks.remind_at в базе. Телефон хранит свой список
// запланированных уведомлений, и он может разойтись с базой: задачу поправили
// с другого устройства, время сдвинули, задачу закрыли. Поэтому сверка идёт
// целиком: снять все наши уведомления и назначить заново по текущим задачам.
// Их немного (только будущие и незакрытые), так что это дёшево.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { almatyTimeOf } from "@/lib/date";
import type { Task } from "@/lib/types";

/** В браузере expo-notifications не работает — там напоминание только хранится. */
export const REMINDERS_SUPPORTED = Platform.OS !== "web";

if (REMINDERS_SUPPORTED) {
  // Показывать уведомление, даже когда приложение открыто.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let androidChannelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || androidChannelReady) return;
  // На Android 8+ без канала уведомление не покажется, и канал нужен до запроса прав.
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "Напоминания",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
  });
  androidChannelReady = true;
}

/** Разрешение спрашиваем молча и только когда напоминания реально есть. */
export async function ensurePermission(): Promise<boolean> {
  if (!REMINDERS_SUPPORTED) return false;
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Привести запланированные уведомления в соответствие с задачами.
 * `tasks` — незакрытые задачи с remind_at в будущем.
 */
export async function syncReminders(tasks: Task[]): Promise<void> {
  if (!REMINDERS_SUPPORTED) return;

  const planned = tasks.filter((task) => task.remind_at && new Date(task.remind_at) > new Date());

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (planned.length === 0) return;

  if (!(await ensurePermission())) return;

  for (const task of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: task.id,
      content: {
        title: task.title,
        body: `Напоминание на ${almatyTimeOf(task.remind_at!)}`,
        data: { taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(task.remind_at!),
        ...(Platform.OS === "android" ? { channelId: "reminders" } : null),
      },
    });
  }
}
