import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  getActiveJourney,
  getLatestJourney,
  createJourney,
  upsertJourney,
  type JourneyRow,
} from "@/lib/supabaseJourney";
import { legacyWlWeek1StartToJourneyAnchor, resolveJourneyAnchorFromRow } from "@/lib/journeyAnchor";
import { getLatestTdee, upsertTdee, type TdeeRow } from "@/lib/supabaseTdee";
import { getCustomMacros, upsertCustomMacros } from "@/lib/supabaseMacros";
import { upsertProfile } from "@/lib/supabaseProfile";
import { trackJourneySave } from "@/lib/journeySaveFlush";
import { toast } from "@/hooks/use-toast";

// ──────────────────────────────────────────────────────────────────────────
// Stable JSON.stringify: sorts keys at every level so two logically-equal
// objects always produce the same string regardless of property insertion
// order. We use this for save-deduplication so a re-rendered payload that
// happens to enumerate its keys in a different order (or whose nested
// objects came back from Supabase with a different key order than we sent)
// doesn't trick the dedupe into firing an unnecessary PATCH.
// ──────────────────────────────────────────────────────────────────────────
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

/**
 * v10 — Hard guard against runaway PATCHes.
 *
 * The v9 release shipped with at least one effect path that could trigger
 * saveJourney() many times per second (the user saw 5,000+ PATCH requests
 * accumulate after a single sign-in). The component-level dedupe in
 * Dashboard.tsx was supposed to catch this but evidently didn't in every
 * code path (e.g. direct saveJourney calls in click handlers, refresh
 * paths, and any future caller we add).
 *
 * This map sits BELOW every caller: any saveJourney invocation is checked
 * against the most recent successful save for the same journey id, both by
 * content (stableStringify hash) AND by time (min interval). If either
 * gate triggers, the save is skipped silently — the function still
 * resolves, but no network request is made.
 *
 * Key choice: keep the map at module scope (not as a ref) so it survives
 * a UserDataProvider remount, which is what happens during the Supabase
 * onAuthStateChange race we hit in v9.
 */
const lastSaveByJourneyId = new Map<string, { hash: string; at: number }>();
/** Minimum ms between two successful saves of byte-identical content. */
const MIN_SAVE_INTERVAL_MS = 1500;

/**
 * v10 diagnostic counter. Every time saveJourney() is invoked we bump
 * `attempted`; every time we actually fire a PATCH we bump `fired`. If
 * something is calling saveJourney in a loop, attempted >> fired and
 * the user can see "saves throttled: N" in the console.
 *
 * Exposed on window for live debugging without a redeploy:
 *   window.__numiSaveStats        // { attempted, fired, throttled, failed }
 */
const saveStats = { attempted: 0, fired: 0, throttled: 0, failed: 0 };
if (typeof window !== "undefined") {
  (window as unknown as { __numiSaveStats: typeof saveStats }).__numiSaveStats = saveStats;
}

interface UserDataContextType {
  journey: JourneyRow | null;
  tdee: TdeeRow | null;
  customMacros: Record<string, number> | null;
  loading: boolean;
  /** Timestamp when data was last synced to localStorage - use as dep to re-load */
  lastSyncedAt: number;
  refreshJourney: () => Promise<void>;
  refreshTdee: () => Promise<void>;
  refreshMacros: () => Promise<void>;
  saveJourney: (payload: Partial<JourneyRow>) => Promise<void>;
  saveTdee: (payload: Partial<TdeeRow>) => Promise<void>;
  saveMacros: (macros: Record<string, number>) => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [tdee, setTdee] = useState<TdeeRow | null>(null);
  const [customMacros, setCustomMacros] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(0);

  const loadData = async (userId: string) => {
    setLoading(true);
    try {
      const [j, t, m] = await Promise.all([
        getActiveJourney(userId).then((j) => j ?? getLatestJourney(userId)),
        getLatestTdee(userId),
        getCustomMacros(userId),
      ]);
      let journeyData = j;
      if (!journeyData) {
        journeyData = await createJourney(userId);
      }
      if (journeyData) syncJourneyToLocalStorage(journeyData);
      if (t) syncTdeeToLocalStorage(t);
      if (m && Object.keys(m).length > 0) syncMacrosToLocalStorage(m);
      setJourney(journeyData);
      setTdee(t);
      setCustomMacros(m);
    } catch (e) {
      console.error("[UserData] load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const refreshJourney = async () => {
    if (!user) return;
    const j = await getActiveJourney(user.id);
    const latest = await getLatestJourney(user.id);
    const data = j ?? latest;
    setJourney(data || null);
    if (data) syncJourneyToLocalStorage(data);
  };

  const refreshTdee = async () => {
    if (!user) return;
    const t = await getLatestTdee(user.id);
    setTdee(t);
  };

  const refreshMacros = async () => {
    if (!user) return;
    const m = await getCustomMacros(user.id);
    setCustomMacros(m);
  };

  const saveJourney = useCallback(async (payload: Partial<JourneyRow>) => {
    if (!user || !journey) return;
    const journeyId = journey.id;
    saveStats.attempted += 1;

    // v10 — Hard dedupe.
    //
    // 1) Compute a key-order-independent hash of the payload, ignoring
    //    transient fields the client should never use to decide "is this
    //    a real change?" (updated_at is added by upsertJourney itself).
    // 2) Compare to the last successful save for this journey id. If the
    //    content is identical AND less than MIN_SAVE_INTERVAL_MS has
    //    elapsed, skip — this is the gate that stops a runaway autosave.
    //
    // We deliberately do NOT throw on a skip: legitimate callers (logout,
    // beforeunload) await this Promise and should resolve cleanly when
    // there's nothing new to persist.
    const hash = stableStringify(payload);
    const previous = lastSaveByJourneyId.get(journeyId);
    if (previous && previous.hash === hash) {
      const sinceLast = Date.now() - previous.at;
      if (sinceLast < MIN_SAVE_INTERVAL_MS) {
        // Throttled identical payload — no-op.
        saveStats.throttled += 1;
        // Surface a one-line console warning the FIRST time we throttle,
        // then once per 100 throttles, so it's obvious in DevTools if a
        // loop is happening without flooding the console.
        if (saveStats.throttled === 1 || saveStats.throttled % 100 === 0) {
          console.warn(
            `[saveJourney] throttled ${saveStats.throttled} identical saves (fired=${saveStats.fired}, attempted=${saveStats.attempted}). Something is calling saveJourney in a loop — open window.__numiSaveStats.`
          );
        }
        return;
      }
    }
    // Optimistically record this attempt so concurrent callers within the
    // same render burst dedupe immediately, BEFORE the network round-trip.
    // If the save fails we restore the previous entry below.
    lastSaveByJourneyId.set(journeyId, { hash, at: Date.now() });
    saveStats.fired += 1;

    // Track the promise globally so sign-out / idle-timeout / app-pause
    // handlers can await it before invalidating the JWT or wiping
    // localStorage. Without this, every logout-while-saving lost the write.
    const request = upsertJourney(journeyId, payload);
    trackJourneySave(request);
    const { data: updated, error } = await request;
    if (updated) {
      setJourney(updated);
      syncJourneyToLocalStorage(updated);
    } else {
      // Save failed — roll back the optimistic dedupe marker so the next
      // attempt isn't suppressed.
      if (previous) {
        lastSaveByJourneyId.set(journeyId, previous);
      } else {
        lastSaveByJourneyId.delete(journeyId);
      }
      saveStats.failed += 1;
      const detail = error?.message ? ` ${error.message}` : "";
      toast({
        title: "Save failed",
        description: `Could not save your journey data.${detail}`.trim(),
        variant: "destructive",
      });
      // Re-throw so callers that DO await (e.g. signOut) know the save
      // failed and can preserve localStorage as a recovery backup.
      throw new Error(error?.message || "saveJourney failed");
    }
  }, [user, journey?.id]);

  const saveTdee = useCallback(async (payload: Partial<TdeeRow>) => {
    if (!user) return;
    const updated = await upsertTdee(user.id, payload);
    if (updated) {
      setTdee(updated);
      syncTdeeToLocalStorage(updated);
    } else {
      toast({ title: "Save failed", description: "Could not save TDEE values. Please try again.", variant: "destructive" });
    }
  }, [user?.id]);

  const saveMacros = useCallback(async (macros: Record<string, number>) => {
    if (!user) return;
    const ok = await upsertCustomMacros(user.id, macros);
    if (ok) {
      setCustomMacros(macros);
      syncMacrosToLocalStorage(macros);
    } else {
      toast({ title: "Save failed", description: "Could not save macro settings. Please try again.", variant: "destructive" });
    }
  }, [user?.id]);

  function syncJourneyToLocalStorage(j: JourneyRow) {
    try {
      localStorage.setItem("dashboardWeeklyData", JSON.stringify(j.weekly_data || {}));
      localStorage.setItem("dashboardPreviousWeekData", JSON.stringify(j.previous_week_data || {}));
      localStorage.setItem("dashboardCompletedWeeks", JSON.stringify(j.completed_weeks || []));
      localStorage.setItem("dashboardAcclimationData", JSON.stringify(j.acclimation_data || { week1: {}, week2: {} }));
      localStorage.setItem("dashboardAcclimationSteps", String(j.acclimation_steps ?? 4000));
      localStorage.setItem("dashboardRecommendedSteps", String(j.recommended_steps ?? 4000));
      if (j.recommended_calories) localStorage.setItem("dashboardRecommendedCalories", String(j.recommended_calories));
      if (j.weight_loss_start_date) {
        const anchor = resolveJourneyAnchorFromRow(j);
        if (anchor) localStorage.setItem("dashboardWeightLossStartDate", anchor);
      }
      if (j.acclimation_phase_start_date) {
        localStorage.setItem("dashboardAcclimationPhaseStartDate", j.acclimation_phase_start_date);
      } else {
        localStorage.removeItem("dashboardAcclimationPhaseStartDate");
      }
      if (j.acclimation_phase_end_date) {
        localStorage.setItem("dashboardAcclimationPhaseEndDate", j.acclimation_phase_end_date);
      } else {
        localStorage.removeItem("dashboardAcclimationPhaseEndDate");
      }
      localStorage.setItem("dashboardCurrentStreak", String(j.current_streak ?? 0));
      localStorage.setItem("dashboardLongestStreak", String(j.longest_streak ?? 0));
      localStorage.setItem("dashboardWeek1Complete", String(j.week1_complete ?? false));
      localStorage.setItem("dashboardWeek2Complete", String(j.week2_complete ?? false));
      // Only overwrite when the server sent an explicit boolean (avoids wiping local completion before migration 008).
      if (typeof j.week3_complete === "boolean") {
        localStorage.setItem("dashboardWeek3Complete", String(j.week3_complete));
      }
      if (typeof j.week4_complete === "boolean") {
        localStorage.setItem("dashboardWeek4Complete", String(j.week4_complete));
      }
      if (j.starting_weight) localStorage.setItem("dashboardStartingWeight", j.starting_weight);
      localStorage.setItem("dashboardJourneyComplete", String(j.journey_complete ?? false));
      if (j.maintenance_phase) localStorage.setItem("dashboardMaintenancePhase", JSON.stringify(j.maintenance_phase));
      if (Array.isArray(j.archived_phases)) {
        localStorage.setItem("numiArchivedPhases", JSON.stringify(j.archived_phases));
      }
    } catch {}
  }

  function syncTdeeToLocalStorage(t: TdeeRow) {
    try {
      if (t.values_json) localStorage.setItem("tdeeCalculatedValues", JSON.stringify(t.values_json));
      if (t.starting_calorie_intake) localStorage.setItem("startingCalorieIntake", t.starting_calorie_intake);
      if (t.suggested_weight_goal) localStorage.setItem("suggestedWeightGoal", t.suggested_weight_goal);
    } catch {}
  }

  function syncMacrosToLocalStorage(m: Record<string, number>) {
    try {
      localStorage.setItem("customMacroGrams", JSON.stringify(m));
    } catch {}
  }

  const migrateFromLocalStorage = async () => {
    if (!user) return;
    // v9: "has progress in the cloud" means ANY of:
    //   • the user has completed at least one week,
    //   • OR any of the four Acclimation week-complete flags is true,
    //   • OR weekly_data contains actual daily entries (not just the empty
    //     defaults written by createJourney),
    //   • OR acclimation_data contains entries.
    // Previously this only checked weekly_data which meant a freshly created
    // journey with completed_weeks = [3 weeks] but empty weekly_data was
    // (incorrectly) treated as "no progress yet" and the migration pushed
    // empty local data over the top. Looking at all four signals makes the
    // check robust against any single field being reset between sessions.
    const hasAnyCompletedWeek = Array.isArray(journey?.completed_weeks) && journey!.completed_weeks.length > 0;
    const anyAcclimationFlag = !!(
      journey?.week1_complete ||
      journey?.week2_complete ||
      journey?.week3_complete ||
      journey?.week4_complete
    );
    const weeklyHasEntries = !!journey?.weekly_data && Object.values(journey.weekly_data || {}).some((d) => {
      const day = d as { steps?: number; calories?: number; weight?: number } | undefined;
      return !!day && ((day.steps ?? 0) > 0 || (day.calories ?? 0) > 0 || (day.weight ?? 0) > 0);
    });
    const acclimationHasEntries = !!journey?.acclimation_data && Object.values(journey.acclimation_data || {}).some((wk) => {
      if (!wk || typeof wk !== "object") return false;
      return Object.values(wk).some((v) => typeof v === "number" && v > 0);
    });
    const hasJourney = hasAnyCompletedWeek || anyAcclimationFlag || weeklyHasEntries || acclimationHasEntries;
    const hasTdee = !!tdee?.values_json && Object.keys(tdee.values_json || {}).length > 0;

    if (!hasJourney) {
      const weekly = localStorage.getItem("dashboardWeeklyData");
      const prev = localStorage.getItem("dashboardPreviousWeekData");
      const completed = localStorage.getItem("dashboardCompletedWeeks");
      const acclim = localStorage.getItem("dashboardAcclimationData");
      const acclimSteps = localStorage.getItem("dashboardAcclimationSteps");
      const recSteps = localStorage.getItem("dashboardRecommendedSteps");
      const recCals = localStorage.getItem("dashboardRecommendedCalories");
      const startDate = localStorage.getItem("dashboardWeightLossStartDate");
      const acclPhaseStart = localStorage.getItem("dashboardAcclimationPhaseStartDate");
      const acclPhaseEnd = localStorage.getItem("dashboardAcclimationPhaseEndDate");
      const streak = localStorage.getItem("dashboardCurrentStreak");
      const longest = localStorage.getItem("dashboardLongestStreak");
      const w1 = localStorage.getItem("dashboardWeek1Complete");
      const w2 = localStorage.getItem("dashboardWeek2Complete");
      const w3 = localStorage.getItem("dashboardWeek3Complete");
      const w4 = localStorage.getItem("dashboardWeek4Complete");
      const startWeight = localStorage.getItem("dashboardStartingWeight");
      const journeyComplete = localStorage.getItem("dashboardJourneyComplete");
      const maint = localStorage.getItem("dashboardMaintenancePhase");
      const archivedRaw = localStorage.getItem("numiArchivedPhases");

      if (weekly || prev || completed || acclim) {
        const j = journey || (await createJourney(user.id));
        if (j) {
          const payload: Partial<JourneyRow> = {};
          if (weekly) payload.weekly_data = JSON.parse(weekly) as JourneyRow["weekly_data"];
          if (prev) payload.previous_week_data = JSON.parse(prev) as JourneyRow["previous_week_data"];
          if (completed) payload.completed_weeks = JSON.parse(completed) as JourneyRow["completed_weeks"];
          if (acclim) payload.acclimation_data = JSON.parse(acclim) as JourneyRow["acclimation_data"];
          if (acclimSteps) payload.acclimation_steps = parseInt(acclimSteps, 10);
          if (recSteps) payload.recommended_steps = parseInt(recSteps, 10);
          if (recCals) payload.recommended_calories = parseInt(recCals, 10);
          if (startDate) {
            payload.weight_loss_start_date = startDate;
            payload.weight_loss_start_is_anchor = true;
          }
          if (acclPhaseStart) payload.acclimation_phase_start_date = acclPhaseStart;
          if (acclPhaseEnd) payload.acclimation_phase_end_date = acclPhaseEnd;
          if (streak) payload.current_streak = parseInt(streak, 10);
          if (longest) payload.longest_streak = parseInt(longest, 10);
          if (w1) payload.week1_complete = w1 === "true";
          if (w2) payload.week2_complete = w2 === "true";
          if (w3) payload.week3_complete = w3 === "true";
          if (w4) payload.week4_complete = w4 === "true";
          if (startWeight) payload.starting_weight = startWeight;
          if (journeyComplete) payload.journey_complete = journeyComplete === "true";
          if (maint) payload.maintenance_phase = JSON.parse(maint) as JourneyRow["maintenance_phase"];
          if (archivedRaw) {
            try {
              payload.archived_phases = JSON.parse(archivedRaw) as JourneyRow["archived_phases"];
            } catch {}
          }
          const { data: updated } = await upsertJourney(j.id, payload);
          if (updated) setJourney(updated);
        }
      }
    }

    if (!hasTdee) {
      const values = localStorage.getItem("tdeeCalculatedValues");
      const startCal = localStorage.getItem("startingCalorieIntake");
      const goal = localStorage.getItem("suggestedWeightGoal");
      const profileRaw = localStorage.getItem("userProfile");
      if (values || startCal || goal) {
        const valuesJson = values ? (JSON.parse(values) as Record<string, unknown>) : undefined;
        await upsertTdee(user.id, {
          values_json: valuesJson,
          starting_calorie_intake: startCal || undefined,
          suggested_weight_goal: goal || undefined,
          ...(profileRaw && (() => {
            try {
              const p = JSON.parse(profileRaw);
              return {
                height: p.height,
                current_weight: p.currentWeight,
                weight_to_lose: p.weightToLose,
              };
            } catch {
              return {};
            }
          })()),
        });
        await refreshTdee();
      }
    }

    if (!customMacros || Object.keys(customMacros).length === 0) {
      const saved = localStorage.getItem("customMacroGrams");
      if (saved) {
        const macros = JSON.parse(saved) as Record<string, number>;
        await upsertCustomMacros(user.id, macros);
        setCustomMacros(macros);
      }
    }

    if (profile) {
      const desc = localStorage.getItem("profileDescription");
      const myWhy = localStorage.getItem("myWhy");
      const goals = localStorage.getItem("myGoals");
      const dayGoals = localStorage.getItem("myDayGoals");
      const photo = localStorage.getItem("profilePhoto");
      if (desc || myWhy || goals || dayGoals || photo) {
        await upsertProfile(user.id, {
          profile_description: desc || profile.profile_description || undefined,
          my_why: myWhy || profile.my_why || undefined,
          my_goals: goals ? (JSON.parse(goals) as unknown[]) : profile.my_goals,
          my_day_goals: dayGoals ? (JSON.parse(dayGoals) as unknown[]) : profile.my_day_goals,
          profile_photo: photo || profile.profile_photo || undefined,
        });
        await refreshProfile();
      }
    }
  };

  useEffect(() => {
    if (!user) {
      setJourney(null);
      setTdee(null);
      setCustomMacros(null);
      setLoading(false);
      return;
    }
    loadData(user.id);
  }, [user?.id]);

  /** One-time: legacy rows stored WL Week 1 start in weight_loss_start_date; normalize to journey anchor. */
  useEffect(() => {
    if (!journey?.id || journey.weight_loss_start_is_anchor !== false || !journey.weight_loss_start_date) return;
    let cancelled = false;
    (async () => {
      const anchor = legacyWlWeek1StartToJourneyAnchor(journey.weight_loss_start_date!);
      const { data } = await upsertJourney(journey.id, {
        weight_loss_start_date: anchor,
        weight_loss_start_is_anchor: true,
      });
      if (!cancelled && data) setJourney(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [journey?.id, journey?.weight_loss_start_is_anchor, journey?.weight_loss_start_date]);

  const hasMigratedRef = React.useRef(false);
  useEffect(() => {
    if (loading || !user || hasMigratedRef.current) return;
    hasMigratedRef.current = true;
    migrateFromLocalStorage().then(() => {
      refreshJourney();
      refreshTdee();
      refreshMacros();
      refreshProfile();
    });
  }, [loading, user?.id]);

  useEffect(() => {
    if (journey) syncJourneyToLocalStorage(journey);
    if (tdee) syncTdeeToLocalStorage(tdee);
    if (journey || tdee) setLastSyncedAt(Date.now());
  }, [journey, tdee]);

  return (
    <UserDataContext.Provider
      value={{
        journey,
        tdee,
        customMacros,
        loading,
        lastSyncedAt,
        refreshJourney,
        refreshTdee,
        refreshMacros,
        saveJourney,
        saveTdee,
        saveMacros,
        migrateFromLocalStorage,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (ctx === undefined) throw new Error("useUserData must be used within UserDataProvider");
  return ctx;
}
