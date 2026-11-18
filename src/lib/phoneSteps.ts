import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Health } from "@capgo/capacitor-health";

export const STEPS_CHOICE_KEY = "numiStepsChoice";
export const STEPS_PROMPT_KEY = "numiStepsPromptSeen";
export const STEPS_MANUAL_DATE_KEY = "numiStepsManualDate";
export const STEPS_MANUAL_DAYS_KEY = "numiStepsManualDays";
export const STEPS_SYNC_FROM_KEY = "numiStepsSyncFrom";

export type StepsChoice = "manual" | "health";
export type StepPhone = "web" | "old" | "new";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEK_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type WeekdayName = (typeof WEEK_ORDER)[number];

function isoFromDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayWeekdayName(): WeekdayName {
  return WEEKDAYS[new Date().getDay()];
}

export function todayIsoDate(): string {
  return isoFromDate(new Date());
}

export function tomorrowIsoDate(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return isoFromDate(d);
}

/** Monday 00:00 of the calendar week that contains today. */
export function calendarMonday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function currentWeekMondayIso(): string {
  return isoFromDate(calendarMonday());
}

export function isoForWeekdayThisWeek(day: string): string {
  const monday = calendarMonday();
  const index = WEEK_ORDER.indexOf(day as WeekdayName);
  const date = new Date(monday);
  date.setDate(monday.getDate() + (index < 0 ? 0 : index));
  return isoFromDate(date);
}

/** Monday through today's weekday. Tomorrow and later are not included. */
export function weekdaysThroughToday(): WeekdayName[] {
  const today = new Date().getDay();
  const index = today === 0 ? 6 : today - 1;
  return WEEK_ORDER.slice(0, index + 1);
}

function isWeekdayName(value: string): value is WeekdayName {
  return (WEEK_ORDER as readonly string[]).includes(value);
}

/** Days the person chose to keep, for this calendar week only. */
export function loadManualStepDays(): WeekdayName[] {
  try {
    const monday = currentWeekMondayIso();
    const raw = localStorage.getItem(STEPS_MANUAL_DAYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { weekMonday?: string; days?: string[] };
      if (parsed.weekMonday === monday && Array.isArray(parsed.days)) {
        return parsed.days.filter(isWeekdayName);
      }
    }
    if (localStorage.getItem(STEPS_MANUAL_DATE_KEY) === todayIsoDate()) {
      const todayName = todayWeekdayName();
      saveManualStepDays([todayName]);
      return [todayName];
    }
  } catch {
    return [];
  }
  return [];
}

export function saveManualStepDays(days: string[]) {
  const unique = days.filter(isWeekdayName);
  localStorage.setItem(
    STEPS_MANUAL_DAYS_KEY,
    JSON.stringify({ weekMonday: currentWeekMondayIso(), days: unique })
  );
}

export function clearManualStepDays() {
  localStorage.removeItem(STEPS_MANUAL_DAYS_KEY);
  localStorage.removeItem(STEPS_MANUAL_DATE_KEY);
}

/**
 * First date Health Connect may write into the current week.
 * After Complete Week this is tomorrow, so the finished week is not copied back in.
 * A missing or older value means this calendar Monday.
 */
export function stepsSyncFromIso(): string {
  const monday = currentWeekMondayIso();
  const stored = localStorage.getItem(STEPS_SYNC_FROM_KEY);
  if (!stored || stored < monday) return monday;
  return stored;
}

export function setStepsSyncFromTomorrow() {
  localStorage.setItem(STEPS_SYNC_FROM_KEY, tomorrowIsoDate());
}

export function clearStepsSyncFrom() {
  localStorage.removeItem(STEPS_SYNC_FROM_KEY);
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

/** Step totals for Monday through today. Null means the read failed. Days with no samples are 0. */
export async function readCurrentWeekSteps(): Promise<Record<WeekdayName, number> | null> {
  try {
    const start = calendarMonday();
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    const { samples } = await Health.queryAggregated({
      dataType: "steps",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: "day",
      aggregation: "sum",
    });
    const totals: Partial<Record<WeekdayName, number>> = {};
    for (const sample of samples ?? []) {
      const row = sample as { startDate?: string; start?: string; value?: number };
      const stamp = row.startDate || row.start;
      if (!stamp) continue;
      const when = new Date(stamp);
      if (Number.isNaN(when.getTime())) continue;
      const name = WEEKDAYS[when.getDay()];
      totals[name] = (totals[name] || 0) + (Number(row.value) || 0);
    }
    const result = {} as Record<WeekdayName, number>;
    for (const day of weekdaysThroughToday()) {
      result[day] = Math.max(0, Math.round(totals[day] || 0));
    }
    return result;
  } catch {
    return null;
  }
}
