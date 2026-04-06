---
name: preprod-code-supabase-audit
overview: Deep pre‑production audit of the React/Supabase Weight Loss Buddy app to identify all critical-to-low issues before Stripe integration and Play Store launch.
todos:
  - id: auth-otp-hardening
    content: Verify and harden all auth, OTP, trusted-device, and reset-password flows
    status: pending
  - id: supabase-schema-rls-verify
    content: Validate Supabase schema, triggers, and RLS against frontend expectations
    status: pending
  - id: ls-vs-supabase-align
    content: Align localStorage usage so Supabase is the canonical source for plans, TDEE, journey, and macros
    status: pending
  - id: trusted-devices-security
    content: Review and tighten trusted devices design, including logout and revocation behavior
    status: pending
  - id: error-handling-improve
    content: Add user-visible error handling for critical Supabase operations
    status: pending
  - id: dashboard-achievements-consistency
    content: Ensure Dashboard and Achievements derive key stats from Supabase-backed data
    status: pending
  - id: stripe-subscriptions-model
    content: Finalize data model and integration points for Stripe and subscriptions
    status: pending
---

# Pre‑Production Audit & Hardening Plan

### Scope

- **Frontend**: React + Vite + TypeScript app under `src/` (auth, pages, contexts, components).
- **Backend (DB)**: Supabase Postgres via migrations `001_initial_schema.sql`–`004_unique_email_mobile_and_check.sql` and Supabase Auth config (email/OTP).
- **Flows**: Registration, login (password + OTP), trusted devices, profile/TDEE/journey/macros/settings, logout, and reset password.

---

## 1. Architecture & Data Flow Review

- **Auth & Session Lifecycle**
  - Confirm end-to-end flow:
    - `LoginForm` and `RegisterForm` use `supabase.auth.*` correctly for sign-in, sign-up, OTP, and reset password.
    - `AuthContext` (`src/contexts/AuthContext.tsx`) is the single source of truth for `user`, `session`, `profile`, with correct `onAuthStateChange` handling and token-refresh race mitigation.
    - `AppLayout` (`src/layouts/AppLayout.tsx`) protects all app routes that require a session.
  - Verify correct handling of:
    - Email confirmation enabled in Supabase.
    - OTP sign-in (`signInWithOtp` + `verifyOtp` with `type: "magiclink"`).
    - New-device OTP for trusted devices.
- **User Data Flow (Profiles, Journey, TDEE, Macros, Preferences)**
  - Map how data flows between:
    - Supabase tables: `profiles`, `journeys`, `tdee_values`, `custom_macros`, `user_preferences`, `trusted_devices`.
    - Contexts: `AuthContext`, `UserDataContext`.
    - Pages: `Dashboard`, `Workouts` (TDEE), `MacroBreakdown`, `Profile`, `Settings`, `PaymentDetails`, `Achievements`.
  - Document remaining uses of `localStorage` and how they are synced with Supabase.
- **Supabase SQL & RLS**
  - Confirm table schemas and constraints match app assumptions:
    - `profiles` required fields & defaults.
    - `journeys` and `tdee_values` multiplicity (multiple rows per user ordered by `created_at`).
    - Uniques on email/mobile, macros, preferences, and trusted devices.
  - Validate RLS policies in `001_initial_schema.sql` and `002_trusted_devices.sql` align with expected app behavior (only user’s own data, support tickets, etc.).

---

## 2. Critical Issues (Must Fix Before Production)

- **2.1 Auth & OTP Correctness**
  - Verify **all** OTP calls use the correct `type`:
    - `verifyOtp` for sign-in and new-device verification must use `type: "magiclink"`.
  - Re-test:
    - Regular OTP login.
    - Password login on a new device → new-device OTP.
    - Ensure successful verification always results in:
      - Valid session in Supabase.
      - `AuthContext` seeing the session.
      - `addTrustedDevice` called and row inserted into `trusted_devices`.
- **2.2 Supabase Profile Creation & Uniqueness**
  - Confirm `handle_new_user` trigger (`003_auto_create_profile.sql`) always creates a complete `profiles` row with valid, unique `email`.
  - Check for risks where `profiles.email` could be `''` while `profiles.email` is `NOT NULL UNIQUE`:
    - Ensure all auth flows supply `NEW.email`.
    - Optionally adjust trigger logic or constraint to avoid duplicate empty emails.
  - Ensure `upsertProfile` (`src/lib/supabaseProfile.ts`) update-first-then-insert path cannot violate NOT NULL constraints when inserting partial payloads.
- **2.3 RLS & Data Access**
  - Validate that RLS does not block any legitimate operations:
    - `profiles`, `journeys`, `tdee_values`, `custom_macros`, `user_preferences`, `trusted_devices` for regular app usage.
    - `support_tickets` if you want logged-out users to submit tickets (currently blocked by `auth.uid() IS NOT NULL`).
  - Check that RLS does not allow any unintended access:
    - `support_tickets` insert can spoof `user_id`; decide if you want to enforce `user_id = auth.uid()`.
- **2.4 LocalStorage vs Supabase Source of Truth**
  - Identify any pages that **still rely primarily on `localStorage`** for key data (Dashboard, Achievements, Profile badges, PaymentDetails plan) and can desync from Supabase:
    - Document where Supabase is canonical vs LS-only.
    - Decide on minimal changes to make Supabase the source of truth for:
      - `activePlan` (Stripe-related), TDEE, journey completion, key stats.
  - Ensure `signOut` in `AuthContext` fully resets client-side state and does not leave stale user data that could leak across sessions.

---

## 3. High Priority Issues (Before Stripe & Wider Beta)

- **3.1 Trusted Devices Design & Security**
  - Review `getDeviceFingerprint()` implementation (not yet inspected) to ensure:
    - It’s stable per device and hard to spoof (avoid just user-agent / simple strings).
    - It’s not trivially shareable (e.g., not derived from email alone).
  - Confirm behavior matches requirements:
    - First login on a new device → enforce OTP.
    - Subsequent logins on that device with password → no OTP.
  - Consider revocation paths:
    - Add a user-facing “Log out of all devices” / “Forget this device” to delete rows from `trusted_devices` and clear local fingerprint.
- **3.2 Stripe-Related Data & Plan Management**
  - Unify plan source of truth:
    - Ensure `activePlan` is consistently stored in `user_preferences` and mirrored to `localStorage`.
    - Update `PaymentDetails.tsx` to use the same `getUserPref`/`setUserPref` logic as `Settings` Billing.
  - Sketch data model for Stripe integration using existing `subscriptions` table:
    - Confirm `subscriptions` schema (`status`, `stripe_subscription_id`, `expires_at`) matches the kinds of Stripe webhooks and client flows you intend.
    - Ensure RLS on `subscriptions` is sufficient (`auth.uid() = user_id`).
- **3.3 Error Handling & User Feedback**
  - Review all Supabase calls in:
    - `supabaseProfile`, `supabaseJourney`, `supabaseTdee`, `supabaseMacros`, `supabaseUserPrefs`, `supabaseTrustedDevices`, `supabaseCheck`.
  - For each, decide when to:
    - Surface a visible error to the user (e.g. failed to save journey/TDEE/macros).
    - Retry or soft-fail.
  - Add minimal user-friendly error paths for critical operations (auth, saving core data) instead of silent `console.error` + no state change.
- **3.4 Logout & Device State**
  - Ensure `signOut()` also:
    - Clears any stored device fingerprint (`clearStoredFingerprint()` from `supabaseTrustedDevices`).
    - Clears `sessionStorage.authFlowPending` to avoid stuck state.

---

## 4. Medium Priority Issues (Beta but Before Full Production)

- **4.1 Dashboard & Achievements Consistency**
  - Document all uses of dashboard-related `localStorage` keys and how they map to `journeys`:
    - `dashboardWeeklyData` ↔ `journeys.weekly_data`.
    - `dashboardCompletedWeeks` ↔ `journeys.completed_weeks`.
    - `dashboardAcclimationData` ↔ `journeys.acclimation_data`.
  - Decide which metrics must be **multi-device consistent** (weight loss stats, streaks) and ensure they are derived from Supabase data whenever possible.
  - Add validation around LS parsing, with safe fallbacks if data is corrupted.
- **4.2 TDEE Clear Semantics**
  - Decide what “clear” means functionally:
    - If it should also reset the server’s TDEE row, add a path from `handleClearFields` to `saveTdee` with null/empty payload or a dedicated API.
    - Otherwise, adjust copy to clarify that clearing only affects this device/session.
- **4.3 Profile Repair & Duplication**
  - Centralize profile creation/update rules:
    - Ensure `RegisterForm`, `AuthContext.fetchProfile`, `UserDataContext.migrateFromLocalStorage`, and any Settings/Profile edits use consistent field mappings and defaults.
  - Add light validation before sending partial updates so you never accidentally zero out required fields.
- **4.4 Support Tickets Behavior**
  - Confirm whether you want:
    - Authenticated-only support submissions (current behavior).
    - Or allow anonymous; if so, adjust RLS and insertion logic.
  - Consider enforcing `user_id = auth.uid()` when `user_id` is not null to prevent spoofing.

---

## 5. Low Priority / Nice-to-Have Improvements

- **5.1 Type Safety for JSON Fields**
  - Tighten TS types for JSONB fields (`my_goals`, `my_day_goals`, `journeys.*`, `tdee_values.values_json`, `custom_macros.macros_json`) to reflect actual shapes used.
  - Add small runtime guards (e.g. `Array.isArray`) when reading from Supabase/LS to avoid runtime crashes from unexpected shapes.
- **5.2 Supabase Client Fail-fast Behavior**
  - In `supabaseClient.ts`, throw or hard fail in non-dev environments when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, instead of silently creating a client with empty strings.
- **5.3 Logging & Monitoring Hooks**
  - Add minimal centralized logging utility for Supabase errors:
    - Tag errors by feature (auth/profile/journey/TDEE/macros).
    - Prepare for future Sentry/PostHog integration without scattering logs.

---

## 6. Execution Order (Recommended)

1. **Auth & OTP correctness + profile creation hardening** (Critical).
2. **RLS and Supabase schema/trigger validations** – fix any issues found in 2.2/2.3 above.
3. **LocalStorage vs Supabase: align core data (activePlan, TDEE, journey)**.
4. **Trusted devices design & security review; adjust logout behavior**.
5. **Improve error handling for all Supabase writes/reads that affect user data**.
6. **Dashboard/Achievements data consistency review and, if needed, partial migration to Supabase-backed calculations.**
7. **Stripe & subscriptions modeling using existing tables and user preferences.**

Each of these can be implemented incrementally while keeping the app runnable, with checks after each step to make sure existing flows remain stable.

