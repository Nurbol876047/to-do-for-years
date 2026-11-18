// Текущий момент для экранов дня и недели: какая сейчас дата и сколько минут
// прошло с начала суток. Пересчитывается на границе каждой минуты, поэтому
// отметка «сейчас» не отстаёт и день сам переключается в полночь.

import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { almatyMinutesOfDay, todayInAlmaty } from "@/lib/date";

export interface NowMoment {
  /** Текущая дата в Алматы, YYYY-MM-DD. */
  dateKey: string;
  /** Минуты от начала суток в Алматы: 10:32 -> 632. */
  minutes: number;
}

function readNow(): NowMoment {
  const now = new Date();
  return { dateKey: todayInAlmaty(now), minutes: almatyMinutesOfDay(now) };
}

/** Сколько миллисекунд до начала следующей минуты. */
function msToNextMinute(): number {
  // Смещение Алматы кратно минуте, поэтому граница минуты совпадает с UTC.
  const rest = 60_000 - (Date.now() % 60_000);
  // Защита от нулевой паузы, иначе таймер начнёт крутиться вхолостую.
  return Math.max(250, rest);
}

export function useNow(): NowMoment {
  const [moment, setMoment] = useState<NowMoment>(readNow);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      clearTimeout(timer);
      setMoment((prev) => {
        const next = readNow();
        // Минута та же — отдаём прежний объект, чтобы не перерисовывать неделю зря.
        return next.minutes === prev.minutes && next.dateKey === prev.dateKey ? prev : next;
      });
      timer = setTimeout(tick, msToNextMinute());
    };

    timer = setTimeout(tick, msToNextMinute());

    // В фоне таймеры тормозят (вкладка свёрнута, приложение не на экране),
    // поэтому на возврате пересчитываем сразу, не дожидаясь своей минуты.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return moment;
}
