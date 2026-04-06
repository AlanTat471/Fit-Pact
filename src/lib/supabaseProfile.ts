import { supabase } from "./supabaseClient";

export interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  height: string;
  current_weight: string;
  activity_level: string;
  email: string;
  mobile: string | null;
  unit_system: string;
  profile_description: string | null;
  my_why: string | null;
  my_goals: unknown[];
  my_day_goals: unknown[];
  profile_photo: string | null;
}

/** Fetch a user's profile by id */
export async function getProfile(userId: string): Promise<{ data: ProfileRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getProfile error:", error);
    return { data: null, error: { message: error.message } };
  }
  return { data: data as ProfileRow | null, error: null };
}

/** Convert profile row to the shape expected by the app (camelCase, userProfile-like) */
export function profileToUserProfile(p: ProfileRow | null): Record<string, unknown> | null {
  if (!p) return null;
  return {
    firstName: p.first_name,
    lastName: p.last_name,
    age: p.age,
    gender: p.gender,
    height: p.height,
    currentWeight: p.current_weight,
    activityLevel: p.activity_level,
    email: p.email,
    mobile: p.mobile,
    unitSystem: p.unit_system,
    profileDescription: p.profile_description,
    myWhy: p.my_why,
    myGoals: p.my_goals,
    myDayGoals: p.my_day_goals,
    profilePhoto: p.profile_photo,
    registered: true,
  };
}

export async function upsertProfile(
  userId: string,
  payload: Partial<ProfileRow>
): Promise<{ data: ProfileRow | null; error: { message: string } | null }> {
  const row = {
    ...payload,
    id: userId,
    updated_at: new Date().toISOString(),
  };

  // Try update first (profile usually exists from DB trigger); fall back to insert for new users
  const { id: _id, ...updatePayload } = row;
  const { data: updateData, error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select()
    .single();

  if (!updateError && updateData) {
    return { data: updateData as ProfileRow, error: null };
  }

  // No existing row to update - insert instead (new user, no trigger-created profile)
  const { data: insertData, error: insertError } = await supabase
    .from("profiles")
    .insert(row)
    .select()
    .single();

  if (!insertError) {
    return { data: insertData as ProfileRow, error: null };
  }

  console.error("[Supabase] upsertProfile error:", insertError);
  return { data: null, error: { message: insertError.message } };
}
