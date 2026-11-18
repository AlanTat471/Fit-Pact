import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Health } from "@capgo/capacitor-health";

export const STEPS_CHOICE_KEY = "numiStepsChoice";
export const STEPS_PROMPT_KEY = "numiStepsPromptSeen";
export const STEPS_MANUAL_DATE_KEY = "numiStepsManualDate";

export type StepsChoice = "manual" | "health";
export type StepPhone = "web" | "old" | "new";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function todayWeekdayName(): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[new Date().getDay()];
}

export function todayIsoDate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Android 14 (SDK 34) and newer include Health Connect. Older phones stay on typed steps. */
export async function getAndroidStepMode(): Promise<StepPhone> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return "web";
  try {
    const info = await Device.getInfo();
    return (info.androidSDKVersion ?? 0) >= 34 ? "new" : "old";
  } catch {
    return "old";
  }
}

export async function connectHealthSteps(): Promise<boolean> {
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return false;
    await Health.requestAuthorization({ read: ["steps"], write: [] });
    const status = await Health.checkAuthorization({ read: ["steps"], write: [] });
    return (status.readAuthorized ?? []).includes("steps");
  } catch {
    return false;
  }
}

/** Today's step total from Health Connect. Null means the read failed. */
export async function readTodaySteps(): Promise<number | null> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { samples } = await Health.queryAggregated({
      dataType: "steps",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: "day",
      aggregation: "sum",
    });
    const total = (samples ?? []).reduce((sum, sample) => sum + (Number(sample.value) || 0), 0);
    return Math.max(0, Math.round(total));
  } catch {
    return null;
  }
}
