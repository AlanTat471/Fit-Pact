# Supabase Migration Plan – Complete localStorage to Supabase

## Goals

1. **Sign-up flow**: User registers → email confirmation sent → user confirms → profile created in Supabase
2. **Cross-device login**: User can log out and sign in on another device; trusted-device OTP verification for new devices
3. **Data persistence**: All user data (profile, TDEE, journey, macros, payments) stored in Supabase and synced across devices

---

## Current Architecture

| Data | Supabase Table | localStorage Key | Status |
|------|----------------|-----------------|--------|
| Profile | `profiles` | `userProfile` | ✅ In Supabase; synced to localStorage |
| Journey | `journeys` | `dashboard*` (many keys) | ✅ In Supabase; synced to localStorage |
| TDEE | `tdee_values` | `tdeeCalculatedValues`, `startingCalorieIntake`, `suggestedWeightGoal` | ✅ In Supabase; synced to localStorage |
| Macros | `custom_macros` | `customMacroGrams` | ✅ In Supabase; synced to localStorage |
| Plan/Payments | — | `activePlan`, `paymentMethods`, `billingAddress` | ❌ localStorage only |
| UI flags | — | `dashboardWelcomeShown`, `tdeeOverviewShown`, etc. | Device-specific; can stay in localStorage |

---

## Migration Steps

### Phase 1: Data Source of Truth (Supabase)

- **Profile**: AuthContext fetches from `profiles`; pages use `useAuth().profile`
- **Journey**: UserDataContext fetches from `journeys`; Dashboard uses `useUserData().journey`
- **TDEE**: UserDataContext fetches from `tdee_values`; Workouts/MacroBreakdown use `useUserData().tdee`
- **Macros**: UserDataContext fetches from `custom_macros`; MacroBreakdown uses `useUserData().customMacros`

### Phase 2: Remove localStorage as Primary

- Pages read from context first; localStorage only as fallback during migration
- All writes go to Supabase via context (`saveJourney`, `saveTdee`, `saveMacros`, `upsertProfile`)
- Remove sync-to-localStorage from AuthContext and UserDataContext (or keep only for offline/legacy)

### Phase 3: User Preferences (Settings)

- Add `user_preferences` keys: `activePlan`, `paymentMethods`, `billingAddress`
- Settings loads/saves via `getUserPref` / `setUserPref`

### Phase 4: UI Flags (Optional)

- `dashboardWelcomeShown`, `tdeeOverviewShown`, etc. can stay in localStorage (device-specific)
- Or migrate to `user_preferences` for cross-device consistency

---

## Sign-up Flow (Email Confirmation)

1. User fills "Create a new profile" → `supabase.auth.signUp()` with `user_metadata`
2. Supabase sends confirmation email (if enabled in project)
3. **Navigation only when registered**: We only navigate to TDEE when `data.session` exists (user has a valid session = fully registered)
4. **Email confirmation enabled (production)**: `signUp` returns no session → show "Check your email" → user confirms → signs in via login flow
5. **Email confirmation disabled (dev)**: `signUp` returns session immediately → create profile → navigate to TDEE
6. **Route protection**: Dashboard, TDEE, Profile, Settings, etc. are wrapped in AppLayout and require `session`. Only registered (authenticated) users can access them.
7. **Create-your-profile**: Accessible to unauthenticated users for sign-up. Authenticated users are redirected to dashboard.

---

## Cross-Device Login (Trusted Devices)

1. User enters email/password on new device
2. `isDeviceTrusted(userId, fingerprint)` checks `trusted_devices` table
3. **Trusted**: redirect to `/dashboard`
4. **New device**: sign out, show OTP verification UI
5. User requests OTP → `signInWithOtp()` sends code to email
6. User enters code → `verifyOtp()` → `addTrustedDevice()` → redirect to `/dashboard`
7. All data loads from Supabase (profile, journey, TDEE, macros)

---

## Critical Calculation Logic (Verified)

- **BMR**: Mifflin-St Jeor – `10*weight + 6.25*height - 5*age + 5` (male) or `-161` (female)
- **TDEE**: BMR × activity multiplier (sedentary 1.2 → super-active 1.9)
- **BMI**: `weight / (height/100)²`
- **Body fat (Deurenberg)**: `(1.2 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4`
- **Ideal weight**: BMI 18.5–24.9 range
- **Steps/calories**: 0.5% weekly loss threshold; steps +1000 or calories -200

---

## Maintenance Phase

- Triggered when 12 weight-loss weeks are complete
- `journey_complete` = true; `maintenance_phase` JSONB stores 4-week tracking
- Stored in `journeys.maintenance_phase`; synced via `saveJourney`

---

## Implementation Summary (Completed)

### Changes Made

1. **Dashboard**
   - Loads from `journey` (Supabase) first; falls back to localStorage
   - Loads TDEE values from `tdee` (Supabase) first
   - Loads acclimation calories from `tdee.starting_calorie_intake`
   - Uses `profile` from AuthContext for maintenance calculations
   - Week 4 maintenance completion: updates `saveTdee`, `upsertProfile` in Supabase

2. **Workouts (TDEE Calculator)**
   - `applyFieldChange` updates profile in Supabase via `upsertProfile`
   - Keeps localStorage sync for legacy compatibility

3. **Settings**
   - `activePlan`, `paymentMethods`, `billingAddress` stored in `user_preferences` (Supabase)
   - `handleSaveProfile` calls `upsertProfile` and `saveTdee`
   - Loads from Supabase when user is logged in

4. **MacroBreakdown**
   - Uses `tdee`, `journey`, `customMacros` from UserDataContext
   - `startingCalorieIntake` prefers journey.recommended_calories, then tdee
   - Loads custom macros from Supabase first
   - `handleResetToRecommended` calls `saveMacros` to persist to Supabase

5. **Profile**
   - Already saves to Supabase via `saveProfileToSupabase` (upsertProfile)
   - Uses `profile` from AuthContext

### localStorage Usage (Retained for Compatibility)

- AuthContext and UserDataContext still sync to localStorage so pages that read on mount get data
- UI flags (dashboardWelcomeShown, tdeeOverviewShown, etc.) remain in localStorage (device-specific)
- Settings still writes to localStorage for cross-tab sync and legacy support
