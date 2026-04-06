import { supabase } from "./supabaseClient";

export interface JourneyRow {
  id: string;
  user_id: string;
  status: string;
  acclimation_data: {
    week1: Record<string, number>;
    week2: Record<string, number>;
    week3?: Record<string, number>;
    week4?: Record<string, number>;
  };
  weekly_data: Record<string, { steps: number; calories: number; weight: number }>;
  previous_week_data: Record<string, { steps: number; calories: number; weight: number }>;
  completed_weeks: unknown[];
  recommended_steps: number;
  recommended_calories: number | null;
  weight_loss_start_date: string | null;
  /** TRUE: weight_loss_start_date is Acclimation Day 1 (anchor). FALSE: legacy WL Week 1 start. */
  weight_loss_start_is_anchor?: boolean;
  /** First calendar day of Acclimation (set on Complete Week 1 or user override) */
  acclimation_phase_start_date?: string | null;
  /** Last calendar day of Acclimation (set on Complete Week 4 or user override) */
  acclimation_phase_end_date?: string | null;
  current_streak: number;
  longest_streak: number;
  week1_complete: boolean;
  week2_complete: boolean;
  week3_complete?: boolean;
  week4_complete?: boolean;
  starting_weight: string | null;
  journey_complete: boolean;
  maintenance_phase: unknown;
  /** Past acclimation + weight loss + maintenance bundles when user starts a new cycle */
  archived_phases?: unknown[];
  step_debug: unknown;
  acclimation_steps: number;
  acclimation_calories: number | null;
}

export async function getActiveJourney(userId: string): Promise<JourneyRow | null> {
  const { data, error } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getActiveJourney error:", error);
    return null;
  }
  return data as JourneyRow | null;
}

export async function getLatestJourney(userId: string): Promise<JourneyRow | null> {
  const { data, error } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getLatestJourney error:", error);
    return null;
  }
  return data as JourneyRow | null;
}

export async function createJourney(userId: string): Promise<JourneyRow | null> {
  const { data, error } = await supabase
    .from("journeys")
    .insert({
      user_id: userId,
      status: "acclimation",
      acclimation_data: { week1: {}, week2: {}, week3: {}, week4: {} },
      weekly_data: {},
      previous_week_data: {},
      completed_weeks: [],
      recommended_steps: 4000,
      recommended_calories: null,
      weight_loss_start_date: null,
      weight_loss_start_is_anchor: true,
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
    })
    .select()
    .single();

  if (error) {
    console.error("[Supabase] createJourney error:", error);
    return null;
  }
  return data as JourneyRow;
}

export async function upsertJourney(
  journeyId: string,
  payload: Partial<JourneyRow>
): Promise<{ data: JourneyRow | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await supabase
    .from("journeys")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", journeyId)
    .select()
    .single();

  if (error) {
    console.error("[Supabase] upsertJourney error:", error);
    return { data: null, error: { message: error.message, code: error.code } };
  }
  return { data: data as JourneyRow, error: null };
}
