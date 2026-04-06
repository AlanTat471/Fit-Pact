import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

import { upsertProfile, profileToUserProfile } from "@/lib/supabaseProfile";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  height: string;
  current_weight: string;
  activity_level: string;
  email: string;
  mobile?: string;
  unit_system: string;
  profile_description?: string;
  my_why?: string;
  my_goals?: unknown[];
  my_day_goals?: unknown[];
  profile_photo?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_GRACE_MS = 10000; // Ignore spurious null for 10s (token refresh race)
const REVALIDATE_DEBOUNCE_MS = 500; // Debounce re-validation to avoid rapid redirects

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionReceivedAtRef = useRef<number>(0);
  const revalidateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSigningOutRef = useRef(false);

  const fetchProfile = async (userId: string, userMeta?: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      let p = data as Profile;
      // Repair profile if names are empty/placeholder but we have metadata (e.g. OTP sign-in vs registration)
      const needsNameRepair = (!p.first_name || p.first_name === "User" || !p.last_name) && userMeta && (userMeta.firstName || userMeta.first_name);
      const needsTdeeRepair = (!p.height || !p.current_weight || !p.activity_level) && userMeta && (userMeta.height || userMeta.currentWeight);
      if (needsNameRepair || needsTdeeRepair) {
        const repair: Partial<Profile> = {};
        if (needsNameRepair) {
          repair.first_name = (userMeta!.firstName as string) || (userMeta!.first_name as string) || p.first_name || "User";
          repair.last_name = (userMeta!.lastName as string) || (userMeta!.last_name as string) || p.last_name || "";
        }
        if (needsTdeeRepair) {
          if (userMeta!.height) repair.height = userMeta!.height as string;
          if (userMeta!.currentWeight || userMeta!.current_weight) repair.current_weight = (userMeta!.currentWeight as string) || (userMeta!.current_weight as string);
          if (userMeta!.activityLevel || userMeta!.activity_level) repair.activity_level = (userMeta!.activityLevel as string) || (userMeta!.activity_level as string);
          if (userMeta!.age != null) repair.age = (userMeta!.age as number) ?? p.age;
          if (userMeta!.gender) repair.gender = userMeta!.gender as string;
        }
        const { data: repaired } = await upsertProfile(userId, repair);
        if (repaired) p = repaired as Profile;
      }
      setProfile(p);
      // Sync to localStorage for pages that still read userProfile (until full migration)
      try {
        const u = profileToUserProfile(p as import("@/lib/supabaseProfile").ProfileRow);
        if (u) localStorage.setItem("userProfile", JSON.stringify(u));
      } catch {}
      return;
    }

    // If no profile but we have metadata from signup, create profile
    if (userMeta && (userMeta.firstName || userMeta.first_name)) {
      const { data: created } = await upsertProfile(userId, {
        first_name: (userMeta.firstName as string) || (userMeta.first_name as string),
        last_name: (userMeta.lastName as string) || (userMeta.last_name as string),
        age: (userMeta.age as number) ?? 30,
        gender: (userMeta.gender as string) || "male",
        height: (userMeta.height as string) || "175",
        current_weight: (userMeta.currentWeight as string) || (userMeta.current_weight as string) || "70",
        activity_level: (userMeta.activityLevel as string) || (userMeta.activity_level as string) || "moderately-active",
        email: (userMeta.email as string) || "",
        mobile: (userMeta.mobile as string) || null,
        unit_system: (userMeta.unitSystem as string) || (userMeta.unit_system as string) || "metric",
      });
      if (created) {
        setProfile(created as Profile);
        try {
          const u = profileToUserProfile(created as import("@/lib/supabaseProfile").ProfileRow);
          if (u) localStorage.setItem("userProfile", JSON.stringify(u));
        } catch {}
      }
    } else {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.user_metadata as Record<string, unknown>);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) sessionReceivedAtRef.current = Date.now();
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id, s.user.user_metadata as Record<string, unknown>).finally(() => setLoading(false));
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      // If we're intentionally signing out, don't re-validate or restore session
      if (isSigningOutRef.current) {
        if (!s) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }

      if (s) {
        sessionReceivedAtRef.current = Date.now();
        setSession(s);
        setUser(s.user ?? null);
        fetchProfile(s.user.id, s.user.user_metadata as Record<string, unknown>);
      } else {
        // Re-validate before clearing: Supabase can emit spurious null during token refresh
        const { data: { session: revalidated } } = await supabase.auth.getSession();
        if (revalidated) {
          sessionReceivedAtRef.current = Date.now();
          setSession(revalidated);
          setUser(revalidated.user ?? null);
          fetchProfile(revalidated.user.id, revalidated.user.user_metadata as Record<string, unknown>);
          return;
        }
        const elapsed = Date.now() - sessionReceivedAtRef.current;
        if (elapsed < SESSION_GRACE_MS && sessionReceivedAtRef.current > 0) {
          return; // Ignore null - likely token refresh in progress
        }
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (revalidateTimeoutRef.current) clearTimeout(revalidateTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (user && !profile) fetchProfile(user.id, user.user_metadata as Record<string, unknown>);
  }, [user]);

  const signOut = async () => {
    isSigningOutRef.current = true;
    // Prevent Index.tsx from auto-navigating during an explicit logout
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("authFlowPending");
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } finally {
      isSigningOutRef.current = false;
    }
    // Clear user-specific journey/dashboard DATA only — not profile mirrors or archived phases (fitpactArchivedPhases).
    // Profile fields live in Supabase; clearing them here made Profile look empty on
    // next login until fetch completed. userProfile is overwritten on next fetchProfile.
    const keys = [
      "dashboardWeeklyData", "dashboardPreviousWeekData", "dashboardCompletedWeeks",
      "dashboardAcclimationData", "dashboardAcclimationSteps", "dashboardRecommendedSteps",
      "dashboardRecommendedCalories", "dashboardWeightLossStartDate", "dashboardCurrentStreak",
      "dashboardLongestStreak", "dashboardWeek1Complete", "dashboardWeek2Complete",
      "dashboardWeek3Complete", "dashboardWeek4Complete",
      "dashboardAcclimationPhaseStartDate", "dashboardAcclimationPhaseEndDate",
      "dashboardStartingWeight", "dashboardJourneyComplete", "dashboardMaintenancePhase",
      "tdeeCalculatedValues", "startingCalorieIntake", "suggestedWeightGoal", "customMacroGrams",
      "activePlan", "paymentMethods", "billingAddress",
      "showReadyToStartPopup", "stepDebugInfo",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
