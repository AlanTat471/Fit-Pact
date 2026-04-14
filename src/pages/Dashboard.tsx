import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import { BackButton } from "@/components/BackButton";
import { useNavigate } from "react-router-dom";
import { useUserData } from "@/contexts/UserDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProfile } from "@/lib/supabaseProfile";
import { getUserPref, setUserPref } from "@/lib/supabaseUserPrefs";
import * as XLSX from "xlsx";
import { buildTdeeSnapshotFromMetrics } from "@/lib/tdeeSnapshot";
import {
  formatLocalIsoDate,
  addDaysIso,
  weightLossPhaseStartFromJourneyAnchor,
  lastDayOfWeek12Iso,
  deriveMaintenanceWindowFromJourneyAnchor,
  resolveJourneyAnchorFromRow,
} from "@/lib/journeyAnchor";

/** One completed user cycle (acclimation + 12-week WL + maintenance) for Archived Phases */
type ArchivedPhaseBundle = {
  id: string;
  archivedAt: string;
  /** 1-based: Phase 1, Phase 2, … */
  phaseNumber?: number;
  weightLossStartDate: string | null;
  /** First calendar day of Acclimation Phase (same intent as acclimationPhaseStartDateIso) */
  phaseStartDateIso?: string | null;
  /** Last day of maintenance (from maintenance phase end date) */
  phaseEndDateIso?: string | null;
  /** Explicit acclimation bounds (preferred over legacy WL-based inference) */
  acclimationPhaseStartDateIso?: string | null;
  acclimationPhaseEndDateIso?: string | null;
  /** Sum of inclusive day counts: Acclimation + Weight loss + Maintenance */
  phaseSumDays?: number;
  /** Inclusive days from Weight Loss start date → maintenance phase end (your WL-through-maintenance span) */
  wlStartToMaintenanceEndDays?: number;
  /** Inclusive days from first acclimation day → last maintenance day (full calendar span, includes gaps between phases) */
  totalCalendarSpanDays?: number;
  /** Pooled acclimation average at archive time */
  acclimationAverageKg?: number;
  /** Mean of weekly averages at end of maintenance */
  weightAtEndMaintenanceKg?: number;
  /** acclimationAverageKg − weightAtEndMaintenanceKg (positive = net loss vs acclimation baseline) */
  totalWeightLossPhaseKg?: number;
  acclimationData: Record<string, unknown>;
  completedWeeks: unknown[];
  maintenancePhase: Record<string, unknown>;
  week12Stats: { startWeight: number; endWeight: number; totalLoss: number } | null;
  maintenanceEndingAverageKg?: number;
  /** Journey anchor (first day of Acclimation); when set, weightLossStartDate in bundle matches it */
  journeyAnchorDateIso?: string | null;
};

/** Inclusive calendar days between two YYYY-MM-DD local dates */
function inclusiveDaysBetween(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const [ys, ms, ds] = startIso.split("-").map((x) => parseInt(x, 10));
  const [ye, me, de] = endIso.split("-").map((x) => parseInt(x, 10));
  const s = new Date(ys, ms - 1, ds);
  const e = new Date(ye, me - 1, de);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return diff + 1;
}

/** Legacy fallback: day before Weight Loss start (old fixed 28-day acclimation model) */
function inferLegacyAcclimationEndFromWl(wlStart: string | null | undefined): string | null {
  if (!wlStart) return null;
  const [y, m, d] = wlStart.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return formatLocalIsoDate(dt);
}

/** Legacy fallback when archived bundle has no stored acclimation dates */
function inferPhaseStartFromWl(wlStart: string | null | undefined): string | null {
  if (!wlStart) return null;
  const [y, m, d] = wlStart.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 28);
  return formatLocalIsoDate(dt);
}

function computeArchivedPhaseDisplayMetrics(b: ArchivedPhaseBundle) {
  const anchor =
    b.journeyAnchorDateIso ??
    b.acclimationPhaseStartDateIso ??
    b.phaseStartDateIso ??
    null;
  const legacyWlStart = b.weightLossStartDate;
  /** Prefer explicit anchor fields; otherwise legacy bundles store WL Week 1 start in weightLossStartDate. */
  const anchorIso =
    b.journeyAnchorDateIso ?? b.phaseStartDateIso ?? b.acclimationPhaseStartDateIso ?? null;
  const wlPhaseStart =
    anchorIso != null
      ? weightLossPhaseStartFromJourneyAnchor(anchorIso)
      : legacyWlStart || null;
  const acclStart =
    anchor ??
    b.acclimationPhaseStartDateIso ??
    b.phaseStartDateIso ??
    (legacyWlStart ? inferPhaseStartFromWl(legacyWlStart) : null);
  const acclEnd =
    b.acclimationPhaseEndDateIso ??
    (anchor ? addDaysIso(anchor, 27) : inferLegacyAcclimationEndFromWl(legacyWlStart));
  const wlEnd = wlPhaseStart ? lastDayOfWeek12Iso(wlPhaseStart) : null;
  const m = b.maintenancePhase as { startDate?: string; endDate?: string };
  const phaseEnd = b.phaseEndDateIso ?? m?.endDate ?? null;
  let maintStart = m?.startDate;
  let maintEnd = m?.endDate ?? phaseEnd;
  if (!maintStart && maintEnd) {
    const [y, mo, dd] = maintEnd.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(y, mo - 1, dd);
    dt.setDate(dt.getDate() - 27);
    maintStart = formatLocalIsoDate(dt);
  }
  // Archived bundles often omitted maintenance dates when user enabled maintenance from the dialog only — derive from WL end.
  if (!maintStart && !maintEnd && wlEnd) {
    maintStart = addDaysIso(wlEnd, 1);
    maintEnd = addDaysIso(maintStart, 27);
  }

  const acclDays = acclStart && acclEnd ? inclusiveDaysBetween(acclStart, acclEnd) : null;
  const wlDays = wlPhaseStart && wlEnd ? inclusiveDaysBetween(wlPhaseStart, wlEnd) : null;
  const maintDays = maintStart && maintEnd ? inclusiveDaysBetween(maintStart, maintEnd) : null;

  const phaseSumDays =
    b.phaseSumDays ??
    (acclDays != null && wlDays != null && maintDays != null ? acclDays + wlDays + maintDays : null);

  const effectiveEnd = maintEnd ?? phaseEnd;

  const wlStartToMaintenanceEndDays =
    b.wlStartToMaintenanceEndDays ??
    (wlPhaseStart && effectiveEnd ? inclusiveDaysBetween(wlPhaseStart, effectiveEnd) : null);

  const totalCalendarSpanDays =
    b.totalCalendarSpanDays ?? (acclStart && effectiveEnd ? inclusiveDaysBetween(acclStart, effectiveEnd) : null);

  return {
    phaseSumDays,
    wlStartToMaintenanceEndDays,
    totalCalendarSpanDays,
    acclimationStartIso: acclStart,
    acclimationEndIso: acclEnd,
    phaseEndIso: phaseEnd,
    maintenanceStartIso: maintStart,
    maintenanceEndIso: maintEnd,
  };
}

const motivationalQuotes = [
  { quote: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { quote: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "Small steps every day lead to big results.", author: "Unknown" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

const getDailyQuote = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  return motivationalQuotes[dayOfYear % motivationalQuotes.length];
};

const WEEKDAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type ArchivedWlWeekRow = {
  weekNumber: number;
  data: Record<string, { steps: number; calories: number; weight: number }>;
  averages: { steps: number; calories: number; weight: number };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { saveJourney, saveTdee, journey, tdee, lastSyncedAt, refreshJourney } = useUserData();
  const { user, profile, refreshProfile } = useAuth();
  const dailyQuote = getDailyQuote();
  /** Set true when Week 12 summary is scheduled this session — blocks duplicate maintenance prompt from reload-recovery effect. */
  const week12SummaryScheduledRef = useRef(false);
  // Steps recommendation rules
  const ACCLIMATION_BASE_STEPS = 4000;
  const STEPS_INCREMENT = 1000;
  const MAX_RECOMMENDED_STEPS = 10000;
  // Weight change is negative when losing weight.
  // If loss is LESS than 0.5% (i.e. percentChange > -0.5), increase steps next week.
  // If loss is 0.5% or more (i.e. percentChange <= -0.5), keep steps the same.
  const STEP_INCREASE_THRESHOLD_PERCENT = -0.5;
  // Backend/data validation only – hide Steps and Calories Debug from users
  const SHOW_STEPS_CALORIES_DEBUG = false;
  // State for TDEE calculated values synced from calculator
  const [tdeeValues, setTdeeValues] = useState<{
    currentBMI: string;
    bodyFatPercentage: string;
    classification: string;
    currentWeight: string;
    weightToLose: string;
    height: string;
  } | null>(null);

  // State for weight loss start date and end date
  /** Journey anchor: Day 1 of Acclimation (4 weeks); Weight Loss Week 1 begins 28 days later. Stored as weight_loss_start_date. */
  const [weightLossStartDate, setWeightLossStartDate] = useState<string>("");
  const [weightLossEndDate, setWeightLossEndDate] = useState<string>("");
  const computedWlPhaseStartIso = useMemo(
    () => (weightLossStartDate ? weightLossPhaseStartFromJourneyAnchor(weightLossStartDate) : ""),
    [weightLossStartDate]
  );

  // State for daily tracking
  const [dailyData, setDailyData] = useState({
    steps: 4500,
    calories: 2000,
    weight: 70.5,
    height: 175 // height in cm
  });

  // State for weekly data  
  const [weeklyData, setWeeklyData] = useState({
    Monday: { steps: 0, calories: 0, weight: 0 },
    Tuesday: { steps: 0, calories: 0, weight: 0 },
    Wednesday: { steps: 0, calories: 0, weight: 0 },
    Thursday: { steps: 0, calories: 0, weight: 0 },
    Friday: { steps: 0, calories: 0, weight: 0 },
    Saturday: { steps: 0, calories: 0, weight: 0 },
    Sunday: { steps: 0, calories: 0, weight: 0 }
  });

  // State for previous week data (for comparison)
  const [previousWeekData, setPreviousWeekData] = useState({
    Monday: { steps: 0, calories: 0, weight: 0 },
    Tuesday: { steps: 0, calories: 0, weight: 0 },
    Wednesday: { steps: 0, calories: 0, weight: 0 },
    Thursday: { steps: 0, calories: 0, weight: 0 },
    Friday: { steps: 0, calories: 0, weight: 0 },
    Saturday: { steps: 0, calories: 0, weight: 0 },
    Sunday: { steps: 0, calories: 0, weight: 0 }
  });

  // State for completed weeks history
  const [completedWeeks, setCompletedWeeks] = useState<Array<{
    weekNumber: number;
    data: typeof weeklyData;
    averages: {
      steps: number;
      calories: number;
      weight: number;
    };
    stepDebug?: {
      prevAvg: number;
      currAvg: number;
      percentChange: number;
      didIncrease: boolean;
      prevTarget: number;
      newTarget: number;
      caloriesReduced?: boolean;
      prevCalories?: number;
      newCalories?: number;
      hitMinFloor?: boolean;
    };
  }>>([]);

  // State for alert dialogs
  const [showIncompleteWeekDialog, setShowIncompleteWeekDialog] = useState(false);
  const [showSingleDigitWeightDialog, setShowSingleDigitWeightDialog] = useState(false);
  const [showWeightAnomalyDialog, setShowWeightAnomalyDialog] = useState(false);
  const [showMissingWeightDialog, setShowMissingWeightDialog] = useState(false);
  const [missingWeightDays, setMissingWeightDays] = useState<string[]>([]);
  const [anomalyWeightDay, setAnomalyWeightDay] = useState<{ day: string; direction: 'greater' | 'lower'; diff: number }>({ day: '', direction: 'greater', diff: 0 });
  const [singleDigitWeightDays, setSingleDigitWeightDays] = useState<string[]>([]);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [showAcclimationDialog, setShowAcclimationDialog] = useState(false);
  const [showAcclimationCompleteDialog, setShowAcclimationCompleteDialog] = useState(false);
  const [showReadyToStartDialog, setShowReadyToStartDialog] = useState(false);
  const [userName, setUserName] = useState("");

  // State for acclimation weeks
  const [acclimationData, setAcclimationData] = useState({
    week1: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    },
    week2: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    },
    week3: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    },
    week4: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    }
  });

  // State for acclimation week completion
  const [isWeek1Complete, setIsWeek1Complete] = useState(false);
  const [isWeek2Complete, setIsWeek2Complete] = useState(false);
  const [isWeek3Complete, setIsWeek3Complete] = useState(false);
  const [isWeek4Complete, setIsWeek4Complete] = useState(false);
  
  // State for editing completed weeks
  const [editingWeek, setEditingWeek] = useState<{
    weekNumber: number;
    data: typeof weeklyData;
  } | null>(null);
  
  // State for editing acclimation weeks
  const [editingAcclimationWeek, setEditingAcclimationWeek] = useState<{
    weekNumber: 1 | 2 | 3 | 4;
    data: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
  } | null>(null);
  
  // State for starting weight
  const [startingWeight, setStartingWeight] = useState<string>("");
  
  // State for suggested weight goal
  const [suggestedWeightGoal, setSuggestedWeightGoal] = useState<string>("");

  // State for acclimation settings
  const [acclimationCalories, setAcclimationCalories] = useState(0);
  const [acclimationSteps, setAcclimationSteps] = useState(ACCLIMATION_BASE_STEPS);
  
  // State for recommended steps (calculated based on weight loss rate)
  const [recommendedSteps, setRecommendedSteps] = useState(() => {
    const stored = localStorage.getItem('dashboardRecommendedSteps');
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : ACCLIMATION_BASE_STEPS;
  });

  // State for recommended calories (may reduce when steps are maxed and loss is insufficient)
  const [recommendedCalories, setRecommendedCalories] = useState(() => {
    const stored = localStorage.getItem('dashboardRecommendedCalories');
    return stored ? parseInt(stored, 10) : 0; // 0 means "use acclimationCalories"
  });

  // State for minimum calorie limit reached popup
  const [showMinCalorieDialog, setShowMinCalorieDialog] = useState(false);

  // State for Week 12 completion stats (dialog state moved to new flow)
  const [week12Stats, setWeek12Stats] = useState<{ startWeight: number; endWeight: number; totalLoss: number }>({ startWeight: 0, endWeight: 0, totalLoss: 0 });
  // State for journey complete (blocks data entry after 12 weeks)
  const [journeyComplete, setJourneyComplete] = useState(() => {
    return localStorage.getItem('dashboardJourneyComplete') === 'true';
  });
  const [showJourneyCompleteBlockDialog, setShowJourneyCompleteBlockDialog] = useState(false);
  // Get user gender from profile
  const [userGender, setUserGender] = useState<string>('male');

  // Maintenance Phase state
  const [maintenancePhase, setMaintenancePhase] = useState<{
    active: boolean;
    startDate: string;
    /** Last day of the 4-week maintenance window (start + 27 days = 4×7 inclusive) */
    endDate: string;
    /** Weight at end of Week 12 — fixed for maintenance TDEE/stats; not overwritten by weekly logs */
    baselineWeightKg: number;
    currentWeight: number;
    maintenanceCalories: number;
    completedWeeks: Array<{
      weekNumber: number;
      data: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
    }>;
    week1Complete: boolean;
    week2Complete: boolean;
    week3Complete: boolean;
    week4Complete: boolean;
    weekData: {
      week1: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
      week2: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
      week3: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
      week4: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
    };
  }>(() => {
    const stored = localStorage.getItem('dashboardMaintenancePhase');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
    return {
      active: false,
      startDate: '',
      endDate: '',
      baselineWeightKg: 0,
      currentWeight: 0,
      maintenanceCalories: 0,
      completedWeeks: [],
      week1Complete: false,
      week2Complete: false,
      week3Complete: false,
      week4Complete: false,
      weekData: {
        week1: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
        week2: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
        week3: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
        week4: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
      },
    };
  });

  // Maintenance Phase dialog states
  const [showWeek12SummaryDialog, setShowWeek12SummaryDialog] = useState(false);
  const [showStillLoseWeightDialog, setShowStillLoseWeightDialog] = useState(false);
  const [showMaintenanceSuggestionDialog, setShowMaintenanceSuggestionDialog] = useState(false);
  const [showThankYouDialog, setShowThankYouDialog] = useState(false);
  const [showFinalRedirectDialog, setShowFinalRedirectDialog] = useState(false);
  const [showMaintenanceCompleteDialog, setShowMaintenanceCompleteDialog] = useState(false);
  const [showClearAllStep1, setShowClearAllStep1] = useState(false);
  const [showClearAllStep2, setShowClearAllStep2] = useState(false);

  // Low calorie headroom safety warning – shown when acclimation calories are within 200 of the minimum floor
  const [showLowCalorieHeadroomDialog, setShowLowCalorieHeadroomDialog] = useState(false);

  // Steps/Calories change popup – shown when week completion changes targets (Steps up 1,000 and/or Calories down 200)
  const [showStepsCaloriesChangePopup, setShowStepsCaloriesChangePopup] = useState(false);
  const [stepsCaloriesChangeInfo, setStepsCaloriesChangeInfo] = useState<{
    stepsIncreased: boolean;
    stepsNewTarget: number;
    caloriesDecreased: boolean;
    caloriesNewTarget: number;
    hitMinFloor?: boolean;
  } | null>(null);

  const [showWelcomeBackDialog, setShowWelcomeBackDialog] = useState(false);
  const [calorieReminder, setCalorieReminder] = useState<"high" | "low" | null>(null);

  // State for streak tracking
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  
  // State for collapse/expand all completed weeks
  const [allWeeksExpanded, setAllWeeksExpanded] = useState(false);
  
  // State for collapsible sections
  const [acclimationCollapsed, setAcclimationCollapsed] = useState(false);
  const [weightLossCollapsed, setWeightLossCollapsed] = useState(false);
  const [weightLossMainCollapsed, setWeightLossMainCollapsed] = useState(false);
  const [maintenanceCollapsed, setMaintenanceCollapsed] = useState(false);

  const [archivedPhases, setArchivedPhases] = useState<ArchivedPhaseBundle[]>(() => {
    try {
      const raw = localStorage.getItem("fitpactArchivedPhases");
      if (raw) return JSON.parse(raw) as ArchivedPhaseBundle[];
    } catch {}
    return [];
  });

  const earliestAllowedStartDate = useMemo(() => {
    if (archivedPhases.length === 0) return "";
    const lastArchived = archivedPhases[archivedPhases.length - 1];
    const metrics = computeArchivedPhaseDisplayMetrics(lastArchived);
    const lastEnd = metrics.maintenanceEndIso ?? metrics.phaseEndIso ?? null;
    if (!lastEnd) return "";
    return addDaysIso(lastEnd, 1);
  }, [archivedPhases]);
  
  // State for editing maintenance weeks
  const [editingMaintenanceWeek, setEditingMaintenanceWeek] = useState<{
    weekNumber: 1 | 2 | 3 | 4;
    data: { Monday: number; Tuesday: number; Wednesday: number; Thursday: number; Friday: number; Saturday: number; Sunday: number };
  } | null>(null);
  
  // State for debug info (step & calorie recommendation)
  const [stepDebugInfo, setStepDebugInfo] = useState<{
    prevAvg: number;
    currAvg: number;
    percentChange: number;
    didIncrease: boolean;
    caloriesReduced: boolean;
    prevCalories: number;
    newCalories: number;
    hitMinFloor: boolean;
  } | null>(() => {
    const stored = localStorage.getItem('stepDebugInfo');
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });
  
  // NOTE: Step recommendations are intentionally NOT recalculated when completed weeks are edited.
  // They only advance when a week is completed (see completeWeek()).

  // Load TDEE calculated values: prefer tdee from Supabase, fallback to localStorage
  useEffect(() => {
    const loadTdeeValues = () => {
      const values = tdee?.values_json || (() => {
        try {
          const s = localStorage.getItem('tdeeCalculatedValues');
          return s ? JSON.parse(s) : null;
        } catch { return null; }
      })();
      if (values) {
        setTdeeValues(values);
        if (values.currentWeight && !startingWeight) setStartingWeight(values.currentWeight);
      }
    };
    loadTdeeValues();
  }, [tdee?.values_json, lastSyncedAt]);

  // Load acclimation calories: prefer tdee from Supabase, fallback to localStorage
  useEffect(() => {
    const cal = tdee?.starting_calorie_intake || localStorage.getItem('startingCalorieIntake');
    if (cal) setAcclimationCalories(parseFloat(cal));
  }, [tdee?.starting_calorie_intake]);

  // Load all data: prefer journey from Supabase (context), fallback to localStorage
  useEffect(() => {
    const loadData = () => {
      // Prefer journey from Supabase (source of truth)
      if (journey) {
        if (journey.weekly_data && Object.keys(journey.weekly_data).length > 0) {
          setWeeklyData(journey.weekly_data as typeof weeklyData);
        }
        if (journey.previous_week_data && Object.keys(journey.previous_week_data).length > 0) {
          setPreviousWeekData(journey.previous_week_data as typeof previousWeekData);
        }
        if (journey.completed_weeks?.length) {
          setCompletedWeeks(journey.completed_weeks as typeof completedWeeks);
        }
        if (journey.acclimation_data) {
          const a = journey.acclimation_data as typeof acclimationData;
          setAcclimationData({
            week1: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0, ...a?.week1 },
            week2: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0, ...a?.week2 },
            week3: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0, ...a?.week3 },
            week4: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0, ...a?.week4 },
          });
        }
        setAcclimationSteps(journey.acclimation_steps ?? ACCLIMATION_BASE_STEPS);
        if (journey.recommended_steps > 0) setRecommendedSteps(journey.recommended_steps);
        if (journey.recommended_calories) setRecommendedCalories(journey.recommended_calories);
        {
          const anchor = resolveJourneyAnchorFromRow(journey);
          if (anchor) setWeightLossStartDate(anchor);
        }
        setCurrentStreak(journey.current_streak ?? 0);
        setLongestStreak(journey.longest_streak ?? 0);
        setIsWeek1Complete(journey.week1_complete ?? false);
        setIsWeek2Complete(journey.week2_complete ?? false);
        setIsWeek3Complete(
          typeof journey.week3_complete === "boolean"
            ? journey.week3_complete
            : localStorage.getItem("dashboardWeek3Complete") === "true"
        );
        setIsWeek4Complete(
          typeof journey.week4_complete === "boolean"
            ? journey.week4_complete
            : localStorage.getItem("dashboardWeek4Complete") === "true"
        );
        if (journey.starting_weight) setStartingWeight(journey.starting_weight);
        setJourneyComplete(journey.journey_complete ?? false);
        if (Array.isArray(journey.archived_phases)) {
          setArchivedPhases(journey.archived_phases as ArchivedPhaseBundle[]);
        }
        if (journey.maintenance_phase && typeof journey.maintenance_phase === 'object') {
          const m = journey.maintenance_phase as Record<string, unknown>;
          const defaultWeekData = {
            week1: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
            week2: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
            week3: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
            week4: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
          };
          const weekData = (m?.weekData && typeof m.weekData === 'object')
            ? { ...defaultWeekData, ...m.weekData }
            : defaultWeekData;
          const cw = Number(m?.currentWeight) || 0;
          const baseline = Number(m?.baselineWeightKg ?? m?.currentWeight) || cw;
          let startDate = (m?.startDate as string) || "";
          let endDate = (m?.endDate as string) || "";
          {
            const anchor = resolveJourneyAnchorFromRow(journey);
            if (m?.active && anchor && (!startDate || !endDate)) {
              const derived = deriveMaintenanceWindowFromJourneyAnchor(anchor);
              if (!startDate) startDate = derived.startDate;
              if (!endDate) endDate = derived.endDate;
            }
          }
          setMaintenancePhase({
            active: !!m?.active,
            startDate,
            endDate,
            baselineWeightKg: baseline,
            currentWeight: cw,
            maintenanceCalories: Number(m?.maintenanceCalories) || 0,
            completedWeeks: (Array.isArray(m?.completedWeeks) ? m.completedWeeks : []) as typeof maintenancePhase.completedWeeks,
            week1Complete: !!m?.week1Complete,
            week2Complete: !!m?.week2Complete,
            week3Complete: !!m?.week3Complete,
            week4Complete: !!m?.week4Complete,
            weekData,
          });
        }
        return;
      }

      // Fallback: localStorage (legacy / migration)
      const storedWeeklyData = localStorage.getItem('dashboardWeeklyData');
      const storedPreviousWeekData = localStorage.getItem('dashboardPreviousWeekData');
      const storedCompletedWeeks = localStorage.getItem('dashboardCompletedWeeks');
      const storedAcclimationData = localStorage.getItem('dashboardAcclimationData');
      const storedAcclimationSteps = localStorage.getItem('dashboardAcclimationSteps');
      const storedRecommendedSteps = localStorage.getItem('dashboardRecommendedSteps');
      const storedWeightLossStartDate = localStorage.getItem('dashboardWeightLossStartDate');
      const storedCurrentStreak = localStorage.getItem('dashboardCurrentStreak');
      const storedLongestStreak = localStorage.getItem('dashboardLongestStreak');
      const storedWeek1Complete = localStorage.getItem('dashboardWeek1Complete');
      const storedWeek2Complete = localStorage.getItem('dashboardWeek2Complete');
      const storedWeek3Complete = localStorage.getItem('dashboardWeek3Complete');
      const storedWeek4Complete = localStorage.getItem('dashboardWeek4Complete');
      const storedStartingWeight = localStorage.getItem('dashboardStartingWeight');

      if (storedWeeklyData) {
        try {
          setWeeklyData(JSON.parse(storedWeeklyData));
        } catch (e) {
          console.error('Error parsing weekly data:', e);
        }
      }

      if (storedPreviousWeekData) {
        try {
          setPreviousWeekData(JSON.parse(storedPreviousWeekData));
        } catch (e) {
          console.error('Error parsing previous week data:', e);
        }
      }

      if (storedCompletedWeeks) {
        try {
          setCompletedWeeks(JSON.parse(storedCompletedWeeks));
        } catch (e) {
          console.error('Error parsing completed weeks:', e);
        }
      }

      if (storedAcclimationData) {
        try {
          setAcclimationData(JSON.parse(storedAcclimationData));
        } catch (e) {
          console.error('Error parsing acclimation data:', e);
        }
      }

      // Acclimation Week recommended steps are always the fixed baseline (4,000) and are not user-editable.
      // We also enforce this in storage for consistency.
      if (storedAcclimationSteps !== ACCLIMATION_BASE_STEPS.toString()) {
        localStorage.setItem('dashboardAcclimationSteps', ACCLIMATION_BASE_STEPS.toString());
      }
      setAcclimationSteps(ACCLIMATION_BASE_STEPS);

      // recommendedSteps will be recalculated by the completedWeeks useEffect
      // No need to load from localStorage - the recalculation is the source of truth

      // recommendedCalories will be recalculated by the completedWeeks useEffect
      // No need to load from localStorage - the recalculation is the source of truth

      if (storedWeightLossStartDate) {
        setWeightLossStartDate(storedWeightLossStartDate);
      }


      if (storedCurrentStreak) {
        setCurrentStreak(parseInt(storedCurrentStreak));
      }

      if (storedLongestStreak) {
        setLongestStreak(parseInt(storedLongestStreak));
      }

      if (storedWeek1Complete) {
        setIsWeek1Complete(storedWeek1Complete === 'true');
      }

      if (storedWeek2Complete) {
        setIsWeek2Complete(storedWeek2Complete === 'true');
      }
      if (storedWeek3Complete) {
        setIsWeek3Complete(storedWeek3Complete === 'true');
      }
      if (storedWeek4Complete) {
        setIsWeek4Complete(storedWeek4Complete === 'true');
      }

      if (storedStartingWeight) {
        setStartingWeight(storedStartingWeight);
      }

    };

    loadData();
    
    // Load user name and gender from profile - prefer AuthContext profile, then localStorage
    const loadUserProfile = () => {
      if (profile) {
        setUserName((profile.first_name || "").trim() || "User");
        setUserGender(profile.gender || 'male');
        return;
      }
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        try {
          const profileData = JSON.parse(stored);
          setUserName(profileData.firstName || 'User');
          setUserGender(profileData.gender || 'male');
        } catch (e) {
          setUserName('User');
        }
      }
    };
    loadUserProfile();
    
  }, [lastSyncedAt, profile, journey, user?.id]);

  // Popup sequence (separate effect, runs exactly once per mount via ref guard)
  const popupCheckedRef = useRef(false);
  useEffect(() => {
    if (popupCheckedRef.current) return;
    const uid = user?.id;
    if (!uid) return; // wait until user is available
    popupCheckedRef.current = true;

    const checkPopupFlags = async () => {
      const [seenWelcomePref, seenAcclimationPref, seenReadyPref] = await Promise.all([
        getUserPref(uid, "dashboardWelcomeShown"),
        getUserPref(uid, "dashboardAcclimationShown"),
        getUserPref(uid, "readyToStartShown"),
      ]);

      const hasSeenWelcome = seenWelcomePref === "true" || localStorage.getItem('dashboardWelcomeShown') === 'true';
      const hasSeenAcclimation = seenAcclimationPref === "true" || localStorage.getItem('dashboardAcclimationShown') === 'true';
      const hasSeenReady = seenReadyPref === "true" || localStorage.getItem('readyToStartShown') === 'true';

      if (!hasSeenWelcome) {
        sessionStorage.setItem("fitpactSeenWelcomeThisSession", "1");
        setShowWelcomeDialog(true);
        localStorage.setItem('dashboardWelcomeShown', 'true');
        localStorage.setItem('dashboardTdeeOverviewShown', 'true');
        setUserPref(uid, "dashboardWelcomeShown", "true");
        setUserPref(uid, "dashboardTdeeOverviewShown", "true");
      } else if (!hasSeenAcclimation && !isAcclimationComplete()) {
        setShowAcclimationDialog(true);
        localStorage.setItem('dashboardAcclimationShown', 'true');
        setUserPref(uid, "dashboardAcclimationShown", "true");
      } else {
        const showReadyToStart = localStorage.getItem('showReadyToStartPopup');
        if (showReadyToStart === 'true' && !hasSeenReady) {
          setShowReadyToStartDialog(true);
          localStorage.removeItem('showReadyToStartPopup');
        } else if (showReadyToStart === 'true') {
          localStorage.removeItem('showReadyToStartPopup');
        }
      }
    };
    checkPopupFlags();
  }, [user?.id]);

  // Save weeklyData to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardWeeklyData', JSON.stringify(weeklyData));
    calculateStreak();
  }, [weeklyData]);

  // Save previousWeekData to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardPreviousWeekData', JSON.stringify(previousWeekData));
  }, [previousWeekData]);

  // Returning users: one motivational dialog per browser session
  useEffect(() => {
    if (!user?.id) return;
    if (sessionStorage.getItem("fitpactWelcomeBackShown") === "1") return;
    if (sessionStorage.getItem("fitpactSeenWelcomeThisSession") === "1") return;
    if (localStorage.getItem("dashboardWelcomeShown") !== "true") return;
    const tm = window.setTimeout(() => {
      setShowWelcomeBackDialog(true);
      sessionStorage.setItem("fitpactWelcomeBackShown", "1");
    }, 700);
    return () => clearTimeout(tm);
  }, [user?.id]);

  // If journey is complete and maintenance was not chosen yet, show the maintenance prompt after reload (skip when Week 12 summary just fired this session).
  useEffect(() => {
    if (!journeyComplete || maintenancePhase.active) return;
    if (localStorage.getItem("fitpactPendingMaintenanceAfterWeek12") !== "1") return;
    if (week12SummaryScheduledRef.current) return;
    const t = window.setTimeout(() => setShowMaintenanceSuggestionDialog(true), 1200);
    return () => window.clearTimeout(t);
  }, [journeyComplete, maintenancePhase.active]);

  // Save completedWeeks to localStorage and recalculate targets whenever completedWeeks changes
  useEffect(() => {
    localStorage.setItem('dashboardCompletedWeeks', JSON.stringify(completedWeeks));
    // Recalculate targets whenever in weight loss phase (acclimation complete), including Week 1 (0 completed weeks)
    if (isAcclimationComplete()) {
      recalculateTargets(completedWeeks);
    }
  }, [completedWeeks, acclimationCalories, acclimationData, userGender]);

  // Save acclimationData to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardAcclimationData', JSON.stringify(acclimationData));
  }, [acclimationData]);

  // Save acclimationSteps to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('dashboardAcclimationSteps', acclimationSteps.toString());
  }, [acclimationSteps]);

  // Save journey anchor and last day of 12-week Weight Loss Phase (from computed WL start)
  useEffect(() => {
    if (weightLossStartDate) {
      localStorage.setItem("dashboardWeightLossStartDate", weightLossStartDate);
      const wlPs = weightLossPhaseStartFromJourneyAnchor(weightLossStartDate);
      setWeightLossEndDate(lastDayOfWeek12Iso(wlPs));
    }
  }, [weightLossStartDate]);

  // When maintenance is active but dates were never set (e.g. user chose "Yes" on the suggestion dialog only), derive from journey anchor.
  useEffect(() => {
    if (!weightLossStartDate) return;
    setMaintenancePhase((prev) => {
      if (!prev.active) return prev;
      if (prev.startDate && prev.endDate) return prev;
      const derived = deriveMaintenanceWindowFromJourneyAnchor(weightLossStartDate);
      return {
        ...prev,
        startDate: prev.startDate || derived.startDate,
        endDate: prev.endDate || derived.endDate,
      };
    });
  }, [weightLossStartDate, maintenancePhase.active, maintenancePhase.startDate, maintenancePhase.endDate]);

  // Save streak data
  useEffect(() => {
    localStorage.setItem('dashboardCurrentStreak', currentStreak.toString());
    localStorage.setItem('dashboardLongestStreak', longestStreak.toString());
  }, [currentStreak, longestStreak]);

  // Save acclimation completion status
  useEffect(() => {
    localStorage.setItem('dashboardWeek1Complete', isWeek1Complete.toString());
    localStorage.setItem('dashboardWeek2Complete', isWeek2Complete.toString());
    localStorage.setItem('dashboardWeek3Complete', isWeek3Complete.toString());
    localStorage.setItem('dashboardWeek4Complete', isWeek4Complete.toString());
  }, [isWeek1Complete, isWeek2Complete, isWeek3Complete, isWeek4Complete]);

  // Save starting weight
  useEffect(() => {
    if (startingWeight) {
      localStorage.setItem('dashboardStartingWeight', startingWeight);
    }
  }, [startingWeight]);

  // Calculate streak based on weekly data - counts only when ALL of steps, calories, and weight are entered
  // Streak persists across weeks and only resets when user completes a week with missing data
  const calculateStreak = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Start with completed weeks streak (each completed week that was fully filled contributes 7 days)
    let baseStreak = 0;
    for (const week of completedWeeks) {
      const allDaysFilled = days.every(day => {
        const dayData = week.data[day as keyof typeof week.data];
        return dayData && dayData.steps > 0 && dayData.calories > 0 && dayData.weight > 0;
      });
      if (allDaysFilled) {
        baseStreak += 7;
      } else {
        // If a completed week had missing data, streak was reset at that point
        baseStreak = 0;
      }
    }
    
    // Now count consecutive days with ALL data in current week
    let currentWeekStreak = 0;
    for (const day of days) {
      const dayData = weeklyData[day as keyof typeof weeklyData];
      if (dayData && dayData.steps > 0 && dayData.calories > 0 && dayData.weight > 0) {
        currentWeekStreak++;
      } else {
        break; // Stop counting when we hit a day with missing data
      }
    }
    
    const totalStreak = baseStreak + currentWeekStreak;

    setCurrentStreak(totalStreak);
    if (totalStreak > longestStreak) {
      setLongestStreak(totalStreak);
    }
  };

  // Save maintenance phase to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardMaintenancePhase', JSON.stringify(maintenancePhase));
  }, [maintenancePhase]);

  useEffect(() => {
    try {
      localStorage.setItem("fitpactArchivedPhases", JSON.stringify(archivedPhases));
    } catch {}
  }, [archivedPhases]);

  // Sync dashboard state to Supabase (debounced)
  const saveToSupabaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!journey) return;
    if (saveToSupabaseRef.current) clearTimeout(saveToSupabaseRef.current);
    saveToSupabaseRef.current = setTimeout(() => {
      saveJourney({
        weekly_data: weeklyData,
        previous_week_data: previousWeekData,
        completed_weeks: completedWeeks,
        acclimation_data: acclimationData,
        acclimation_steps: acclimationSteps,
        recommended_steps: recommendedSteps,
        recommended_calories: recommendedCalories,
        weight_loss_start_date: weightLossStartDate || null,
        weight_loss_start_is_anchor: true,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        week1_complete: isWeek1Complete,
        week2_complete: isWeek2Complete,
        week3_complete: isWeek3Complete,
        week4_complete: isWeek4Complete,
        starting_weight: startingWeight || null,
        journey_complete: journeyComplete,
        maintenance_phase: maintenancePhase,
        archived_phases: archivedPhases,
      });
      saveToSupabaseRef.current = null;
    }, 800);
    return () => {
      if (saveToSupabaseRef.current) clearTimeout(saveToSupabaseRef.current);
    };
  }, [
    journey?.id,
    weeklyData,
    previousWeekData,
    completedWeeks,
    acclimationData,
    acclimationSteps,
    recommendedSteps,
    recommendedCalories,
    weightLossStartDate,
    currentStreak,
    longestStreak,
    isWeek1Complete,
    isWeek2Complete,
    isWeek3Complete,
    isWeek4Complete,
    startingWeight,
    journeyComplete,
    maintenancePhase,
    archivedPhases,
    saveJourney,
  ]);

  // Calculate maintenance calories (TDEE at current weight - maintenance level)
  const calculateMaintenanceCalories = (currentWeight: number) => {
    const activityMultipliers: Record<string, number> = {
      "sedentary": 1.2,
      "lightly-active": 1.375,
      "moderately-active": 1.55,
      "very-active": 1.725,
      "super-active": 1.9
    };
    let height = 175, age = 30, gender = userGender, activityLevel = 1.55;
    if (profile) {
      height = parseFloat(profile.height) || 175;
      age = profile.age ?? 30;
      gender = profile.gender || userGender;
      activityLevel = activityMultipliers[profile.activity_level] || 1.55;
    } else {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          height = parseFloat(p.height) || 175;
          age = parseFloat(p.age) || 30;
          gender = p.gender || userGender;
          activityLevel = activityMultipliers[p.activityLevel] || 1.55;
        } catch {}
      }
    }
    
    const bmr = gender === 'female'
      ? 10 * currentWeight + 6.25 * height - 5 * age - 161
      : 10 * currentWeight + 6.25 * height - 5 * age + 5;
    return Math.round(bmr * activityLevel);
  };

  // Calculate updated stats for maintenance phase
  const calculateMaintenanceStats = (currentWeight: number) => {
    let height = 175, age = 30, gender = userGender;
    if (profile) {
      height = parseFloat(profile.height) || 175;
      age = profile.age ?? 30;
      gender = profile.gender || userGender;
    } else {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        try {
          const p = JSON.parse(stored);
          height = parseFloat(p.height) || 175;
          age = parseFloat(p.age) || 30;
          gender = p.gender || userGender;
        } catch {}
      }
    }
    const heightM = height / 100;
    const bmi = currentWeight / (heightM * heightM);
    // Deurenberg formula
    const genderFactor = gender === 'female' ? 0 : 1;
    const bf = (1.2 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4;
    let classification = 'Obese';
    if (bmi < 18.5) classification = 'Underweight';
    else if (bmi < 25) classification = 'Within Healthy Range';
    return { bmi: bmi.toFixed(1), bodyFat: bf.toFixed(1), classification };
  };

  // Handle maintenance week data change
  const handleMaintenanceDataChange = (week: string, day: string, value: number) => {
    if (value > 200) value = 200;
    setMaintenancePhase(prev => ({
      ...prev,
      weekData: {
        ...prev.weekData,
        [week]: { ...prev.weekData[week as keyof typeof prev.weekData], [day]: value }
      }
    }));
  };

  /** Mean of each maintenance week’s daily average (4 values) */
  const averageMaintenanceFourWeeks = (wd: typeof maintenancePhase.weekData) => {
    const weekAvgs: number[] = [];
    for (const n of [1, 2, 3, 4] as const) {
      const key = `week${n}` as keyof typeof wd;
      const vals = Object.values(wd[key]).filter((v) => v > 0);
      if (vals.length) {
        weekAvgs.push(vals.reduce((s, v) => s + v, 0) / vals.length);
      }
    }
    if (weekAvgs.length === 0) return 0;
    return weekAvgs.reduce((a, b) => a + b, 0) / weekAvgs.length;
  };

  const maintenanceDisplayWeightKg = () =>
    maintenancePhase.baselineWeightKg > 0 ? maintenancePhase.baselineWeightKg : maintenancePhase.currentWeight;

  // Complete a maintenance week (baseline weight & maintenance calories stay fixed at Week 12 end)
  const handleCompleteMaintenanceWeek = (weekNumber: 1 | 2 | 3 | 4) => {
    const weekKey = `week${weekNumber}` as keyof typeof maintenancePhase.weekData;
    const weekData = maintenancePhase.weekData[weekKey];
    const hasAllData = Object.values(weekData).every((v) => v > 0);
    if (!hasAllData) {
      alert(`Please fill in all 7 days of Week ${weekNumber} before completing it.`);
      return;
    }
    const completionKey = `week${weekNumber}Complete` as
      | "week1Complete"
      | "week2Complete"
      | "week3Complete"
      | "week4Complete";
    if (maintenancePhase[completionKey]) {
      return;
    }

    setMaintenancePhase((prev) => ({
      ...prev,
      [completionKey]: true,
    }));

    if (weekNumber === 4 && user) {
      const fourAvg = averageMaintenanceFourWeeks(maintenancePhase.weekData);
      if (fourAvg > 0) {
        let heightCm = 175;
        let age = 30;
        let gender = userGender;
        let activityLevel = "moderately-active";
        if (profile) {
          heightCm = parseFloat(profile.height) || 175;
          age = profile.age ?? 30;
          gender = profile.gender || userGender;
          activityLevel = profile.activity_level || "moderately-active";
        } else {
          const stored = localStorage.getItem("userProfile");
          if (stored) {
            try {
              const p = JSON.parse(stored);
              heightCm = parseFloat(p.height) || 175;
              age = parseFloat(p.age) || 30;
              gender = p.gender || userGender;
              activityLevel = p.activityLevel || "moderately-active";
            } catch {}
          }
        }
        const snap = buildTdeeSnapshotFromMetrics({
          weightKg: fourAvg,
          heightCm,
          age,
          gender,
          activityLevel,
        });
        saveTdee({
          values_json: snap.values_json,
          starting_calorie_intake: snap.starting_calorie_intake,
          suggested_weight_goal: snap.suggested_weight_goal,
          current_weight: snap.current_weight,
          weight_to_lose: snap.weight_to_lose,
          height: String(heightCm),
        });
        upsertProfile(user.id, { current_weight: fourAvg.toFixed(2) });
        refreshProfile();
      }
      setTimeout(() => setShowMaintenanceCompleteDialog(true), 600);
    }
  };

  /** After maintenance phase: archive this cycle and reset active acclimation + weight-loss + maintenance UI for a new journey */
  const beginNewCycleFromMaintenance = async () => {
    if (!journey) return;
    const fourAvg = averageMaintenanceFourWeeks(maintenancePhase.weekData);
    const acclimationAvg = getTotalAcclimationAverage();
    const anchor = weightLossStartDate || null;
    const acclStart = anchor;
    const acclEnd = anchor ? addDaysIso(anchor, 27) : null;
    const wlStart = anchor ? weightLossPhaseStartFromJourneyAnchor(anchor) : null;
    const wlEnd = wlStart ? lastDayOfWeek12Iso(wlStart) : null;
    let maintEnd = maintenancePhase.endDate || null;
    let maintStart = maintenancePhase.startDate || null;
    if (anchor && (!maintStart || !maintEnd)) {
      const derived = deriveMaintenanceWindowFromJourneyAnchor(anchor);
      maintStart = maintStart || derived.startDate;
      maintEnd = maintEnd || derived.endDate;
    }
    if (!maintStart && maintEnd) {
      const [y, mo, dd] = maintEnd.split("-").map((x) => parseInt(x, 10));
      const dt = new Date(y, mo - 1, dd);
      dt.setDate(dt.getDate() - 27);
      maintStart = formatLocalIsoDate(dt);
    }
    const phaseEndDateIso = maintEnd;

    const acclDays = acclStart && acclEnd ? inclusiveDaysBetween(acclStart, acclEnd) : null;
    const wlDays = wlStart && wlEnd ? inclusiveDaysBetween(wlStart, wlEnd) : null;
    const maintDays = maintStart && maintEnd ? inclusiveDaysBetween(maintStart, maintEnd) : null;
    const phaseSumDays =
      acclDays != null && wlDays != null && maintDays != null ? acclDays + wlDays + maintDays : null;
    const wlStartToMaintenanceEndDays =
      wlStart && phaseEndDateIso ? inclusiveDaysBetween(wlStart, phaseEndDateIso) : null;
    const totalCalendarSpanDays =
      acclStart && phaseEndDateIso ? inclusiveDaysBetween(acclStart, phaseEndDateIso) : null;

    const totalWeightLossPhaseKg =
      acclimationAvg > 0 && fourAvg > 0 ? acclimationAvg - fourAvg : 0;
    const maintForArchive = {
      ...JSON.parse(JSON.stringify(maintenancePhase)) as Record<string, unknown>,
      startDate: maintStart || "",
      endDate: maintEnd || "",
    };

    const bundle: ArchivedPhaseBundle = {
      id: crypto.randomUUID(),
      archivedAt: new Date().toISOString(),
      phaseNumber: archivedPhases.length + 1,
      phaseStartDateIso: acclStart,
      phaseEndDateIso,
      journeyAnchorDateIso: anchor,
      acclimationPhaseStartDateIso: acclStart,
      acclimationPhaseEndDateIso: acclEnd,
      phaseSumDays: phaseSumDays ?? undefined,
      wlStartToMaintenanceEndDays: wlStartToMaintenanceEndDays ?? undefined,
      totalCalendarSpanDays: totalCalendarSpanDays ?? undefined,
      acclimationAverageKg: acclimationAvg,
      weightAtEndMaintenanceKg: fourAvg,
      totalWeightLossPhaseKg,
      weightLossStartDate: anchor,
      acclimationData: JSON.parse(JSON.stringify(acclimationData)) as Record<string, unknown>,
      completedWeeks: JSON.parse(JSON.stringify(completedWeeks)) as unknown[],
      maintenancePhase: maintForArchive,
      week12Stats: { ...week12Stats },
      maintenanceEndingAverageKg: fourAvg,
    };
    const nextArch = [...archivedPhases, bundle];
    setArchivedPhases(nextArch);

    const emptyWeek = {
      Monday: { steps: 0, calories: 0, weight: 0 },
      Tuesday: { steps: 0, calories: 0, weight: 0 },
      Wednesday: { steps: 0, calories: 0, weight: 0 },
      Thursday: { steps: 0, calories: 0, weight: 0 },
      Friday: { steps: 0, calories: 0, weight: 0 },
      Saturday: { steps: 0, calories: 0, weight: 0 },
      Sunday: { steps: 0, calories: 0, weight: 0 },
    };
    const emptyAccl = {
      week1: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
      week2: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
      week3: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
      week4: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
    };
    setWeeklyData(emptyWeek);
    setPreviousWeekData(emptyWeek);
    setCompletedWeeks([]);
    setAcclimationData(emptyAccl);
    setIsWeek1Complete(false);
    setIsWeek2Complete(false);
    setIsWeek3Complete(false);
    setIsWeek4Complete(false);
    setJourneyComplete(false);
    setWeightLossStartDate("");
    localStorage.removeItem("dashboardWeightLossStartDate");
    setStartingWeight(fourAvg > 0 ? fourAvg.toFixed(2) : "");
    setMaintenancePhase({
      active: false,
      startDate: "",
      endDate: "",
      baselineWeightKg: 0,
      currentWeight: 0,
      maintenanceCalories: 0,
      completedWeeks: [],
      week1Complete: false,
      week2Complete: false,
      week3Complete: false,
      week4Complete: false,
      weekData: emptyAccl,
    });
    setRecommendedSteps(ACCLIMATION_BASE_STEPS);
    const sci = localStorage.getItem("startingCalorieIntake");
    setAcclimationCalories(sci ? parseFloat(sci) : 0);
    setRecommendedCalories(0);
    setCurrentStreak(0);
    setLongestStreak(0);
    setShowMaintenanceCompleteDialog(false);
    setAcclimationCollapsed(false);
    setWeightLossCollapsed(false);

    await saveJourney({
      archived_phases: nextArch,
      weekly_data: emptyWeek,
      previous_week_data: emptyWeek,
      completed_weeks: [],
      acclimation_data: emptyAccl,
      acclimation_steps: ACCLIMATION_BASE_STEPS,
      recommended_steps: ACCLIMATION_BASE_STEPS,
      recommended_calories: null,
      weight_loss_start_date: null,
      weight_loss_start_is_anchor: true,
      current_streak: 0,
      longest_streak: 0,
      week1_complete: false,
      week2_complete: false,
      week3_complete: false,
      week4_complete: false,
      starting_weight: fourAvg > 0 ? fourAvg.toFixed(2) : null,
      journey_complete: false,
      maintenance_phase: {
        active: false,
        startDate: "",
        endDate: "",
        baselineWeightKg: 0,
        currentWeight: 0,
        maintenanceCalories: 0,
        completedWeeks: [],
        week1Complete: false,
        week2Complete: false,
        week3Complete: false,
        week4Complete: false,
        weekData: emptyAccl,
      },
    });
    await refreshJourney();
  };

  const clearAllDashboardData = async () => {
    const keysToRemove = [
      'dashboardWeeklyData', 'dashboardPreviousWeekData', 'dashboardCompletedWeeks',
      'dashboardAcclimationData', 'dashboardAcclimationSteps', 'dashboardWeightLossStartDate',
      'dashboardAcclimationPhaseStartDate', 'dashboardAcclimationPhaseEndDate',
      'dashboardCurrentStreak', 'dashboardLongestStreak', 'dashboardWeek1Complete',
      'dashboardWeek2Complete', 'dashboardWeek3Complete', 'dashboardWeek4Complete', 'dashboardStartingWeight', 'dashboardWelcomeShown',
      'dashboardRecommendedCalories', 'dashboardRecommendedSteps', 'stepDebugInfo',
      'dashboardJourneyComplete', 'dashboardMaintenancePhase', 'dashboardAcclimationShown', 'dashboardLowCalorieHeadroomWarned',
      'dashboardTdeeOverviewShown', 'readyToStartShown', 'showReadyToStartPopup',
      'tdeeCalculatedValues', 'startingCalorieIntake', 'suggestedWeightGoal',
      'fitpactPendingMaintenanceAfterWeek12', 'fitpactArchivedPhases',
      'tdeeChangeWarningAcknowledged',
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    setArchivedPhases([]);

    await saveJourney({
      archived_phases: [],
      acclimation_data: { week1: {}, week2: {}, week3: {}, week4: {} },
      weekly_data: {},
      previous_week_data: {},
      completed_weeks: [],
      recommended_steps: 4000,
      recommended_calories: null,
      weight_loss_start_date: null,
      weight_loss_start_is_anchor: true,
      acclimation_phase_start_date: null,
      acclimation_phase_end_date: null,
      current_streak: 0,
      longest_streak: 0,
      week1_complete: false,
      week2_complete: false,
      week3_complete: false,
      week4_complete: false,
      starting_weight: null,
      journey_complete: false,
      maintenance_phase: null,
      step_debug: null,
      acclimation_steps: 4000,
      acclimation_calories: null,
    });

    saveTdee({
      values_json: null,
      starting_calorie_intake: null,
      suggested_weight_goal: null,
      current_weight: null,
      weight_to_lose: null,
      height: null,
    });

    if (user?.id) {
      void setUserPref(user.id, "readyToStartShown", "false");
      void setUserPref(user.id, "dashboardWelcomeShown", "false");
      void setUserPref(user.id, "dashboardAcclimationShown", "false");
    }

    navigate('/tdee-calculator');
  };

  const handleDailyDataChange = (field: string, value: number) => {
    // Apply weight limit for weight field
    if (field === 'weight' && value > 200) {
      value = 200;
    }
    
    const newDailyData = { ...dailyData, [field]: value };
    setDailyData(newDailyData);
  };

  const handleWeeklyDataChange = (day: string, field: string, value: number) => {
    if (journeyComplete) {
      setShowJourneyCompleteBlockDialog(true);
      return;
    }

    if (field === "weight" && value > 200) {
      value = 200;
    }

    setWeeklyData((prev) => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], [field]: value },
    }));
  };

  const handleAcclimationDataChange = (week: string, day: string, value: number) => {
    // Apply weight limit
    if (value > 200) {
      value = 200;
    }
    
    setAcclimationData(prev => ({
      ...prev,
      [week]: { ...prev[week as keyof typeof prev], [day]: value }
    }));
  };

  // Check if acclimation is complete (both weeks marked as complete)
  const isAcclimationComplete = () => {
    return isWeek1Complete && isWeek2Complete && isWeek3Complete && isWeek4Complete;
  };

  /** Calorie reminders: run on blur only (after user finishes typing). High: over target. Low: under 85% of target. */
  const evaluateCalorieNudgeForDay = (day: string) => {
    if (!isAcclimationComplete() || journeyComplete) return;
    const cal = weeklyData[day as keyof typeof weeklyData]?.calories ?? 0;
    if (cal <= 0) return;
    const minCal = userGender === "female" ? 1300 : 1500;
    const targetCalories =
      recommendedCalories > 0
        ? recommendedCalories
        : acclimationCalories > 0
          ? Math.max(minCal, acclimationCalories - 200)
          : 0;
    if (targetCalories <= 0) return;
    // One reminder per weight-loss week index + day column (not calendar date — avoids blocking other weeks/days)
    const wlWeek = completedWeeks.length;
    if (cal > targetCalories) {
      const k = `fitpactCalHigh-wl${wlWeek}-${day}`;
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        setCalorieReminder("high");
      }
      return;
    }
    if (cal < targetCalories * 0.85) {
      const k = `fitpactCalLow-wl${wlWeek}-${day}`;
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        setCalorieReminder("low");
      }
    }
  };

  // Handle completing acclimation week
  const handleCompleteAcclimationWeek = (weekNumber: 1 | 2 | 3 | 4) => {
    const weekKey = `week${weekNumber}` as keyof typeof acclimationData;
    const weekHasData = Object.values(acclimationData[weekKey]).every(v => v > 0);
    if (!weekHasData) {
      alert(`Please fill in all 7 days of Week ${weekNumber} before completing it.`);
      return;
    }
    if (weekNumber === 1) setIsWeek1Complete(true);
    if (weekNumber === 2) setIsWeek2Complete(true);
    if (weekNumber === 3) setIsWeek3Complete(true);
    if (weekNumber === 4) {
      setIsWeek4Complete(true);
      if (isWeek1Complete && isWeek2Complete && isWeek3Complete) {
        setShowAcclimationCompleteDialog(true);
        const minCal = userGender === 'female' ? 1300 : 1500;
        if (acclimationCalories > 0 && (acclimationCalories - minCal) <= 200) {
          const alreadyWarned = localStorage.getItem('dashboardLowCalorieHeadroomWarned');
          if (!alreadyWarned) {
            localStorage.setItem('dashboardLowCalorieHeadroomWarned', 'true');
            setTimeout(() => setShowLowCalorieHeadroomDialog(true), 800);
          }
        }
      }
    }
  };

  // Get today's day name
  const getTodayDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Get today's weight from weekly data
  const getTodayWeight = () => {
    const today = getTodayDayName();
    return weeklyData[today as keyof typeof weeklyData]?.weight || 0;
  };

  const getAcclimationWeekAverage = (weekNumber: 1 | 2 | 3 | 4) => {
    const weekKey = `week${weekNumber}` as keyof typeof acclimationData;
    const values = Object.values(acclimationData[weekKey]).filter(v => v > 0);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  };

  // Get total Acclimation Week average (Week 1..Week 4 combined)
  const getTotalAcclimationAverage = () => {
    const week1Values = Object.values(acclimationData.week1).filter(v => v > 0);
    const week2Values = Object.values(acclimationData.week2).filter(v => v > 0);
    const week3Values = Object.values(acclimationData.week3).filter(v => v > 0);
    const week4Values = Object.values(acclimationData.week4).filter(v => v > 0);
    const allValues = [...week1Values, ...week2Values, ...week3Values, ...week4Values];
    return allValues.length > 0 
      ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length
      : 0;
  };

  // Once acclimation is complete, baseline the 12-week journey from the 4-week average.
  useEffect(() => {
    if (!isAcclimationComplete()) return;
    const avg = getTotalAcclimationAverage();
    if (avg > 0) setStartingWeight(avg.toFixed(2));
  }, [isWeek1Complete, isWeek2Complete, isWeek3Complete, isWeek4Complete, acclimationData]);

  // Recalculate steps & calories from scratch given a set of completed weeks
  const recalculateTargets = (weeks: typeof completedWeeks) => {
    const acclimationAvg = getTotalAcclimationAverage();
    const baseCalories = acclimationCalories > 0 ? acclimationCalories : 0;
    const minCalories = userGender === 'female' ? 1300 : 1500;

    let stepTarget = ACCLIMATION_BASE_STEPS;
    // Weight loss phase always starts 200 cal below Acclimation Calories (then loop may reduce further)
    let calTarget = baseCalories > 0 ? Math.max(minCalories, baseCalories - 200) : baseCalories;

    for (let i = 0; i < weeks.length; i++) {
      const prevAvg = i === 0 ? acclimationAvg : (weeks[i - 1]?.averages?.weight || 0);
      const currAvg = weeks[i]?.averages?.weight || 0;
      const pctChange = prevAvg > 0 ? ((currAvg - prevAvg) / prevAvg) * 100 : 0;
      const insufficient = pctChange > STEP_INCREASE_THRESHOLD_PERCENT;

      if (insufficient) {
        if (stepTarget < MAX_RECOMMENDED_STEPS) {
          stepTarget = Math.min(MAX_RECOMMENDED_STEPS, stepTarget + STEPS_INCREMENT);
        } else {
          // Steps maxed, reduce calories
          const proposed = calTarget - 200;
          calTarget = proposed < minCalories ? minCalories : proposed;
        }
      }
    }

    setRecommendedSteps(stepTarget);
    localStorage.setItem('dashboardRecommendedSteps', stepTarget.toString());
    setRecommendedCalories(calTarget);
    localStorage.setItem('dashboardRecommendedCalories', calTarget.toString());
  };

  // Get acclimation start weight
  const getAcclimationStartWeight = () => {
    const week1Values = Object.values(acclimationData.week1).filter(v => v > 0);
    return week1Values.length > 0 
      ? week1Values.reduce((sum, v) => sum + v, 0) / week1Values.length
      : 0;
  };

  /** Signed kg vs acclimation baseline: negative = weight loss, positive = gain, 0 = unchanged (uses last completed week only) */
  const getWeightPhaseDeltaKg = () => {
    const acclimationAvg = getTotalAcclimationAverage();
    if (acclimationAvg <= 0 || completedWeeks.length === 0) return 0;
    const lastCompletedWeekAvg = completedWeeks[completedWeeks.length - 1].averages.weight;
    return lastCompletedWeekAvg - acclimationAvg;
  };

  // Get same day last week's weight
  const getLastWeekSameDayWeight = () => {
    const today = getTodayDayName();
    const lastWeekWeight = previousWeekData[today as keyof typeof previousWeekData]?.weight;
    
    // If no previous week data, use latest acclimation week average (Week 4)
    if (!lastWeekWeight || lastWeekWeight === 0) {
      return getAcclimationWeekAverage(4);
    }
    
    return lastWeekWeight;
  };

  // Calculate weight difference from same day last week
  const getWeightDifferenceFromLastWeek = () => {
    const todayWeight = getTodayWeight();
    const lastWeekWeight = getLastWeekSameDayWeight();
    if (todayWeight === 0 || lastWeekWeight === 0) return 0;
    return todayWeight - lastWeekWeight;
  };

  // Calculate current week averages
  const calculateWeeklyAverages = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const steps = days.map(day => weeklyData[day as keyof typeof weeklyData]?.steps || 0);
    const calories = days.map(day => weeklyData[day as keyof typeof weeklyData]?.calories || 0);
    const weights = days.map(day => weeklyData[day as keyof typeof weeklyData]?.weight || 0);
    
    const validSteps = steps.filter(s => s > 0);
    const validCalories = calories.filter(c => c > 0);
    const validWeights = weights.filter(w => w > 0);
    
    return {
      steps: validSteps.length > 0 ? validSteps.reduce((sum, val) => sum + val, 0) / validSteps.length : 0,
      calories: validCalories.length > 0 ? validCalories.reduce((sum, val) => sum + val, 0) / validCalories.length : 0,
      weight: validWeights.length > 0 ? validWeights.reduce((sum, val) => sum + val, 0) / validWeights.length : 0
    };
  };

  // Calculate previous week averages for comparison - always show previous week average, never 0
  const calculatePreviousWeekAverages = () => {
    const currentWeekAvg = calculateWeeklyAverages().weight;
    
    // For Week 1, compare against latest acclimation week
    if (completedWeeks.length === 0) {
      const acclimWeek4Avg = getAcclimationWeekAverage(4);
      // Always return the previous week average, even if current week has no data
      return {
        average: acclimWeek4Avg,
        difference: currentWeekAvg > 0 ? currentWeekAvg - acclimWeek4Avg : 0
      };
    }
    
    // For subsequent weeks, use the most recently completed week
    const lastCompletedWeek = completedWeeks[completedWeeks.length - 1];
    const prevAvg = lastCompletedWeek?.averages.weight || 0;
    return {
      average: prevAvg,
      difference: currentWeekAvg > 0 ? currentWeekAvg - prevAvg : 0
    };
  };

  const weeklyAverages = calculateWeeklyAverages();
  const previousWeekComparison = calculatePreviousWeekAverages();
  const todayWeight = getTodayWeight();
  const weightDifference = getWeightDifferenceFromLastWeek();

  // Calculate BMI and health metrics using profile data (not hardcoded defaults)
  const calculateBMI = () => {
    const heightCm = profile ? (parseFloat(profile.height) || 175) : (tdeeValues?.height ? parseFloat(tdeeValues.height) : dailyData.height);
    const heightInMeters = heightCm / 100;
    return weeklyAverages.weight / (heightInMeters * heightInMeters);
  };

  const calculateBodyFat = () => {
    const bmi = calculateBMI();
    const userAge = profile?.age ?? (tdeeValues ? 30 : 30);
    const gender = profile?.gender || userGender;
    if (gender === 'male') {
      return (1.2 * bmi) + (0.23 * userAge) - 16.2;
    }
    return (1.2 * bmi) + (0.23 * userAge) - 5.4;
  };

  const getClassification = () => {
    const bmi = calculateBMI();
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Within Healthy Range';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const getWeightToLose = () => {
    const bmi = calculateBMI();
    const heightInMeters = dailyData.height / 100;
    const healthyMaxWeight = 25 * (heightInMeters * heightInMeters);
    return Math.max(0, weeklyAverages.weight - healthyMaxWeight);
  };

  // Check if week overview has complete data (7 days)
  const hasCompleteWeekData = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.every(day => {
      const dayData = weeklyData[day as keyof typeof weeklyData];
      return dayData && dayData.steps > 0 && dayData.calories > 0 && dayData.weight > 0;
    });
  };

  // Check if week has any missing or incomplete data
  const hasMissingWeekData = () => {
    return !hasCompleteWeekData();
  };

  // Validate weight values for single digits (< 10)
  const getSingleDigitWeightDays = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.filter(day => {
      const w = weeklyData[day as keyof typeof weeklyData]?.weight || 0;
      return w > 0 && w < 10;
    });
  };

  // Validate weight values for anomalies (one day off by 5kg or more from others)
  const getWeightAnomalyDay = (): { day: string; direction: 'greater' | 'lower'; diff: number } | null => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weights = days.map(day => ({ day, weight: weeklyData[day as keyof typeof weeklyData]?.weight || 0 })).filter(d => d.weight > 0);
    if (weights.length < 3) return null; // Need at least 3 values to detect anomaly
    
    for (let i = 0; i < weights.length; i++) {
      const others = weights.filter((_, j) => j !== i);
      const othersAvg = others.reduce((s, v) => s + v.weight, 0) / others.length;
      const diff = weights[i].weight - othersAvg;
      const absDiff = Math.abs(diff);
      if (absDiff >= 5) {
        return { day: weights[i].day, direction: diff > 0 ? 'greater' : 'lower', diff: Math.round(absDiff * 10) / 10 };
      }
    }
    return null;
  };

  // Check for missing weight days (0, blank, or single digit)
  const getMissingWeightDays = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.filter(day => {
      const w = weeklyData[day as keyof typeof weeklyData]?.weight || 0;
      return w === 0 || w < 10;
    });
  };

  // Handle complete week - collapse current week and start new one
  const handleCompleteWeek = () => {
    // Block completing beyond Week 12
    if (completedWeeks.length >= 12) {
      return;
    }

    // 1. Check for single digit weight values first
    const singleDigitDays = getSingleDigitWeightDays();
    if (singleDigitDays.length > 0) {
      setSingleDigitWeightDays(singleDigitDays);
      setShowSingleDigitWeightDialog(true);
      return;
    }

    // 2. Check that all 7 weight entries are present (not 0 or blank)
    const missingDays = getMissingWeightDays();
    if (missingDays.length > 0) {
      setMissingWeightDays(missingDays);
      setShowMissingWeightDialog(true);
      return;
    }

    // 3. Check for weight anomalies (one day 5kg+ off from others)
    const anomalyResult = getWeightAnomalyDay();
    if (anomalyResult) {
      setAnomalyWeightDay(anomalyResult);
      setShowWeightAnomalyDialog(true);
      return;
    }

    // 4. Standard incomplete data check (steps/calories)
    if (hasMissingWeekData()) {
      setShowIncompleteWeekDialog(true);
      return;
    }

    completeWeek();
  };

  // Actually complete the week
  const completeWeek = () => {
    const averages = calculateWeeklyAverages();

    // Check if there's missing data for any field (steps, calories, weight) - if so, reset streak
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hasMissingData = days.some(day => {
      const dayData = weeklyData[day as keyof typeof weeklyData];
      return !dayData || dayData.steps === 0 || dayData.calories === 0 || dayData.weight === 0;
    });

    // --- Step & Calorie recommendation progression ---
    const previousAvg = completedWeeks.length === 0
      ? getTotalAcclimationAverage()
      : (completedWeeks[completedWeeks.length - 1]?.averages?.weight || 0);

    const currentAvg = averages.weight;
    const percentChange = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    const currentStepTarget = recommendedSteps > 0 ? recommendedSteps : ACCLIMATION_BASE_STEPS;
    const insufficientLoss = percentChange > STEP_INCREASE_THRESHOLD_PERCENT;

    // Step logic: increase only when NOT losing enough
    const nextStepTarget = insufficientLoss
      ? Math.min(MAX_RECOMMENDED_STEPS, currentStepTarget + STEPS_INCREMENT)
      : currentStepTarget;

    // Calorie logic: weight loss phase starts at TDEE - 200; further reductions after steps max out
    const minCalories = userGender === 'female' ? 1300 : 1500;
    const currentCalTarget = recommendedCalories > 0
      ? recommendedCalories
      : (acclimationCalories > 0 ? Math.max(minCalories, acclimationCalories - 200) : acclimationCalories);
    let nextCalTarget = currentCalTarget;
    let caloriesReduced = false;
    let hitMinFloor = false;

    if (currentStepTarget >= MAX_RECOMMENDED_STEPS && insufficientLoss) {
      // Steps already maxed, reduce calories by 200
      const proposed = currentCalTarget - 200;
      if (proposed < minCalories) {
        nextCalTarget = minCalories;
        hitMinFloor = true;
        if (currentCalTarget > minCalories) {
          caloriesReduced = true;
        }
      } else {
        nextCalTarget = proposed;
        caloriesReduced = true;
      }
    }
    // If steps already at max AND already at min calories, don't change anything (no further reductions)

    const stepsIncreased = insufficientLoss && currentStepTarget < MAX_RECOMMENDED_STEPS && nextStepTarget > currentStepTarget;
    if (stepsIncreased || caloriesReduced) {
      setStepsCaloriesChangeInfo({
        stepsIncreased,
        stepsNewTarget: nextStepTarget,
        caloriesDecreased: caloriesReduced,
        caloriesNewTarget: nextCalTarget,
        hitMinFloor: caloriesReduced && hitMinFloor,
      });
      setTimeout(() => setShowStepsCaloriesChangePopup(true), 450);
    }

    // Build per-week debug info
    const weekStepDebug = {
      prevAvg: previousAvg,
      currAvg: currentAvg,
      percentChange: percentChange,
      didIncrease: insufficientLoss && currentStepTarget < MAX_RECOMMENDED_STEPS,
      prevTarget: currentStepTarget,
      newTarget: nextStepTarget,
      caloriesReduced,
      prevCalories: currentCalTarget,
      newCalories: nextCalTarget,
      hitMinFloor
    };

    // Add current week to completed weeks WITH debug info
    setCompletedWeeks(prev => [
      ...prev,
      {
        weekNumber: prev.length + 1,
        data: { ...weeklyData },
        averages,
        stepDebug: weekStepDebug
      }
    ]);

    // Save global debug info for display
    const debugInfo = {
      prevAvg: previousAvg,
      currAvg: currentAvg,
      percentChange: percentChange,
      didIncrease: insufficientLoss && currentStepTarget < MAX_RECOMMENDED_STEPS,
      caloriesReduced,
      prevCalories: currentCalTarget,
      newCalories: nextCalTarget,
      hitMinFloor
    };
    setStepDebugInfo(debugInfo);
    localStorage.setItem('stepDebugInfo', JSON.stringify(debugInfo));

    setRecommendedSteps(nextStepTarget);
    localStorage.setItem('dashboardRecommendedSteps', nextStepTarget.toString());

    setRecommendedCalories(nextCalTarget);
    localStorage.setItem('dashboardRecommendedCalories', nextCalTarget.toString());

    // Move current week to previous week for comparison
    setPreviousWeekData({ ...weeklyData });

    // Reset current week
    setWeeklyData({
      Monday: { steps: 0, calories: 0, weight: 0 },
      Tuesday: { steps: 0, calories: 0, weight: 0 },
      Wednesday: { steps: 0, calories: 0, weight: 0 },
      Thursday: { steps: 0, calories: 0, weight: 0 },
      Friday: { steps: 0, calories: 0, weight: 0 },
      Saturday: { steps: 0, calories: 0, weight: 0 },
      Sunday: { steps: 0, calories: 0, weight: 0 }
    });

    // Reset streak if missing any data
    if (hasMissingData) {
      setCurrentStreak(0);
    }

    // Check if this was Week 12 - show summary dialog
    const newCompletedCount = completedWeeks.length + 1; // +1 because state hasn't updated yet
    if (newCompletedCount >= 12) {
      week12SummaryScheduledRef.current = true;
      // Use the same baseline as the "Weight Loss to Date" stat card: combined acclimation average
      const acclimationAvg = getTotalAcclimationAverage();
      const sw = acclimationAvg > 0 ? acclimationAvg : (parseFloat(startingWeight) || 0);
      const ew = averages.weight;
      setWeek12Stats({
        startWeight: sw,
        endWeight: ew,
        totalLoss: sw - ew
      });
      setJourneyComplete(true);
      localStorage.setItem('dashboardJourneyComplete', 'true');
      localStorage.setItem('fitpactPendingMaintenanceAfterWeek12', '1');
      // Auto-collapse Acclimation and Weight Loss sections
      setAcclimationCollapsed(true);
      setWeightLossCollapsed(true);
      // Maintenance starts the day after the last day of Week 12 of Weight Loss (WL starts anchor + 28 days)
      if (weightLossStartDate) {
        const derived = deriveMaintenanceWindowFromJourneyAnchor(weightLossStartDate);
        setMaintenancePhase((prev) => ({
          ...prev,
          startDate: derived.startDate,
          endDate: derived.endDate,
          baselineWeightKg: ew,
          currentWeight: ew,
          maintenanceCalories: calculateMaintenanceCalories(ew),
        }));
      }
      setTimeout(() => setShowWeek12SummaryDialog(true), 600);
    }
  };

  // Handle clear week data
  const handleClearWeekData = () => {
    setWeeklyData({
      Monday: { steps: 0, calories: 0, weight: 0 },
      Tuesday: { steps: 0, calories: 0, weight: 0 },
      Wednesday: { steps: 0, calories: 0, weight: 0 },
      Thursday: { steps: 0, calories: 0, weight: 0 },
      Friday: { steps: 0, calories: 0, weight: 0 },
      Saturday: { steps: 0, calories: 0, weight: 0 },
      Sunday: { steps: 0, calories: 0, weight: 0 }
    });
    setCurrentStreak(0);
  };

  // Get acclimation week days based on start date
  const getAcclimationDays = () => {
    if (!weightLossStartDate) return [];
    
    const startDate = new Date(weightLossStartDate);
    const days = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    
    return days;
  };

  // Download progress report as Excel with weight loss chart data
  const handleDownloadReport = useCallback(() => {
    const acclimationAvg = getTotalAcclimationAverage();
    
    // Build data rows
    const rows: Array<{ Week: string; 'Average Weight (kg)': number; 'Weight Loss (kg)': number; 'Steps Avg': number; 'Calories Avg': number }> = [];
    
    completedWeeks.forEach((week) => {
      const loss = acclimationAvg - week.averages.weight;
      rows.push({
        Week: `Week ${week.weekNumber}`,
        'Average Weight (kg)': parseFloat(week.averages.weight.toFixed(2)),
        'Weight Loss (kg)': parseFloat(loss.toFixed(2)),
        'Steps Avg': Math.round(week.averages.steps),
        'Calories Avg': Math.round(week.averages.calories),
      });
    });

    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Weight Loss Buddy - Progress Report'],
      [''],
      ['Starting Weight (Acclimation Avg)', `${acclimationAvg.toFixed(2)} kg`],
      ['Current Weight', completedWeeks.length > 0 ? `${completedWeeks[completedWeeks.length - 1].averages.weight.toFixed(2)} kg` : 'N/A'],
      ['Total Weight Change (kg, − = loss)', `${getWeightPhaseDeltaKg().toFixed(4)} kg`],
      ['Weeks Completed', `${completedWeeks.length} of 12`],
      [''],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Weekly data sheet
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Progress');
    
    // Chart data sheet - formatted for easy line graph creation
    // Build chart data with all 12 weeks (blank for future weeks) and Y-axis scale
    const chartHeaders = ['Week', 'Weight Loss (kg)', '', 'Y-Axis Scale (kg)'];
    const chartRows: Array<Array<string | number>> = [chartHeaders];
    
    // Add data for weeks 1-12 (completed weeks have values, others are blank)
    for (let i = 1; i <= 12; i++) {
      const completedWeek = completedWeeks.find(w => w.weekNumber === i);
      const loss = completedWeek ? parseFloat((acclimationAvg - completedWeek.averages.weight).toFixed(2)) : '';
      // Y-axis scale reference values
      const yScaleValues = [0, 5, 10, 15, 20, 25, 30];
      const yScale = i <= yScaleValues.length ? yScaleValues[i - 1] : '';
      chartRows.push([`Week ${i}`, loss, '', yScale]);
    }
    
    // Add instructions row
    chartRows.push([]);
    chartRows.push(['📊 To create a line graph:']);
    chartRows.push(['1. Select columns A and B (Week + Weight Loss)']);
    chartRows.push(['2. Insert > Chart > Line Chart']);
    chartRows.push(['3. X-Axis: Weeks | Y-Axis: Weight Loss (kg) from 0 to 30 in 5kg increments']);
    
    const chartWs = XLSX.utils.aoa_to_sheet(chartRows);
    
    // Set column widths for readability
    chartWs['!cols'] = [
      { wch: 12 }, // Week column
      { wch: 18 }, // Weight Loss column
      { wch: 4 },  // Spacer
      { wch: 18 }, // Y-Axis Scale
    ];
    
    XLSX.utils.book_append_sheet(wb, chartWs, 'Chart Data');
    
    XLSX.writeFile(wb, `WeightLossBuddy_Progress_Report_Week${completedWeeks.length}.xlsx`);
  }, [completedWeeks, startingWeight, acclimationData]);

  const handleDownloadMaintenanceReport = useCallback(() => {
    if (!maintenancePhase.week4Complete) return;
    const rows: Array<{ Week: string; "Average Weight (kg)": number }> = [];
    for (const n of [1, 2, 3, 4] as const) {
      const wk = maintenancePhase.weekData[`week${n}`];
      const vals = Object.values(wk).filter((v) => v > 0);
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      rows.push({
        Week: `Maintenance Week ${n}`,
        "Average Weight (kg)": parseFloat(avg.toFixed(2)),
      });
    }
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Weight Loss Buddy — Maintenance Phase Report"],
      [""],
      ["Baseline weight (end of Week 12) kg", maintenancePhase.baselineWeightKg > 0 ? maintenancePhase.baselineWeightKg.toFixed(2) : ""],
      ["Maintenance calories", maintenancePhase.maintenanceCalories > 0 ? String(maintenancePhase.maintenanceCalories) : ""],
      [""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Weekly");
    XLSX.writeFile(wb, "WeightLossBuddy_Maintenance_Report.xlsx");
  }, [maintenancePhase]);

  const acclimationAvgFromBundleData = (a: Record<string, unknown>) => {
    const parts: number[] = [];
    for (const w of ["week1", "week2", "week3", "week4"]) {
      const o = a[w] as Record<string, number> | undefined;
      if (o && typeof o === "object") {
        parts.push(...Object.values(o).filter((v) => typeof v === "number" && v > 0));
      }
    }
    if (!parts.length) return 0;
    return parts.reduce((s, v) => s + v, 0) / parts.length;
  };

  const handleDownloadArchivedAcclimation = useCallback(
    (bundle: ArchivedPhaseBundle) => {
      const a = bundle.acclimationData as Record<string, Record<string, number>>;
      const rows: Array<{ Week: string; Day: string; "Weight (kg)": number }> = [];
      for (let i = 1; i <= 4; i++) {
        const week = a[`week${i}`];
        if (!week) continue;
        for (const day of [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ] as const) {
          const v = week[day];
          rows.push({
            Week: `Acclimation Week ${i}`,
            Day: day,
            "Weight (kg)": typeof v === "number" ? v : 0,
          });
        }
      }
      const wb = XLSX.utils.book_new();
      const avg = bundle.acclimationAverageKg ?? acclimationAvgFromBundleData(bundle.acclimationData);
      const idx = archivedPhases.findIndex((x) => x.id === bundle.id);
      const pn = bundle.phaseNumber ?? (idx >= 0 ? idx + 1 : 1);
      const summary = [
        ["Weight Loss Buddy — Acclimation Phase (Archived)"],
        [""],
        ["Phase", `Phase ${pn}`],
        ["Archived at", new Date(bundle.archivedAt).toLocaleString()],
        ["Acclimation average weight (kg)", avg > 0 ? avg.toFixed(2) : "—"],
        [""],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Daily weights");
      XLSX.writeFile(wb, `WeightLossBuddy_Phase${pn}_Acclimation_${bundle.id.slice(0, 8)}.xlsx`);
    },
    [archivedPhases]
  );

  const handleDownloadArchivedWeightLoss = useCallback((bundle: ArchivedPhaseBundle) => {
    const acclimationAvg =
      bundle.acclimationAverageKg ?? acclimationAvgFromBundleData(bundle.acclimationData);
    const weeks = bundle.completedWeeks as Array<{
      weekNumber: number;
      averages: { weight: number; steps: number; calories: number };
    }>;
    if (!weeks?.length) return;
    const rows: Array<{
      Week: string;
      "Average Weight (kg)": number;
      "Weight Loss (kg)": number;
      "Steps Avg": number;
      "Calories Avg": number;
    }> = [];
    weeks.forEach((week) => {
      const loss = acclimationAvg - week.averages.weight;
      rows.push({
        Week: `Week ${week.weekNumber}`,
        "Average Weight (kg)": parseFloat(week.averages.weight.toFixed(2)),
        "Weight Loss (kg)": parseFloat(loss.toFixed(2)),
        "Steps Avg": Math.round(week.averages.steps),
        "Calories Avg": Math.round(week.averages.calories),
      });
    });
    const wb = XLSX.utils.book_new();
    const idx = archivedPhases.findIndex((x) => x.id === bundle.id);
    const pn = bundle.phaseNumber ?? (idx >= 0 ? idx + 1 : 1);
    const summaryData = [
      ["Weight Loss Buddy — Weight Loss Phase (Archived)"],
      [""],
      ["Phase", `Phase ${pn}`],
      ["Archived at", new Date(bundle.archivedAt).toLocaleString()],
      ["Starting Weight (Acclimation Avg)", `${acclimationAvg.toFixed(2)} kg`],
      ["Weeks Completed", `${weeks.length}`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Weekly Progress");
    XLSX.writeFile(wb, `WeightLossBuddy_Phase${pn}_WeightLoss_${bundle.id.slice(0, 8)}.xlsx`);
  }, [archivedPhases]);

  const handleDownloadArchivedMaintenance = useCallback((bundle: ArchivedPhaseBundle) => {
    const m = bundle.maintenancePhase as {
      baselineWeightKg?: number;
      maintenanceCalories?: number;
      weekData?: {
        week1: Record<string, number>;
        week2: Record<string, number>;
        week3: Record<string, number>;
        week4: Record<string, number>;
      };
    };
    if (!m?.weekData) return;
    const rows: Array<{ Week: string; "Average Weight (kg)": number }> = [];
    for (const n of [1, 2, 3, 4] as const) {
      const wk = m.weekData[`week${n}`];
      const vals = Object.values(wk).filter((v) => v > 0);
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      rows.push({
        Week: `Maintenance Week ${n}`,
        "Average Weight (kg)": parseFloat(avg.toFixed(2)),
      });
    }
    const idx = archivedPhases.findIndex((x) => x.id === bundle.id);
    const pn = bundle.phaseNumber ?? (idx >= 0 ? idx + 1 : 1);
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Weight Loss Buddy — Maintenance Phase (Archived)"],
      [""],
      ["Phase", `Phase ${pn}`],
      ["Archived at", new Date(bundle.archivedAt).toLocaleString()],
      ["Baseline weight (kg)", m.baselineWeightKg != null ? String(m.baselineWeightKg) : ""],
      ["Maintenance calories", m.maintenanceCalories != null ? String(m.maintenanceCalories) : ""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Weekly");
    XLSX.writeFile(wb, `WeightLossBuddy_Phase${pn}_Maintenance_${bundle.id.slice(0, 8)}.xlsx`);
  }, [archivedPhases]);

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-5xl mx-auto">
        <BackButton />
        
        {/* Welcome Section */}
        <div className="flex flex-col space-y-4 rounded-sm border border-primary/30 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 px-6 py-6 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-primary">Hey, {userName || 'there'}!</h1>
          <div className="pt-3">
            <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">Daily Motivation</p>
            <blockquote>
              <p className="text-base md:text-lg font-medium italic text-zinc-100">"{dailyQuote.quote}"</p>
              <footer className="text-sm text-zinc-400 mt-1 italic">— {dailyQuote.author}</footer>
            </blockquote>
          </div>
        </div>

        {/* Weight Loss Phase - Main Container */}
        <Card className="bg-background border-primary/20 shadow-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                <MaterialIcon name="gps_fixed" size="md" className="text-primary" />
                Weight Loss Phase
              </CardTitle>
              <Button
                onClick={() => setWeightLossMainCollapsed(prev => !prev)}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {weightLossMainCollapsed ? 'Expand All' : 'Collapse All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={weightLossMainCollapsed ? 'hidden' : 'space-y-6'}>

        {/* Dates and Starting Weight */}
        <div className="space-y-2">
            {/* Weight Loss Start Date and End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="startDate" className="text-sm font-medium">
                  Journey start (Acclimation Day 1):
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={weightLossStartDate}
                  min={earliestAllowedStartDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (earliestAllowedStartDate && val && val < earliestAllowedStartDate) {
                      alert(`Your new phase cannot start before your previous phase ended. The earliest allowed date is ${earliestAllowedStartDate.split("-").reverse().join("/")}.`);
                      return;
                    }
                    setWeightLossStartDate(val);
                  }}
                  readOnly={!!weightLossStartDate && completedWeeks.length > 0 && completedWeeks.length < 12}
                  className={`w-full h-9 ${weightLossStartDate && completedWeeks.length > 0 && completedWeeks.length < 12 ? 'bg-muted' : ''}`}
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="endDate" className="text-sm font-medium">
                    Weight loss end date:
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                      <p className="text-sm">
                        Last day of your 12-week Weight Loss Phase. Weight Loss Week 1 begins 28 days after your journey start (after Acclimation); this date is 12 weeks from that Week 1 start.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="endDate"
                  type="date"
                  value={weightLossEndDate}
                  readOnly
                  className="w-full h-9 bg-muted"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                  <Label htmlFor="startingWeight" className="text-sm font-medium flex items-center gap-1">
                  Starting Weight (kg):
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                        <p className="text-sm">This is the weight you entered, however, may differ to your 'actual' starting weight once you complete your 'Acclimation Phase'. Acclimation Phase is to help set the baseline for your weight loss journey.</p>
                      </TooltipContent>
                    </Tooltip>
                </Label>
                <Input
                  id="startingWeight"
                  type="text"
                  value={startingWeight}
                  readOnly
                  className="w-full h-9 bg-muted"
                  placeholder="0"
                />
              </div>
            </div>
        </div>

        {/* Current Stats Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <Card className="bg-background border-purple-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Estimated BMI</CardTitle>
                <MaterialIcon name="monitor_weight" size="sm" className="text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-500">
                  {tdeeValues?.currentBMI || calculateBMI().toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Body Mass Index</p>
              </CardContent>
            </Card>

            <Card className="bg-background border-teal-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Estimated Body %</CardTitle>
                <MaterialIcon name="trending_up" size="sm" className="text-teal-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-500">
                  {tdeeValues?.bodyFatPercentage ? `${tdeeValues.bodyFatPercentage}%` : `${calculateBodyFat().toFixed(1)}%`}
                </div>
                <p className="text-xs text-muted-foreground">Body fat percentage</p>
              </CardContent>
            </Card>

            <Card className="bg-background border-green-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Classification</CardTitle>
                <MaterialIcon name="emoji_events" size="sm" className="text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-green-500">
                  {tdeeValues?.classification || getClassification()}
                </div>
                <p className="text-xs text-muted-foreground">Health category</p>
              </CardContent>
            </Card>

            <Card className="bg-background border-indigo-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1">
                  Starting Weight
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                      <p className="text-sm">This is the weight you entered, however, may differ to your 'actual' starting weight once you complete your 'Acclimation Phase'. Acclimation Phase is to help set the baseline for your weight loss journey.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <MaterialIcon name="monitor_weight" size="sm" className="text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-500">
                  {(() => {
                    if (isAcclimationComplete()) {
                      const avg = getTotalAcclimationAverage();
                      if (avg > 0) return `${avg.toFixed(2)} kg`;
                    }
                    return tdeeValues?.currentWeight ? `${tdeeValues.currentWeight} kg` : `${weeklyAverages.weight.toFixed(2)} kg`;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAcclimationComplete() ? 'From 4-week acclimation average' : 'From TDEE Calculator'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-background border-red-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Weight to lose (Kg)</CardTitle>
                <MaterialIcon name="gps_fixed" size="sm" className="text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {tdeeValues?.weightToLose ? `${tdeeValues.weightToLose} kg` : `${getWeightToLose().toFixed(1)} kg`}
                </div>
                <p className="text-xs text-muted-foreground">To healthy range (max)</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Acclimation Phase Section */}
        <Card className="bg-background border-yellow-500/20 transition-all duration-300 hover:shadow-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="event" size="sm" className="text-yellow-500" />
                Acclimation Phase
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                    <p className="text-sm">The next 4 weeks will be your Acclimation Phase to set a baseline for your weight loss journey!</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all acclimation data?')) {
                      setAcclimationData({
                        week1: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
                        week2: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
                        week3: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
                        week4: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }
                      });
                      setIsWeek1Complete(false);
                      setIsWeek2Complete(false);
                      setIsWeek3Complete(false);
                      setIsWeek4Complete(false);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear All Data
                </Button>
                <Button
                  onClick={() => setAcclimationCollapsed(prev => !prev)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  {acclimationCollapsed ? 'Expand Section' : 'Collapse Section'}
                </Button>
              </div>
            </div>
            <CardDescription>
              Track weight over four weeks. Acclimation always comes before the Weight Loss Phase.
            </CardDescription>
          </CardHeader>
          <CardContent className={acclimationCollapsed ? 'hidden' : ''}>
            <div className="space-y-4">
              {/* Acclimation Calories and Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="acclimationCalories" className="text-sm font-medium">Acclimation Calories</Label>
                  <Input
                    id="acclimationCalories"
                    type="text"
                    inputMode="numeric"
                    value={acclimationCalories > 0 ? acclimationCalories.toLocaleString() : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                      setAcclimationCalories(parseFloat(rawValue) || 0);
                    }}
                    className="w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Auto-populated from TDEE Calculator"
                  />
                  <p className="text-xs text-muted-foreground">From Your TDEE Calculator - Starting Calorie Intake</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acclimationSteps" className="text-sm font-medium">Recommended Steps</Label>
                  <Input
                    id="acclimationSteps"
                    type="text"
                    inputMode="numeric"
                    value={acclimationSteps.toLocaleString()}
                    readOnly
                    className="w-full bg-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder={ACCLIMATION_BASE_STEPS.toLocaleString()}
                  />
                  <p className="text-xs text-muted-foreground">Baseline daily steps for Acclimation Phase (fixed)</p>
                </div>
              </div>
              {/* Header Row - Days across the top */}
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 font-semibold text-sm">
                    <div></div> {/* Empty cell for week labels */}
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Weekly Average (Kg)'].map((day) => (
                      <div key={day} className="text-center text-xs">{day}</div>
                    ))}
                  </div>
                  
                  {[1, 2, 3, 4].map((weekNumber) => {
                    const weekKey = `week${weekNumber}` as keyof typeof acclimationData;
                    const isComplete =
                      weekNumber === 1 ? isWeek1Complete :
                      weekNumber === 2 ? isWeek2Complete :
                      weekNumber === 3 ? isWeek3Complete :
                      isWeek4Complete;
                    const weekValues = Object.values(acclimationData[weekKey]).filter(v => v > 0);
                    const weekAvg = weekValues.length > 0 ? (weekValues.reduce((sum, v) => sum + v, 0) / weekValues.length).toFixed(2) : '';
                    return (
                      <React.Fragment key={`acclimation-week-${weekNumber}`}>
                        <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/30 mt-4">
                          <div className="font-medium text-sm">{`Week ${weekNumber} Weight (kg)`}</div>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <div key={`week-${weekNumber}-${day}`} className="flex justify-center">
                              <Input
                                type="number"
                                step="0.1"
                                max="200"
                                value={acclimationData[weekKey][day as keyof typeof acclimationData[typeof weekKey]] || ''}
                                onChange={(e) => handleAcclimationDataChange(weekKey, day, parseFloat(e.target.value) || 0)}
                                className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                disabled={isComplete}
                              />
                            </div>
                          ))}
                          <div className="flex justify-center">
                            <Input
                              type="number"
                              step="0.1"
                              value={weekAvg}
                              className="w-20 h-7 text-xs text-center bg-muted font-semibold"
                              readOnly
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-9 gap-2 items-center mt-2">
                          <div className="col-span-8 flex justify-center">
                            {!isComplete ? (
                              <Button onClick={() => handleCompleteAcclimationWeek(weekNumber as 1 | 2 | 3 | 4)} variant="outline" size="sm">
                                {`Complete Week ${weekNumber}`}
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 justify-center">
                                <Button
                                  onClick={() => setEditingAcclimationWeek({ weekNumber: weekNumber as 1 | 2 | 3 | 4, data: { ...acclimationData[weekKey] } })}
                                  variant="outline"
                                  size="sm"
                                >
                                  {`Edit Week ${weekNumber}`}
                                </Button>
                              </div>
                            )}
                          </div>
                          <div></div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Average Weight Row */}
                  <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 mt-4">
                    <div className="col-span-8 font-medium text-sm text-right pr-4">Average Weight (Kg)</div>
                    <div className="flex justify-center">
                      <Input
                        type="number"
                        step="0.01"
                        value={(() => {
                          const acclimationAvg = getTotalAcclimationAverage();
                          return acclimationAvg > 0 ? acclimationAvg.toFixed(2) : '';
                        })()}
                        className="w-20 h-7 text-xs text-center bg-muted font-semibold"
                        readOnly
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Week Overview - Hidden until acclimation is complete */}
        {isAcclimationComplete() && (
        <Card className="bg-background border-yellow-500/20 transition-all duration-300 hover:shadow-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="event" size="sm" className="text-primary" />
                Weight Loss Phase
              </CardTitle>
              <div className="flex items-center gap-2">
                {completedWeeks.length > 0 && (
                  <Button
                    onClick={handleDownloadReport}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <MaterialIcon name="download" size="sm" />
                    Download Report
                  </Button>
                )}
                <Button
                  onClick={() => setWeightLossCollapsed(prev => !prev)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  {weightLossCollapsed ? 'Expand Section' : 'Collapse Section'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={weightLossCollapsed ? 'hidden' : ''}>
            {/* Progress Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-background border-primary/20 cursor-help transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1">
                        Streak
                        <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground" />
                      </CardTitle>
                      <MaterialIcon name="bolt" size="sm" className="text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{currentStreak} days</div>
                      <p className="text-xs text-muted-foreground">Keep it up!</p>
                      {longestStreak > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Longest streak was {longestStreak} days</p>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Streak will only count if all fields are completed, 'Steps', 'Calories' and 'Weight'. Missing either will cause the streak to reset and start again when all 3 fields are completed.</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-background border-blue-500/20 cursor-help transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1">
                        Previous Week Average
                        <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground" />
                      </CardTitle>
                      <MaterialIcon name="monitor_weight" size="sm" className="text-blue-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-500">
                        {previousWeekComparison.average > 0 ? `${previousWeekComparison.average.toFixed(2)} kg` : 'No data'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {completedWeeks.length > 0 ? `Week ${completedWeeks.length} average` : 'Acclimation Phase average'}
                      </p>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Your average weight from your last week.</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="bg-background border-pink-500/20 cursor-help transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-foreground flex items-center gap-1">
                        Weight loss to date
                        <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground" />
                      </CardTitle>
                      <MaterialIcon name="trending_up" size="sm" className="text-pink-500" />
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const d = getWeightPhaseDeltaKg();
                        const eps = 1e-6;
                        let colorClass = "text-orange-500";
                        if (d < -eps) colorClass = "text-green-500";
                        if (d > eps) colorClass = "text-red-500";
                        let text = "0.00 kg";
                        if (d < -eps) text = `${d.toFixed(2)} kg`;
                        else if (d > eps) text = `+${d.toFixed(2)} kg`;
                        return (
                          <>
                            <div className={`text-2xl font-bold ${colorClass}`}>{text}</div>
                            <p className="text-xs text-muted-foreground">Since start date</p>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>This is your total weight change in your Weight Loss Phase vs your acclimation baseline: negative means loss, positive means gain, compared across completed weeks only.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Steps and Calories Debug Info – hidden from users (backend/data validation only) */}
            {SHOW_STEPS_CALORIES_DEBUG && stepDebugInfo && (
              <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
                <div className="flex items-center gap-2 mb-2">
                  <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Steps and Calories Debug</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Prev Avg:</span>{' '}
                    <span className="font-medium">{stepDebugInfo.prevAvg.toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Curr Avg:</span>{' '}
                    <span className="font-medium">{stepDebugInfo.currAvg.toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">% Change:</span>{' '}
                    <span className={`font-medium ${stepDebugInfo.percentChange <= -0.5 ? 'text-green-500' : 'text-red-500'}`}>
                      {stepDebugInfo.percentChange.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Steps increased:</span>{' '}
                    <span className={`font-medium ${stepDebugInfo.didIncrease ? 'text-red-500' : 'text-green-500'}`}>
                      {stepDebugInfo.didIncrease ? 'Yes (+1,000)' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Calories reduced:</span>{' '}
                    <span className={`font-medium ${stepDebugInfo.caloriesReduced ? 'text-red-500' : 'text-green-500'}`}>
                      {stepDebugInfo.caloriesReduced ? `Yes (${stepDebugInfo.prevCalories?.toLocaleString()} → ${stepDebugInfo.newCalories?.toLocaleString()})` : 'No'}
                    </span>
                  </div>
                  {stepDebugInfo.hitMinFloor && (
                    <div>
                      <span className="text-muted-foreground">Min floor hit:</span>{' '}
                      <span className="font-medium text-red-500">Yes ({userGender === 'female' ? '1,300' : '1,500'} cal)</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Rule: Steps increase by 1,000 if weight change &gt; −0.5% (not enough loss), max {MAX_RECOMMENDED_STEPS.toLocaleString()}. Once steps maxed, calories reduce by 200. Current: {recommendedSteps.toLocaleString()} steps, {(recommendedCalories > 0 ? recommendedCalories : acclimationCalories).toLocaleString()} cal.
                </p>
              </div>
            )}

            {/* Week Tracker */}
            <div className="mb-4 flex items-center gap-4">
              <h2 className="text-xl font-semibold">Current Week</h2>
              <Badge 
                variant="outline" 
                className={`text-sm ${journeyComplete ? 'bg-green-500 text-white border-green-500' : ''}`}
              >
                {journeyComplete ? '🎉 Journey Complete' : `Week ${Math.min(completedWeeks.length + 1, 12)} of 12`}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="space-y-4">
                  {/* Header Row - Days across the top */}
                  <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 font-semibold text-sm">
                    <div></div> {/* Empty cell for metric labels */}
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <div key={day} className="text-center text-xs">{day}</div>
                    ))}
                    <div className="text-center text-xs">Total</div>
                  </div>
              
              {/* Steps Row */}
              <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/30">
                <div className="font-medium text-sm">Steps</div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const stepsValue = weeklyData[day as keyof typeof weeklyData]?.steps || 0;
                  const meetsTarget = stepsValue >= recommendedSteps;
                  const hasValue = stepsValue > 0;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={stepsValue > 0 ? stepsValue.toLocaleString() : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                          handleWeeklyDataChange(day, 'steps', parseInt(rawValue, 10) || 0);
                        }}
                        className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                      <span className={`text-[10px] ${hasValue ? (meetsTarget ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                        {stepsValue.toLocaleString()}/{recommendedSteps.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-center">
                  <div className="w-16 h-7 flex items-center justify-center text-xs font-semibold bg-muted rounded">
                    {(() => {
                      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      const total = days.reduce((sum, day) => sum + (weeklyData[day as keyof typeof weeklyData]?.steps || 0), 0);
                      return total > 0 ? total.toLocaleString() : '0';
                    })()}
                  </div>
                </div>
              </div>

              {/* Calories Row */}
              <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/30">
                <div className="font-medium text-sm">Calories</div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const caloriesValue = weeklyData[day as keyof typeof weeklyData]?.calories || 0;
                  const targetCalories = recommendedCalories > 0 ? recommendedCalories : (acclimationCalories > 0 ? acclimationCalories : 2000);
                  // For calories: green if BELOW or equal to target (eating less is good), red if ABOVE target
                  const isUnderTarget = caloriesValue <= targetCalories;
                  const hasValue = caloriesValue > 0;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={caloriesValue > 0 ? caloriesValue.toLocaleString() : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                          handleWeeklyDataChange(day, 'calories', parseInt(rawValue, 10) || 0);
                        }}
                        onBlur={() => evaluateCalorieNudgeForDay(day)}
                        className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0"
                      />
                      <span className={`text-[10px] ${hasValue ? (isUnderTarget ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                        {caloriesValue.toLocaleString()}/{targetCalories.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-center">
                  <div className="w-16 h-7 flex items-center justify-center text-xs font-semibold bg-muted rounded">
                    {(() => {
                      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                      const total = days.reduce((sum, day) => sum + (weeklyData[day as keyof typeof weeklyData]?.calories || 0), 0);
                      return total > 0 ? total.toLocaleString() : '0';
                    })()}
                  </div>
                </div>
              </div>

              {/* Weight Row */}
              <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/30">
                <div className="font-medium text-sm">Weight (kg)</div>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const weightVal = weeklyData[day as keyof typeof weeklyData]?.weight || 0;
                  const isSingleDigit = weightVal > 0 && weightVal < 10;
                  return (
                    <div key={day} className="flex justify-center">
                      <Input
                        type="number"
                        step="0.1"
                        max="200"
                        value={weightVal || ''}
                        onChange={(e) => handleWeeklyDataChange(day, 'weight', parseFloat(e.target.value) || 0)}
                        className={`w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isSingleDigit ? 'border-red-500 border-2 text-red-500' : ''}`}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
                <div className="flex justify-center">
                  <div className="w-16 h-7 flex items-center justify-center text-xs font-semibold bg-muted rounded">
                    {weeklyAverages.weight > 0 ? weeklyAverages.weight.toFixed(2) : '0.00'} <span className="ml-1 text-[10px] text-muted-foreground">(avg)</span>
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="mt-4 flex gap-3 justify-center flex-wrap">
              {completedWeeks.some(w => w.weekNumber === completedWeeks.length + 1) ? (
                <div className="flex items-center gap-2">
                  <MaterialIcon name="check" size="md" className="text-green-500" />
                  <span className="text-sm font-medium text-green-500">Week Completed</span>
                </div>
              ) : (
                <Button
                  onClick={handleCompleteWeek}
                  className="w-full md:w-auto"
                >
                  Complete Week
                </Button>
              )}
              <Button
                onClick={handleClearWeekData}
                variant="outline"
                className="w-full md:w-auto"
              >
                Clear Week Data
              </Button>
            </div>

            {/* Completed Weeks History */}
            {completedWeeks.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Previous Weeks</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setAllWeeksExpanded(prev => !prev);
                      // Toggle all details elements
                      const detailsElements = document.querySelectorAll('.completed-week-details');
                      detailsElements.forEach((el) => {
                        (el as HTMLDetailsElement).open = !allWeeksExpanded;
                      });
                    }}
                  >
                    {allWeeksExpanded ? 'Collapse All' : 'Expand All'}
                  </Button>
                </div>
                {[...completedWeeks].reverse().map((week) => {
                  const originalIndex = completedWeeks.findIndex(w => w.weekNumber === week.weekNumber);
                  // Calculate week-on-week comparison
                  let previousAvg = 0;
                  if (originalIndex === 0) {
                    // First completed week compares to total Acclimation Phase average (Week 1-4)
                    previousAvg = getTotalAcclimationAverage();
                  } else {
                    // Compare to previous completed week
                    previousAvg = completedWeeks[originalIndex - 1].averages.weight;
                  }
                  const weekDifference = previousAvg - week.averages.weight;
                  let differenceColorClass = 'text-orange-500';
                  if (weekDifference > 0) differenceColorClass = 'text-green-500'; // Lost weight
                  if (weekDifference < 0) differenceColorClass = 'text-red-500'; // Gained weight

                  // Calculate collapsed header info - always show comparison (including Week 1 against Acclimation Phase)
                  const weekWeightChange = previousAvg - week.averages.weight;
                  
                  return (
                    <details key={week.weekNumber} className="group completed-week-details">
                      <summary className="cursor-pointer p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors list-none flex justify-between items-center">
                        <span className="font-medium text-sm">
                          Week {week.weekNumber} - {Number.isInteger(week.averages.weight) ? week.averages.weight.toLocaleString() : week.averages.weight.toFixed(2)} kg
                          <span className={`ml-2 ${weekWeightChange > 0 ? 'text-green-500' : weekWeightChange < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                            ({weekWeightChange > 0 ? 'Loss of ' : weekWeightChange < 0 ? 'Gain of ' : ''}{weekWeightChange > 0 ? '-' : '+'}{Number.isInteger(Math.abs(weekWeightChange)) ? Math.abs(weekWeightChange).toLocaleString() : Math.abs(weekWeightChange).toFixed(2)} kg)
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="mt-2 p-3 rounded-lg bg-muted/30 overflow-x-auto">
                        <div className="min-w-[700px] space-y-2">
                          {/* Week Header */}
                          <div className="grid grid-cols-9 gap-2 text-xs font-semibold">
                            <div></div>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                              <div key={day} className="text-center">{day}</div>
                            ))}
                            <div className="text-center">Average</div>
                          </div>
                          
                          {/* Steps */}
                          <div className="grid grid-cols-9 gap-2 text-xs">
                            <div className="font-medium">Steps</div>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                              <div key={day} className="text-center">
                                {(week.data[day as keyof typeof week.data]?.steps || 0).toLocaleString()}
                              </div>
                            ))}
                            <div className="text-center font-semibold bg-muted rounded px-1">
                              {Math.round(week.averages.steps).toLocaleString()}
                            </div>
                          </div>
                          
                          {/* Calories */}
                          <div className="grid grid-cols-9 gap-2 text-xs">
                            <div className="font-medium">Calories</div>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                              <div key={day} className="text-center">
                                {(week.data[day as keyof typeof week.data]?.calories || 0).toLocaleString()}
                              </div>
                            ))}
                            <div className="text-center font-semibold bg-muted rounded px-1">
                              {Math.round(week.averages.calories).toLocaleString()}
                            </div>
                          </div>
                          
                          {/* Weight */}
                          <div className="grid grid-cols-9 gap-2 text-xs">
                            <div className="font-medium">Weight</div>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                              <div key={day} className="text-center">
                                {(() => { const v = week.data[day as keyof typeof week.data]?.weight || 0; return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2); })()}
                              </div>
                            ))}
                            <div className="text-center font-semibold bg-muted rounded px-1">
                              {Number.isInteger(week.averages.weight) ? week.averages.weight.toLocaleString() : week.averages.weight.toFixed(2)}
                            </div>
                          </div>
                          
                          {/* Edit Button (center) and Week-on-Week Comparison (right) */}
                          <div className="flex justify-between items-center mt-3">
                            {/* Empty space for left side */}
                            <div className="w-1/3"></div>
                            
                            {/* Edit Week Button - Center */}
                            <div className="w-1/3 flex justify-center">
                              <Button
                                onClick={() => {
                                  setEditingWeek({
                                    weekNumber: week.weekNumber,
                                    data: { ...week.data }
                                  });
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Edit Week {week.weekNumber}
                              </Button>
                            </div>
                            
                            {/* Difference compared to last week - Bottom Right (show for all weeks including Week 1) */}
                            <div className="w-1/3 flex justify-end">
                              <div className="p-2 rounded-lg bg-muted/50 border border-border">
                                <p className="text-xs font-medium text-muted-foreground">Difference compared to last week</p>
                                <p className={`text-sm font-bold ${differenceColorClass}`}>
                                  {weekDifference > 0 ? '-' : weekDifference < 0 ? '+' : ''}
                                  {Number.isInteger(Math.abs(weekDifference)) ? Math.abs(weekDifference).toLocaleString() : Math.abs(weekDifference).toFixed(2)} kg
                                  {weekDifference > 0 && <span className="text-xs ml-1 font-normal">(lost)</span>}
                                  {weekDifference < 0 && <span className="text-xs ml-1 font-normal">(gained)</span>}
                                  {weekDifference === 0 && <span className="text-xs ml-1 font-normal">(no change)</span>}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  vs {week.weekNumber === 1 ? 'Acclimation Phase' : `Week ${week.weekNumber - 1}`}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Per-Week Steps and Calories Debug – hidden from users (backend/data validation only) */}
                          {SHOW_STEPS_CALORIES_DEBUG && week.stepDebug && (
                            <div className="mt-2 p-2 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/20">
                              <div className="flex items-center gap-2 mb-1">
                                <MaterialIcon name="help_outline" size="xs" className="text-muted-foreground" />
                                <span className="text-[10px] font-medium text-muted-foreground">Steps and Calories Debug - Week {week.weekNumber}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[10px]">
                                <div>
                                  <span className="text-muted-foreground">Prev Avg:</span>{' '}
                                  <span className="font-medium">{Number.isInteger(week.stepDebug.prevAvg) ? week.stepDebug.prevAvg.toLocaleString() : week.stepDebug.prevAvg.toFixed(2)} kg</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Curr Avg:</span>{' '}
                                  <span className="font-medium">{Number.isInteger(week.stepDebug.currAvg) ? week.stepDebug.currAvg.toLocaleString() : week.stepDebug.currAvg.toFixed(2)} kg</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">% Change:</span>{' '}
                                  <span className={`font-medium ${week.stepDebug.percentChange <= -0.5 ? 'text-green-500' : 'text-red-500'}`}>
                                    {Number.isInteger(week.stepDebug.percentChange) ? week.stepDebug.percentChange.toLocaleString() : week.stepDebug.percentChange.toFixed(2)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Steps increased:</span>{' '}
                                  <span className={`font-medium ${week.stepDebug.didIncrease ? 'text-red-500' : 'text-green-500'}`}>
                                    {week.stepDebug.didIncrease ? 'Yes (+1,000)' : 'No'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Step Target:</span>{' '}
                                  <span className="font-medium">{week.stepDebug.prevTarget.toLocaleString()} → {week.stepDebug.newTarget.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Calories reduced:</span>{' '}
                                  <span className={`font-medium ${week.stepDebug.caloriesReduced ? 'text-red-500' : 'text-green-500'}`}>
                                    {week.stepDebug.caloriesReduced 
                                      ? `Yes (${week.stepDebug.prevCalories?.toLocaleString()} → ${week.stepDebug.newCalories?.toLocaleString()})` 
                                      : 'No'}
                                  </span>
                                </div>
                                {week.stepDebug.hitMinFloor && (
                                  <div>
                                    <span className="text-muted-foreground">Min floor hit:</span>{' '}
                                    <span className="font-medium text-red-500">Yes</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

          </CardContent>
        </Card>

        {/* Maintenance Phase Section - only visible when journey is complete and user chose maintenance */}
        {maintenancePhase.active && (
          <Card className="bg-background border-green-500/20 transition-all duration-300 hover:shadow-primary">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MaterialIcon name="event" size="sm" className="text-green-500" />
                  Maintenance Phase
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {maintenancePhase.week4Complete && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={handleDownloadMaintenanceReport}
                    >
                      <MaterialIcon name="download" size="sm" className="mr-1" />
                      Download Report
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => setMaintenanceCollapsed((prev) => !prev)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    {maintenanceCollapsed ? "Expand All" : "Collapse All"}
                  </Button>
                </div>
              </div>
              <CardDescription className="mt-4">
                This is your 4 week maintenance phase that is designed to help you stabilize your current new weight and prepare you for your next weight loss journey.
              </CardDescription>
            </CardHeader>
            <CardContent className={maintenanceCollapsed ? 'hidden' : ''}>
              {/* Maintenance Phase Dates and Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="maintenanceStartDate" className="text-sm font-medium">
                      Maintenance Phase start date:
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                        <p className="text-sm">
                          Defaults to the day after the last day of Week 12 (the day after you complete the weight loss phase). You can change it here; the end date updates to stay 4 weeks long.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="maintenanceStartDate"
                    type="date"
                    value={maintenancePhase.startDate ? maintenancePhase.startDate.slice(0, 10) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const [yy, mm, dd] = v.split("-").map((x) => parseInt(x, 10));
                      const end = new Date(yy, mm - 1, dd);
                      end.setDate(end.getDate() + 27);
                      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
                      setMaintenancePhase((prev) => ({
                        ...prev,
                        startDate: v,
                        endDate: endStr,
                      }));
                    }}
                    className="w-full h-9"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Maintenance Phase end date:</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                        <p className="text-sm">Last day of your 4-week maintenance window (start date + 27 days).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="text"
                    value={
                      maintenancePhase.endDate
                        ? new Date(maintenancePhase.endDate).toLocaleDateString("en-GB")
                        : ""
                    }
                    readOnly
                    className="w-full h-9 bg-muted"
                    placeholder="dd/mm/yyyy"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Maintenance Weight (kg):</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-background text-foreground border-border">
                        <p className="text-sm">This is your weight from the end of your 12-week weight loss phase. This is the weight you will be maintaining during this phase.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="text"
                    value={
                      maintenanceDisplayWeightKg() > 0
                        ? maintenanceDisplayWeightKg().toFixed(2)
                        : ""
                    }
                    readOnly
                    className="w-full h-9 bg-muted"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Maintenance Stats */}
              <h2 className="text-xl font-semibold mb-4">Stats</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="bg-background border-purple-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">New Estimated BMI</CardTitle>
                    <MaterialIcon name="monitor_weight" size="sm" className="text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-500">
                      {calculateMaintenanceStats(maintenanceDisplayWeightKg()).bmi}
                    </div>
                    <p className="text-xs text-muted-foreground">Recalculated</p>
                  </CardContent>
                </Card>

                <Card className="bg-background border-teal-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">New Estimated BF %</CardTitle>
                    <MaterialIcon name="trending_up" size="sm" className="text-teal-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-teal-500">
                      {calculateMaintenanceStats(maintenanceDisplayWeightKg()).bodyFat}%
                    </div>
                    <p className="text-xs text-muted-foreground">Recalculated</p>
                  </CardContent>
                </Card>

                <Card className="bg-background border-green-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">Updated Classification</CardTitle>
                    <MaterialIcon name="emoji_events" size="sm" className="text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-green-500">
                      {calculateMaintenanceStats(maintenanceDisplayWeightKg()).classification}
                    </div>
                    <p className="text-xs text-muted-foreground">Health category</p>
                  </CardContent>
                </Card>

                <Card className="bg-background border-indigo-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-foreground">Maintenance baseline weight</CardTitle>
                    <MaterialIcon name="monitor_weight" size="sm" className="text-indigo-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-indigo-500">
                      {maintenanceDisplayWeightKg().toFixed(2)} kg
                    </div>
                    <p className="text-xs text-muted-foreground">From end of Week 12 (fixed for this phase)</p>
                  </CardContent>
                </Card>
              </div>

              {/* Maintenance Calories and Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Maintenance Calories</Label>
                  <Input
                    type="text"
                    value={maintenancePhase.maintenanceCalories > 0 ? maintenancePhase.maintenanceCalories.toLocaleString() : ''}
                    readOnly
                    className="w-full bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">This is the amount of calories you need to maintain your new weight.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Recommended Steps</Label>
                  <Input
                    type="text"
                    value="4,000"
                    readOnly
                    className="w-full bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Baseline daily steps for Maintenance Phase (fixed)</p>
                </div>
              </div>

              {/* Maintenance Weeks Tracking */}
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 font-semibold text-sm">
                    <div></div>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Weekly Average (Kg)'].map((day) => (
                      <div key={day} className="text-center text-xs">{day}</div>
                    ))}
                  </div>

                  {([1, 2, 3, 4] as const).map((weekNum) => {
                    const weekKey = `week${weekNum}` as keyof typeof maintenancePhase.weekData;
                    const completeKey = `week${weekNum}Complete` as keyof typeof maintenancePhase;
                    const isComplete = maintenancePhase[completeKey] as boolean;
                    const weekValues = Object.values(maintenancePhase.weekData[weekKey]).filter(v => v > 0);
                    const weekAvg = weekValues.length > 0 ? weekValues.reduce((s, v) => s + v, 0) / weekValues.length : 0;

                    return (
                      <React.Fragment key={weekNum}>
                        <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/30 mt-2">
                          <div className="font-medium text-sm">Week {weekNum} (kg)</div>
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <div key={`maint-w${weekNum}-${day}`} className="flex justify-center">
                              <Input
                                type="number"
                                step="0.1"
                                max="200"
                                value={maintenancePhase.weekData[weekKey][day as keyof typeof maintenancePhase.weekData[typeof weekKey]] || ''}
                                onChange={(e) => handleMaintenanceDataChange(weekKey, day, parseFloat(e.target.value) || 0)}
                                className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                disabled={isComplete}
                              />
                            </div>
                          ))}
                          <div className="flex justify-center">
                            <Input
                              type="number"
                              value={weekAvg > 0 ? weekAvg.toFixed(2) : ''}
                              className="w-20 h-7 text-xs text-center bg-muted font-semibold"
                              readOnly
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-9 gap-2 items-center mt-2">
                          <div className="col-span-8 flex justify-center">
                            {!isComplete ? (
                              <Button
                                type="button"
                                onClick={() => handleCompleteMaintenanceWeek(weekNum)}
                                variant="outline"
                                size="sm"
                              >
                                Complete Week {weekNum}
                              </Button>
                            ) : isComplete ? (
                              <div className="flex items-center gap-2 justify-center">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setEditingMaintenanceWeek({
                                      weekNumber: weekNum,
                                      data: { ...maintenancePhase.weekData[weekKey] }
                                    });
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  Edit Week {weekNum}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          <div></div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {archivedPhases.length > 0 && (
          <Card className="bg-background border-muted border transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <MaterialIcon name="inventory_2" size="sm" className="text-muted-foreground" />
                Archived Phases
              </CardTitle>
              <CardDescription>
                Expand a phase to review previous Acclimation, Weight Loss, and Maintenance Phases. Each section has its
                own report that is downloadable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {archivedPhases.map((b, idx) => {
                const num = b.phaseNumber ?? idx + 1;
                const acclAvg =
                  b.acclimationAverageKg ?? acclimationAvgFromBundleData(b.acclimationData);
                const endW = b.weightAtEndMaintenanceKg ?? b.maintenanceEndingAverageKg;
                const metrics = computeArchivedPhaseDisplayMetrics(b);
                const totalCalendarDays = metrics.totalCalendarSpanDays;
                const deltaKg =
                  acclAvg > 0 && endW != null && endW > 0 ? endW - acclAvg : null;
                const acclData = b.acclimationData as Record<string, Record<string, number>>;
                const wlRows = (Array.isArray(b.completedWeeks) ? b.completedWeeks : []) as ArchivedWlWeekRow[];
                const wlByNum = new Map(wlRows.map((w) => [w.weekNumber, w]));
                const hasWl = wlRows.length > 0;
                const mp = b.maintenancePhase as {
                  startDate?: string;
                  endDate?: string;
                  maintenanceCalories?: number;
                  weekData?: Record<string, Record<string, number>>;
                };

                const archivedWlPreviousAvg = (wn: number): number => {
                  if (wn <= 1) return acclAvg;
                  for (let p = wn - 1; p >= 1; p--) {
                    const pw = wlByNum.get(p);
                    if (pw) return pw.averages.weight;
                  }
                  return acclAvg;
                };

                const maintAllWeights: number[] = [];
                for (const wn of [1, 2, 3, 4] as const) {
                  const wd = mp.weekData?.[`week${wn}` as "week1" | "week2" | "week3" | "week4"] || {};
                  for (const d of WEEKDAYS_FULL) {
                    const v = wd[d as keyof typeof wd];
                    if (typeof v === "number" && v > 0) maintAllWeights.push(v);
                  }
                }
                const maintTotalAvg =
                  maintAllWeights.length > 0
                    ? maintAllWeights.reduce((s, v) => s + v, 0) / maintAllWeights.length
                    : 0;
                return (
                  <details key={b.id} className="group/ph rounded-lg border border-border p-2 open:bg-muted/5">
                    <summary className="cursor-pointer list-none flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between text-left p-2">
                      <div className="space-y-2 pr-2 min-w-0">
                        <div className="font-semibold text-foreground flex flex-wrap items-baseline gap-x-1 gap-y-1">
                          <span>Phase {num}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-green-600 font-semibold">COMPLETED</span>
                        </div>
                        <div className="text-sm text-foreground space-y-1">
                          {metrics.acclimationStartIso && (
                            <div>
                              Start Date = <span className="font-medium tabular-nums">{metrics.acclimationStartIso.split("-").reverse().join("/")}</span>
                            </div>
                          )}
                          {metrics.maintenanceEndIso && (
                            <div>
                              End Date = <span className="font-medium tabular-nums">{metrics.maintenanceEndIso.split("-").reverse().join("/")}</span>
                            </div>
                          )}
                          {totalCalendarDays != null && (
                            <div>
                              Total Days = <span className="font-medium tabular-nums">{totalCalendarDays} days</span>
                            </div>
                          )}
                          {endW != null && endW > 0 && (
                            <div>
                              End Weight = <span className="font-medium tabular-nums">{endW.toFixed(2)} kg</span>
                            </div>
                          )}
                          {deltaKg != null && (
                            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
                              <span>Total Weight Loss/Gained =</span>
                              {deltaKg < -1e-6 ? (
                                <>
                                  <span className="font-medium tabular-nums text-green-600">
                                    {deltaKg.toFixed(2)} kg
                                  </span>
                                  <span className="text-green-600 font-medium">(Loss)</span>
                                </>
                              ) : deltaKg > 1e-6 ? (
                                <>
                                  <span className="font-medium tabular-nums text-red-600">
                                    +{deltaKg.toFixed(2)} kg
                                  </span>
                                  <span className="text-red-600 font-medium">(Gained)</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium tabular-nums">0.00 kg</span>
                                  <span className="text-orange-500 font-medium">(+0 kg)</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <MaterialIcon
                        name="expand_more"
                        size="sm"
                        className="text-muted-foreground shrink-0 transition-transform group-open/ph:rotate-180 mt-0.5"
                      />
                    </summary>

                    <div className="mt-3 space-y-3 pl-1 border-l-2 border-muted ml-2">
                      {/* Archived — Acclimation */}
                      <details className="group/accl rounded-lg border border-yellow-500/25 bg-muted/10 open:bg-muted/20">
                        <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-medium">
                          <span className="flex items-center gap-2 min-w-0">
                            <MaterialIcon
                              name="expand_more"
                              size="sm"
                              className="text-muted-foreground shrink-0 transition-transform group-open/accl:rotate-180"
                            />
                            Acclimation Phase — 4 weeks
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadArchivedAcclimation(b);
                            }}
                          >
                            <MaterialIcon name="download" size="sm" className="mr-1" />
                            Download report
                          </Button>
                        </summary>
                        <div className="px-3 pb-3 overflow-x-auto">
                          <div className="min-w-[900px] space-y-3">
                            <div className="grid grid-cols-9 gap-2 items-center p-2 rounded-lg bg-muted/50 font-semibold text-xs">
                              <div />
                              {WEEKDAYS_FULL.map((day) => (
                                <div key={day} className="text-center">
                                  {day.slice(0, 3)}
                                </div>
                              ))}
                              <div className="text-center">Avg</div>
                            </div>
                            {([1, 2, 3, 4] as const).map((wn) => {
                              const weekKey = `week${wn}` as keyof typeof acclData;
                              const row = acclData?.[weekKey] || {};
                              const vals = WEEKDAYS_FULL.map((d) => row[d] || 0).filter((v) => v > 0);
                              const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                              return (
                                <div key={wn} className="grid grid-cols-9 gap-2 items-center p-2 rounded-lg bg-muted/30">
                                  <div className="font-medium text-xs">Week {wn}</div>
                                  {WEEKDAYS_FULL.map((day) => (
                                    <div key={day} className="flex justify-center">
                                      <Input
                                        readOnly
                                        className="w-14 h-7 text-xs text-center bg-muted"
                                        value={row[day] ? String(row[day]) : ""}
                                        placeholder="—"
                                      />
                                    </div>
                                  ))}
                                  <div className="flex justify-center">
                                    <Input
                                      readOnly
                                      className="w-16 h-7 text-xs text-center bg-muted font-semibold"
                                      value={avg > 0 ? avg.toFixed(2) : ""}
                                      placeholder="—"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 mt-2">
                              <div className="col-span-8 font-medium text-sm text-right pr-2">
                                Total Average (Kg)
                              </div>
                              <div className="flex justify-center">
                                <Input
                                  readOnly
                                  className="w-20 h-8 text-xs text-center bg-muted font-semibold"
                                  value={acclAvg > 0 ? acclAvg.toFixed(2) : ""}
                                  placeholder="—"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Archived — Weight Loss (12 collapsible weeks) */}
                      <details className="group/wl rounded-lg border border-primary/25 bg-muted/10 open:bg-muted/20">
                        <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-medium">
                          <span className="flex items-center gap-2 min-w-0">
                            <MaterialIcon
                              name="expand_more"
                              size="sm"
                              className="text-muted-foreground shrink-0 transition-transform group-open/wl:rotate-180"
                            />
                            Weight Loss Phase — 12 weeks
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={!hasWl}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadArchivedWeightLoss(b);
                            }}
                          >
                            <MaterialIcon name="download" size="sm" className="mr-1" />
                            Download report
                          </Button>
                        </summary>
                        <div className="px-3 pb-3 space-y-2">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((wn) => {
                            const week = wlByNum.get(wn);
                            const prevAvg = archivedWlPreviousAvg(wn);
                            const weekWeightChange = week ? prevAvg - week.averages.weight : 0;
                            return (
                              <details
                                key={wn}
                                className="group/wk rounded border border-border/80 bg-background/50 open:bg-muted/20"
                              >
                                <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-2 text-sm font-medium">
                                  <span className="flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0">
                                    <MaterialIcon
                                      name="expand_more"
                                      size="sm"
                                      className="text-muted-foreground shrink-0 transition-transform group-open/wk:rotate-180 text-base"
                                    />
                                    {week ? (
                                      <>
                                        <span>
                                          Week {wn} -{" "}
                                          {Number.isInteger(week.averages.weight)
                                            ? week.averages.weight.toLocaleString()
                                            : week.averages.weight.toFixed(2)}{" "}
                                          kg
                                        </span>
                                        <span
                                          className={
                                            weekWeightChange > 0
                                              ? "text-green-500"
                                              : weekWeightChange < 0
                                                ? "text-red-500"
                                                : "text-orange-500"
                                          }
                                        >
                                          (
                                          {weekWeightChange > 0
                                            ? "Loss of "
                                            : weekWeightChange < 0
                                              ? "Gain of "
                                              : ""}
                                          {weekWeightChange > 0
                                            ? "-"
                                            : weekWeightChange < 0
                                              ? "+"
                                              : "+"}
                                          {Number.isInteger(Math.abs(weekWeightChange))
                                            ? Math.abs(weekWeightChange).toLocaleString()
                                            : Math.abs(weekWeightChange).toFixed(2)}{" "}
                                          kg)
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground font-normal">
                                        Week {wn} — no data
                                      </span>
                                    )}
                                  </span>
                                </summary>
                                <div className="pl-2 pb-2 overflow-x-auto">
                                  <div className="min-w-[700px] space-y-2">
                                    <div className="grid grid-cols-9 gap-2 text-xs font-semibold px-1">
                                      <div />
                                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                        <div key={d} className="text-center">
                                          {d}
                                        </div>
                                      ))}
                                      <div className="text-center">Avg</div>
                                    </div>
                                    <div className="grid grid-cols-9 gap-2 text-xs">
                                      <div className="font-medium">Steps</div>
                                      {WEEKDAYS_FULL.map((day) => (
                                        <div key={day} className="text-center tabular-nums">
                                          {week?.data?.[day]?.steps
                                            ? Math.round(week.data[day].steps).toLocaleString()
                                            : "—"}
                                        </div>
                                      ))}
                                      <div className="text-center font-semibold bg-muted/50 rounded px-1 tabular-nums">
                                        {week ? Math.round(week.averages.steps).toLocaleString() : "—"}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-9 gap-2 text-xs">
                                      <div className="font-medium">Calories</div>
                                      {WEEKDAYS_FULL.map((day) => (
                                        <div key={day} className="text-center tabular-nums">
                                          {week?.data?.[day]?.calories
                                            ? Math.round(week.data[day].calories).toLocaleString()
                                            : "—"}
                                        </div>
                                      ))}
                                      <div className="text-center font-semibold bg-muted/50 rounded px-1 tabular-nums">
                                        {week ? Math.round(week.averages.calories).toLocaleString() : "—"}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-9 gap-2 text-xs">
                                      <div className="font-medium">Weight</div>
                                      {WEEKDAYS_FULL.map((day) => (
                                        <div key={day} className="text-center tabular-nums">
                                          {week?.data?.[day]?.weight
                                            ? Number.isInteger(week.data[day].weight)
                                              ? week.data[day].weight
                                              : week.data[day].weight.toFixed(2)
                                            : "—"}
                                        </div>
                                      ))}
                                      <div className="text-center font-semibold bg-muted/50 rounded px-1 tabular-nums">
                                        {week
                                          ? Number.isInteger(week.averages.weight)
                                            ? week.averages.weight
                                            : week.averages.weight.toFixed(2)
                                          : "—"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </details>

                      {/* Archived — Maintenance */}
                      <details className="group/maint rounded-lg border border-green-500/25 bg-muted/10 open:bg-muted/20">
                        <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-3 text-sm font-medium">
                          <span className="flex items-center gap-2 min-w-0">
                            <MaterialIcon
                              name="expand_more"
                              size="sm"
                              className="text-muted-foreground shrink-0 transition-transform group-open/maint:rotate-180"
                            />
                            Maintenance Phase — 4 weeks
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDownloadArchivedMaintenance(b);
                            }}
                          >
                            <MaterialIcon name="download" size="sm" className="mr-1" />
                            Download report
                          </Button>
                        </summary>
                        <div className="px-3 pb-3 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Start date</p>
                              <Input
                                readOnly
                                className="bg-muted h-9 text-sm"
                                value={
                                  (metrics.maintenanceStartIso || mp.startDate)
                                    ? new Date(
                                        (metrics.maintenanceStartIso || mp.startDate)!.slice(0, 10) + "T12:00:00"
                                      ).toLocaleDateString("en-GB")
                                    : ""
                                }
                                placeholder="—"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">End date</p>
                              <Input
                                readOnly
                                className="bg-muted h-9 text-sm"
                                value={
                                  (metrics.maintenanceEndIso || mp.endDate)
                                    ? new Date(
                                        (metrics.maintenanceEndIso || mp.endDate)!.slice(0, 10) + "T12:00:00"
                                      ).toLocaleDateString("en-GB")
                                    : ""
                                }
                                placeholder="—"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Maintenance calories</p>
                              <Input
                                readOnly
                                className="bg-muted h-9 text-sm"
                                value={
                                  mp.maintenanceCalories && mp.maintenanceCalories > 0
                                    ? mp.maintenanceCalories.toLocaleString()
                                    : ""
                                }
                                placeholder="—"
                              />
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <div className="min-w-[900px] space-y-2">
                              <div className="grid grid-cols-9 gap-2 items-center p-2 rounded-lg bg-muted/50 font-semibold text-xs">
                                <div />
                                {WEEKDAYS_FULL.map((day) => (
                                  <div key={day} className="text-center">
                                    {day.slice(0, 3)}
                                  </div>
                                ))}
                                <div className="text-center">Avg</div>
                              </div>
                              {([1, 2, 3, 4] as const).map((wn) => {
                                const weekKey = `week${wn}`;
                                const wd = mp.weekData?.[weekKey] || {};
                                const vals = WEEKDAYS_FULL.map((d) => wd[d] || 0).filter((v) => v > 0);
                                const wavg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                                return (
                                  <div
                                    key={wn}
                                    className="grid grid-cols-9 gap-2 items-center p-2 rounded-lg bg-muted/30"
                                  >
                                    <div className="font-medium text-xs">Week {wn} (kg)</div>
                                    {WEEKDAYS_FULL.map((day) => (
                                      <div key={day} className="flex justify-center">
                                        <Input
                                          readOnly
                                          className="w-14 h-7 text-xs text-center bg-muted"
                                          value={wd[day] ? String(wd[day]) : ""}
                                          placeholder="—"
                                        />
                                      </div>
                                    ))}
                                    <div className="flex justify-center">
                                      <Input
                                        readOnly
                                        className="w-16 h-7 text-xs text-center bg-muted font-semibold"
                                        value={wavg > 0 ? wavg.toFixed(2) : ""}
                                        placeholder="—"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="grid grid-cols-9 gap-2 items-center p-3 rounded-lg bg-muted/50 mt-2">
                                <div className="col-span-8 font-medium text-sm text-right pr-2">
                                  Total Average (Kg)
                                </div>
                                <div className="flex justify-center">
                                  <Input
                                    readOnly
                                    className="w-20 h-8 text-xs text-center bg-muted font-semibold"
                                    value={maintTotalAvg > 0 ? maintTotalAvg.toFixed(2) : ""}
                                    placeholder="—"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </details>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Clear All Data Button */}
        {isAcclimationComplete() && (
          <div className="flex justify-center mt-6">
            <Button
              type="button"
              onClick={() => setShowClearAllStep1(true)}
              variant="destructive"
              size="lg"
            >
              Clear All Dashboard Data
            </Button>
          </div>
        )}

        {/* Single Digit Weight Dialog */}
        <AlertDialog open={showSingleDigitWeightDialog} onOpenChange={setShowSingleDigitWeightDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="warning" size="sm" className="text-red-500" />
                Inconsistent Value Detected
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70">
                You have entered a value that is inconsistent on {singleDigitWeightDays.join(', ')}. A single digit weight value does not seem right. Please review and amend. Thank you!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex justify-center">
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowSingleDigitWeightDialog(false)}>
                Ok
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Missing Weight Data Dialog */}
        <AlertDialog open={showMissingWeightDialog} onOpenChange={setShowMissingWeightDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="warning" size="sm" className="text-yellow-500" />
                Missing Weight Data
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70">
                There is missing data for weight on: {missingWeightDays.join(', ')}. Weeks must contain 7 weight inputs at bare minimum. Please enter valid weight values for all 7 days before completing the week.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex justify-center">
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowMissingWeightDialog(false)}>
                Ok
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Weight Anomaly Dialog */}
        <AlertDialog open={showWeightAnomalyDialog} onOpenChange={setShowWeightAnomalyDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="warning" size="sm" className="text-yellow-500" />
                Possible Data Entry Error
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70">
                On {anomalyWeightDay.day}, the value entered is {anomalyWeightDay.direction} than {anomalyWeightDay.diff}kg compared to the rest of the week. This appears to be an error. Do you want to amend?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                setShowWeightAnomalyDialog(false);
              }}>
                Yes
              </AlertDialogAction>
              <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border" onClick={() => {
                setShowWeightAnomalyDialog(false);
                // Proceed with saving - user chose not to amend
                if (hasMissingWeekData()) {
                  setShowIncompleteWeekDialog(true);
                } else {
                  completeWeek();
                }
              }}>
                No
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showIncompleteWeekDialog} onOpenChange={setShowIncompleteWeekDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <MaterialIcon name="warning" size="sm" className="text-yellow-500" />
                Incomplete Week Data
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70">
                You are completing the week where there is missing or incomplete data for 'Steps', 'Calories', or 'Weight'. If you proceed, your current streak will end and this can result in inaccurate data. Are you sure you want to complete your week?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">No</AlertDialogCancel>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                completeWeek();
                setShowIncompleteWeekDialog(false);
              }}>
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Welcome Dialog */}
        <AlertDialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Welcome {userName}!</AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70">
                The 'Dashboard' provides you with a tracking overview in an easy to view display. So that we get the most accurate data, please ensure you are consistent with your tracking.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                setShowWelcomeDialog(false);
                const hasSeenAcclimation = localStorage.getItem('dashboardAcclimationShown') === 'true';
                if (!hasSeenAcclimation && !isWeek1Complete && !isWeek2Complete && !isWeek3Complete && !isWeek4Complete) {
                  setShowAcclimationDialog(true);
                  localStorage.setItem('dashboardAcclimationShown', 'true');
                  if (user?.id) setUserPref(user.id, "dashboardAcclimationShown", "true");
                } else {
                  const showReadyToStartFlag = localStorage.getItem('showReadyToStartPopup');
                  const hasSeenReadyToStart = localStorage.getItem('readyToStartShown') === 'true';
                  if (showReadyToStartFlag === 'true' && !hasSeenReadyToStart) {
                    setShowReadyToStartDialog(true);
                    localStorage.removeItem('showReadyToStartPopup');
                  } else if (!hasSeenReadyToStart && journey && !resolveJourneyAnchorFromRow(journey)) {
                    setShowReadyToStartDialog(true);
                  }
                }
              }}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Acclimation Phase Dialog */}
        <AlertDialog open={showAcclimationDialog} onOpenChange={setShowAcclimationDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-primary">Acclimation Phase</AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70 space-y-3">
                <p>Starting off with the 'Acclimation Phase', this is to build a baseline of your current weight and step count.</p>
                <p>For the next 4 weeks, please ensure you eat at the 'Acclimate Calories' and do the amount of steps shown in 'Acclimation Steps'.</p>
                <p>At the end of the 4 weeks, you will commence your 12 week plan and open a whole new world to losing weight quickly and easily!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
                setShowAcclimationDialog(false);
                const showReadyToStartFlag = localStorage.getItem('showReadyToStartPopup');
                const hasSeenReadyToStart = localStorage.getItem('readyToStartShown') === 'true';
                if (showReadyToStartFlag === 'true' && !hasSeenReadyToStart) {
                  setShowReadyToStartDialog(true);
                  localStorage.removeItem('showReadyToStartPopup');
                } else if (!hasSeenReadyToStart && journey && !resolveJourneyAnchorFromRow(journey)) {
                  setShowReadyToStartDialog(true);
                }
              }}>Let's Get Started!</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Acclimation Complete Dialog */}
        <AlertDialog open={showAcclimationCompleteDialog} onOpenChange={setShowAcclimationCompleteDialog}>
          <AlertDialogContent className="bg-background text-foreground border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-primary flex items-center gap-2">
                <MaterialIcon name="emoji_events" size="md" />
                Congratulations!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foreground/70 space-y-3">
                <p>Congratulations on completing your Acclimation Phase. This sets the baseline and now you are now ready to commence your 12 week weight loss journey.</p>
                <p>Your 'Progress' is now available for you to start tracking! Good luck and stay consistent. Consistency is key!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">Let's Go!</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Week Dialog */}
        <AlertDialog open={!!editingWeek} onOpenChange={(open) => !open && setEditingWeek(null)}>
          <AlertDialogContent className="bg-background text-foreground border-border max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Edit Week {editingWeek?.weekNumber}
              </AlertDialogTitle>
            </AlertDialogHeader>
            {editingWeek && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px] space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-2 text-xs font-semibold">
                      <div></div>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center">{day}</div>
                      ))}
                    </div>
                    
                    {/* Steps */}
                    <div className="grid grid-cols-8 gap-2 items-center p-2 bg-muted/30 rounded">
                      <div className="font-medium text-sm">Steps</div>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex justify-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={editingWeek.data[day as keyof typeof editingWeek.data]?.steps > 0 ? editingWeek.data[day as keyof typeof editingWeek.data]?.steps.toLocaleString() : ''}
                            onChange={(e) => {
                              const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                              setEditingWeek({
                                ...editingWeek,
                                data: {
                                  ...editingWeek.data,
                                  [day]: {
                                    ...editingWeek.data[day as keyof typeof editingWeek.data],
                                    steps: parseInt(rawValue) || 0
                                  }
                                }
                              });
                            }}
                            className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    
                    {/* Calories */}
                    <div className="grid grid-cols-8 gap-2 items-center p-2 bg-muted/30 rounded">
                      <div className="font-medium text-sm">Calories</div>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex justify-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={editingWeek.data[day as keyof typeof editingWeek.data]?.calories > 0 ? editingWeek.data[day as keyof typeof editingWeek.data]?.calories.toLocaleString() : ''}
                            onChange={(e) => {
                              const rawValue = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                              setEditingWeek({
                                ...editingWeek,
                                data: {
                                  ...editingWeek.data,
                                  [day]: {
                                    ...editingWeek.data[day as keyof typeof editingWeek.data],
                                    calories: parseInt(rawValue) || 0
                                  }
                                }
                              });
                            }}
                            className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    
                    {/* Weight */}
                    <div className="grid grid-cols-8 gap-2 items-center p-2 bg-muted/30 rounded">
                      <div className="font-medium text-sm">Weight (kg)</div>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex justify-center">
                          <Input
                            type="number"
                            step="0.1"
                            max="200"
                            value={editingWeek.data[day as keyof typeof editingWeek.data]?.weight || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setEditingWeek({
                                ...editingWeek,
                                data: {
                                  ...editingWeek.data,
                                  [day]: {
                                    ...editingWeek.data[day as keyof typeof editingWeek.data],
                                    weight: value > 200 ? 200 : value
                                  }
                                }
                              });
                            }}
                            className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  if (editingWeek) {
                    const weekNum = editingWeek.weekNumber;
                    // Remove ONLY the selected week, shift subsequent weeks down by 1
                    const kept = completedWeeks.filter(w => w.weekNumber !== weekNum);
                    const renumbered = kept
                      .map(w => w.weekNumber > weekNum ? { ...w, weekNumber: w.weekNumber - 1 } : w)
                      .sort((a, b) => a.weekNumber - b.weekNumber);

                    setCompletedWeeks(renumbered);

                    // Targets will be recalculated automatically by the completedWeeks useEffect

                    // Reset current week data so user can re-enter
                    setWeeklyData({
                      Monday: { steps: 0, calories: 0, weight: 0 },
                      Tuesday: { steps: 0, calories: 0, weight: 0 },
                      Wednesday: { steps: 0, calories: 0, weight: 0 },
                      Thursday: { steps: 0, calories: 0, weight: 0 },
                      Friday: { steps: 0, calories: 0, weight: 0 },
                      Saturday: { steps: 0, calories: 0, weight: 0 },
                      Sunday: { steps: 0, calories: 0, weight: 0 }
                    });
                    // If journey was complete, un-complete it since we now have fewer weeks
                    if (journeyComplete) {
                      setJourneyComplete(false);
                      localStorage.removeItem('dashboardJourneyComplete');
                    }
                    setEditingWeek(null);
                  }
                }}
              >
                Delete Week Data
              </Button>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  if (editingWeek) {
                    setCompletedWeeks(prev =>
                      prev.map(w =>
                        w.weekNumber === editingWeek.weekNumber
                          ? {
                              ...w,
                              data: editingWeek.data,
                              averages: {
                                steps: Object.values(editingWeek.data)
                                  .filter(d => d.steps > 0)
                                  .reduce((sum, d) => sum + d.steps, 0) / 
                                  Object.values(editingWeek.data).filter(d => d.steps > 0).length || 0,
                                calories: Object.values(editingWeek.data)
                                  .filter(d => d.calories > 0)
                                  .reduce((sum, d) => sum + d.calories, 0) / 
                                  Object.values(editingWeek.data).filter(d => d.calories > 0).length || 0,
                                weight: Object.values(editingWeek.data)
                                  .filter(d => d.weight > 0)
                                  .reduce((sum, d) => sum + d.weight, 0) / 
                                  Object.values(editingWeek.data).filter(d => d.weight > 0).length || 0,
                              }
                            }
                          : w
                      )
                    );
                    setEditingWeek(null);
                  }
                }}
              >
                Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Acclimation Phase Edit Dialog */}
        <AlertDialog open={!!editingAcclimationWeek} onOpenChange={(open) => !open && setEditingAcclimationWeek(null)}>
          <AlertDialogContent className="bg-background text-foreground border-border max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Edit Acclimation Phase - Week {editingAcclimationWeek?.weekNumber}
              </AlertDialogTitle>
            </AlertDialogHeader>
            {editingAcclimationWeek && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px] space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-2 text-xs font-semibold">
                      <div></div>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center">{day}</div>
                      ))}
                    </div>
                    
                    {/* Weight Row */}
                    <div className="grid grid-cols-8 gap-2 items-center p-2 bg-muted/30 rounded">
                      <div className="font-medium text-sm">Weight (kg)</div>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex justify-center">
                          <Input
                            type="number"
                            step="0.1"
                            max="200"
                            value={editingAcclimationWeek.data[day as keyof typeof editingAcclimationWeek.data] || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setEditingAcclimationWeek({
                                ...editingAcclimationWeek,
                                data: {
                                  ...editingAcclimationWeek.data,
                                  [day]: value > 200 ? 200 : value
                                }
                              });
                            }}
                            className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  if (editingAcclimationWeek) {
                    // Update the acclimation week with the edited data
                    const weekKey = `week${editingAcclimationWeek.weekNumber}` as keyof typeof acclimationData;
                    setAcclimationData(prev => ({
                      ...prev,
                      [weekKey]: editingAcclimationWeek.data
                    }));
                    setEditingAcclimationWeek(null);
                  }
                }}
              >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maintenance Phase Edit Dialog */}
      <AlertDialog open={!!editingMaintenanceWeek} onOpenChange={(open) => !open && setEditingMaintenanceWeek(null)}>
        <AlertDialogContent className="bg-background text-foreground border-border max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Edit Maintenance Phase - Week {editingMaintenanceWeek?.weekNumber}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {editingMaintenanceWeek && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-[700px] space-y-2">
                  <div className="grid grid-cols-8 gap-2 text-xs font-semibold">
                    <div></div>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <div key={day} className="text-center">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-2 items-center p-2 bg-muted/30 rounded">
                    <div className="font-medium text-sm">Weight (kg)</div>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <div key={day} className="flex justify-center">
                        <Input
                          type="number"
                          step="0.1"
                          max="200"
                          value={editingMaintenanceWeek.data[day as keyof typeof editingMaintenanceWeek.data] || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setEditingMaintenanceWeek({
                              ...editingMaintenanceWeek,
                              data: {
                                ...editingMaintenanceWeek.data,
                                [day]: value > 200 ? 200 : value
                              }
                            });
                          }}
                          className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-background text-foreground hover:bg-muted border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (editingMaintenanceWeek) {
                  const weekKey = `week${editingMaintenanceWeek.weekNumber}` as keyof typeof maintenancePhase.weekData;
                  setMaintenancePhase(prev => ({
                    ...prev,
                    weekData: {
                      ...prev.weekData,
                      [weekKey]: editingMaintenanceWeek.data
                    }
                  }));
                  setEditingMaintenanceWeek(null);
                }
              }}
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReadyToStartDialog} onOpenChange={setShowReadyToStartDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Ready to Start?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-4">
              <p>Please enter your journey start date — Day 1 of your 4-week Acclimation Phase. Your 12-week Weight Loss Phase begins 28 days later.</p>
              {earliestAllowedStartDate && (
                <p className="text-sm text-yellow-500">Your previous phase has been completed. The earliest you can start your new phase is {earliestAllowedStartDate.split("-").reverse().join("/")}.</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="readyToStartDate" className="text-sm font-medium text-foreground">Journey start (Acclimation Day 1)</Label>
                <div className="flex gap-2">
                  <Input
                    id="readyToStartDate"
                    type="date"
                    className="flex-1"
                    min={earliestAllowedStartDate || undefined}
                    value={weightLossStartDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (earliestAllowedStartDate && val < earliestAllowedStartDate) {
                        alert(`Your new phase cannot start before your previous phase ended. The earliest allowed date is ${earliestAllowedStartDate.split("-").reverse().join("/")}.`);
                        return;
                      }
                      setWeightLossStartDate(val);
                      localStorage.setItem('dashboardWeightLossStartDate', val);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => {
                      const today = formatLocalIsoDate(new Date());
                      if (earliestAllowedStartDate && today < earliestAllowedStartDate) {
                        alert(`Today's date is before your previous phase ended. The earliest allowed date is ${earliestAllowedStartDate.split("-").reverse().join("/")}.`);
                        return;
                      }
                      setWeightLossStartDate(today);
                      localStorage.setItem('dashboardWeightLossStartDate', today);
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={(e) => {
                if (!weightLossStartDate) {
                  e.preventDefault();
                  alert("Please choose your journey start date (Day 1 of Acclimation) to continue.");
                  return;
                }
                localStorage.setItem("dashboardWeightLossStartDate", weightLossStartDate);
                localStorage.setItem("readyToStartShown", "true");
                if (user?.id) void setUserPref(user.id, "readyToStartShown", "true");
              }}
            >
              Let's Go!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Low Calorie Headroom Safety Warning */}
      <AlertDialog open={showLowCalorieHeadroomDialog} onOpenChange={setShowLowCalorieHeadroomDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="warning" size="sm" className="text-yellow-500" />
              Calorie Headroom Notice
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3">
              <p>Your starting 'Acclimation Calories' are almost within the minimum floor of calories, meaning, you are almost at the app's allowable calorie deficit. Once you reach your minimum floor calories, your calories will not go any lower. This is to prevent you from going too low.</p>
              <p>Please contact us for support or speak to your local doctor for advice.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Minimum Calorie Safety Dialog */}
      <AlertDialog open={showMinCalorieDialog} onOpenChange={setShowMinCalorieDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="warning" size="sm" className="text-red-500" />
              Minimum Calorie Limit Reached
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3">
              <p>You have reached the lowest end for daily caloric intake. Eating anything less is not advised and can be dangerous. Please consult your doctor.</p>
              <p>From here, the app will no longer reduce calories or increase steps. Please continue with the remaining weeks and commence a 'Maintenance Phase' to restart your weight loss journey.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Steps / Calories change popup – blurred backdrop, highlights new targets */}
      {showStepsCaloriesChangePopup && stepsCaloriesChangeInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            aria-hidden
            onClick={() => {
              if (stepsCaloriesChangeInfo?.hitMinFloor) setTimeout(() => setShowMinCalorieDialog(true), 200);
              setShowStepsCaloriesChangePopup(false);
              setStepsCaloriesChangeInfo(null);
            }}
          />
          <div
            className="relative z-10 bg-card border border-border rounded-xl shadow-2xl p-6 max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-200"
            role="dialog"
            aria-labelledby="steps-calories-change-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="steps-calories-change-title" className="text-lg font-semibold text-foreground mb-2">
              Your targets have been updated
            </h2>
            {stepsCaloriesChangeInfo.stepsIncreased && (
              <p className="text-sm text-foreground/90 mb-4">
                Your steps have increased by 1,000 because you have not hit the minimum weight loss per week. Don&apos;t worry! This will help boost your weight loss goals per week, keep going!
              </p>
            )}
            {stepsCaloriesChangeInfo.caloriesDecreased && !stepsCaloriesChangeInfo.hitMinFloor && (
              <p className="text-sm text-foreground/90 mb-4">
                Your calories have decreased by 200 calories. This will be enough to fire up weight loss again. Don&apos;t worry! This will help boost your weight loss goals per week, keep going!
              </p>
            )}
            <div className="space-y-4 text-foreground">
              {stepsCaloriesChangeInfo.stepsIncreased && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Steps has increased by 1,000</p>
                  <div className="rounded-lg bg-primary/15 border-2 border-primary/50 px-4 py-3 text-center">
                    <span className="text-2xl font-bold text-primary tabular-nums">
                      {stepsCaloriesChangeInfo.stepsNewTarget.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-foreground ml-1">steps</span>
                  </div>
                </div>
              )}
              {stepsCaloriesChangeInfo.caloriesDecreased && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {stepsCaloriesChangeInfo.hitMinFloor
                      ? `Calories have been reduced to the minimum (${userGender === 'female' ? '1,300' : '1,500'} cal)`
                      : 'Calories has decreased by 200'}
                  </p>
                  <div className="rounded-lg bg-primary/15 border-2 border-primary/50 px-4 py-3 text-center">
                    <span className="text-2xl font-bold text-primary tabular-nums">
                      {stepsCaloriesChangeInfo.caloriesNewTarget.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-foreground ml-1">cal</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  if (stepsCaloriesChangeInfo?.hitMinFloor) setTimeout(() => setShowMinCalorieDialog(true), 200);
                  setShowStepsCaloriesChangePopup(false);
                  setStepsCaloriesChangeInfo(null);
                }}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Week 12 Summary Dialog (downloadable) */}
      <AlertDialog open={showWeek12SummaryDialog} onOpenChange={setShowWeek12SummaryDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="emoji_events" size="sm" className="text-primary" />
              🎉 Congratulations! 12 Weeks Completed!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                {week12Stats.totalLoss > 0 ? (
                  <>
                    <p>You started your journey weighing in at <strong className="text-foreground">{week12Stats.startWeight.toFixed(2)} Kg</strong> and now you weigh <strong className="text-foreground">{week12Stats.endWeight.toFixed(2)} Kg</strong>!</p>
                    <p>That is a total weight loss of <strong className="text-green-500">{week12Stats.totalLoss.toFixed(2)} Kg</strong>. You are amazing!</p>
                  </>
                ) : (
                  <>
                    <p>You started your journey weighing in at <strong className="text-foreground">{week12Stats.startWeight.toFixed(2)} Kg</strong> and now you weigh <strong className="text-foreground">{week12Stats.endWeight.toFixed(2)} Kg</strong>.</p>
                    <p>You have gained <strong className="text-red-500">{Math.abs(week12Stats.totalLoss).toFixed(2)} Kg</strong> during this journey.</p>
                    <p>Not to worry! Things in life happen for a reason. You can always try again!</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                handleDownloadReport();
              }}
              className="flex items-center gap-2"
            >
              <MaterialIcon name="download" size="sm" />
              Download Report
            </Button>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                localStorage.removeItem("fitpactPendingMaintenanceAfterWeek12");
                setShowWeek12SummaryDialog(false);
                setTimeout(() => setShowMaintenanceSuggestionDialog(true), 300);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Still Looking to Lose Weight? Dialog */}
      <AlertDialog open={showStillLoseWeightDialog} onOpenChange={setShowStillLoseWeightDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Are you still looking to lose weight?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-background text-foreground hover:bg-muted border-border"
              onClick={() => {
                setShowStillLoseWeightDialog(false);
                setTimeout(() => setShowThankYouDialog(true), 300);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                localStorage.removeItem("fitpactPendingMaintenanceAfterWeek12");
                setShowStillLoseWeightDialog(false);
                setTimeout(() => setShowMaintenanceSuggestionDialog(true), 300);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maintenance Phase Suggestion Dialog */}
      <AlertDialog open={showMaintenanceSuggestionDialog} onOpenChange={setShowMaintenanceSuggestionDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Maintenance Phase</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                <p>We suggest you go onto a 4 week maintenance phase. This will help you stabilize at your current weight and prepare you for your new weight loss journey.</p>
                <p>Would you like to proceed?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-background text-foreground hover:bg-muted border-border"
              onClick={() => {
                setShowMaintenanceSuggestionDialog(false);
                setTimeout(() => setShowStillLoseWeightDialog(true), 250);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                localStorage.removeItem("fitpactPendingMaintenanceAfterWeek12");
                // Collapse completed weeks and activate maintenance phase
                const detailsElements = document.querySelectorAll('.completed-week-details');
                detailsElements.forEach((el) => {
                  (el as HTMLDetailsElement).open = false;
                });
                setAllWeeksExpanded(false);
                // Auto-collapse Acclimation and Weight Loss sections
                setAcclimationCollapsed(true);
                setWeightLossCollapsed(true);
                setMaintenancePhase((prev) => {
                  const next = { ...prev, active: true as const };
                  if (weightLossStartDate && (!prev.startDate || !prev.endDate)) {
                    const derived = deriveMaintenanceWindowFromJourneyAnchor(weightLossStartDate);
                    return {
                      ...next,
                      startDate: prev.startDate || derived.startDate,
                      endDate: prev.endDate || derived.endDate,
                    };
                  }
                  return next;
                });
                setShowMaintenanceSuggestionDialog(false);
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Thank You Dialog */}
      <AlertDialog open={showThankYouDialog} onOpenChange={setShowThankYouDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Thank You! 💚</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                <p>Thank you for using Fit Impact. We are glad to be with you through your weight loss journey.</p>
                <p>Please give us feedback as we value your input and always strive to deliver quality to you.</p>
                <p>Please also recommend us to your family and friends! Stay healthy, stay happy!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setShowThankYouDialog(false);
                setTimeout(() => setShowFinalRedirectDialog(true), 300);
              }}
            >
              Thank You!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Redirect Dialog */}
      <AlertDialog open={showFinalRedirectDialog} onOpenChange={setShowFinalRedirectDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Start Again?</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                <p>You've completed your weight loss journey. If you want to start again, head over to <strong className="text-foreground">My TDEE Calculator</strong> and re-enter your details and hit 'Go to Dashboard' to kick start your journey again.</p>
                <p>See you around! 👋</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setShowFinalRedirectDialog(false);
                void clearAllDashboardData();
              }}
            >
              Go to TDEE Calculator
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maintenance Phase Complete Dialog */}
      <AlertDialog open={showMaintenanceCompleteDialog} onOpenChange={setShowMaintenanceCompleteDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="emoji_events" size="sm" className="text-primary" />
              🎉 Congratulations!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                <p>You have completed your 'Maintenance Phase'. You are now ready to start your next weight loss journey.</p>
                <p>Are you ready?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-background text-foreground hover:bg-muted border-border"
              onClick={() => {
                setShowMaintenanceCompleteDialog(false);
                setTimeout(() => setShowThankYouDialog(true), 300);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                void beginNewCycleFromMaintenance();
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Journey Complete - Block Data Entry Dialog */}
      <AlertDialog open={showJourneyCompleteBlockDialog} onOpenChange={setShowJourneyCompleteBlockDialog}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <MaterialIcon name="warning" size="sm" className="text-yellow-500" />
              Journey Complete
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-3" asChild>
              <div>
                <p>You have already completed your 12-week weight loss journey! 🎉</p>
                <p>To continue your progress, please go back to <strong className="text-foreground">My TDEE Calculator</strong> to re-enter your details and proceed with taking a <strong className="text-foreground">4-week break</strong> to reset your body, mind and goals.</p>
                <p>Once your maintenance phase is complete, you can start a brand new journey!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90">
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={calorieReminder !== null} onOpenChange={(open) => !open && setCalorieReminder(null)}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Calorie intake reminder</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/80" asChild>
              <div className="space-y-3 text-sm">
                {calorieReminder === "high" && (
                  <p>
                    You have entered a calorie intake that is higher than the recommended daily intake. To ensure consistent weight loss, try to keep to the daily recommended calorie intake. Keep consistent!
                  </p>
                )}
                {calorieReminder === "low" && (
                  <p>
                    You have entered a calorie intake that is lower than the recommended daily intake. To ensure consistent weight loss and metabolic adaptation, try to keep to the daily recommended calorie intake. Keep consistent!
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCalorieReminder(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showWelcomeBackDialog && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowWelcomeBackDialog(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-back-title"
            className="relative z-10 max-w-md w-full rounded-xl border border-primary/40 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="welcome-back-title" className="text-xl font-bold text-foreground mb-3">
              Welcome back, {userName?.trim() || "friend"}, are you ready to absolutely dominate today?
            </h2>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowWelcomeBackDialog(false)}>
              Let&apos;s Go!
            </Button>
          </div>
        </div>
      )}
      {/* Clear All Dashboard Data — Step 1 */}
      <AlertDialog open={showClearAllStep1} onOpenChange={setShowClearAllStep1}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You have clicked 'Clear all Dashboard data'. This will clear everything including 'Archived Phases' and you will need to re-enter all your details and information again via the TDEE page. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowClearAllStep1(false);
                setShowClearAllStep2(true);
              }}
            >
              Yes, I want to proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dashboard Data — Step 2 (final confirmation) */}
      <AlertDialog open={showClearAllStep2} onOpenChange={setShowClearAllStep2}>
        <AlertDialogContent className="bg-background text-foreground border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Final Confirmation</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70">
              You are about to clear all your data inputs. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowClearAllStep2(false);
                void clearAllDashboardData();
              }}
            >
              Yes, clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>
    </TooltipProvider>
  );
};

export default Dashboard;