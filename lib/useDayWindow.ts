// Границы дня пользователя одним хуком: экраны считают свободное время
// по одному и тому же окну, а настройки лежат в общем кэше react-query.

import { useQuery } from "@tanstack/react-query";

import { getUserSettings } from "@/lib/api";
import { dayWindowOf, DEFAULT_SLEEP_HOURS, type DayWindow } from "@/lib/blocks";
import { qk } from "@/lib/queryKeys";

/** Окно дня из user_settings; пока настроек нет — значения по умолчанию. */
export function useDayWindow(): DayWindow {
  const { data } = useQuery({ queryKey: qk.settings, queryFn: getUserSettings });
  return dayWindowOf(data);
}

/** Часов сна в сутки из user_settings; пока настроек нет — значение по умолчанию. */
export function useSleepHours(): number {
  const { data } = useQuery({ queryKey: qk.settings, queryFn: getUserSettings });
  return data?.sleep_hours ?? DEFAULT_SLEEP_HOURS;
}
