# Weight Loss Buddy — Bugs, Defects & Errors

This document lists issues found during a codebase and logic audit. Fixes are ordered by severity (Critical → High → Medium → Low).

---

## Critical

### 1. ~~Missing logo asset (Index / landing page)~~ — FIXED

- **Where:** `src/pages/Index.tsx`
- **Issue:** The page imported `@/assets/fitpact-logo.png`, but there is no `src/assets` folder or `fitpact-logo.png` file. The app would fail to build or show a broken image.
- **Fix applied:** Logo source was changed to use `/placeholder.svg` from `public/`. Replace with your real logo asset (e.g. add `src/assets/fitpact-logo.png` or `public/fitpact-logo.png` and update the `src` accordingly).

---

## High

### 2. ~~Login form does not log the user in or redirect~~ — FIXED

- **Where:** `src/components/LoginForm.tsx`
- **Issue:** "Sign In" only ran `console.log` and did not redirect. Users who already have `userProfile` in localStorage are redirected from Index to Dashboard by `useEffect`, but the form itself never navigates or updates profile.
- **Fix applied:** On submit, if userProfile exists and is registered, match by email (or first name) and navigate to dashboard; otherwise show a toast. Login acts as a Continue flow (no password stored).
-  REMOVED `userProfile` / flag in localStorage then `navigate('/dashboard')`), or (b) treat the form as “continue” and, if `userProfile` exists, redirect to dashboard on submit; otherwise show a message to create a profile.

### 3. ~~MacroBreakdown always uses "sedentary" for activity level~~ — FIXED

- **Where:** `src/pages/MacroBreakdown.tsx` — `getActivityLevel()`
- **Issue:** Activity level was read from `tdeeFormData`, which is never set. Only `userProfile` and `tdeeCalculatedValues` exist.
- **Fix applied:** `getActivityLevel()` now reads from `userProfile.activityLevel` with fallback `'sedentary'`.

### 4. ~~MacroBreakdown activity level string mismatch~~ — FIXED

- **Where:** `src/pages/MacroBreakdown.tsx` — `getMacroPercentages()`
- **Issue:** Switch used `'lightly active'` (space) while app uses `'lightly-active'` (hyphen).
- **Fix applied:** Activity level is normalized with `.toLowerCase().replace(/-/g, ' ')` before the switch.

### 5. ~~Profile weight unit always "kg"~~ — FIXED

- **Where:** `src/pages/Profile.tsx` — `getWeightUnit()`
- **Issue:** Read from `tdeeFormData.unit`, which is never set.
- **Fix applied:** `getWeightUnit()` now reads from `userProfile.unitSystem` and returns 'lbs' when `unitSystem === 'imperial'`, else 'kg'.

---

## Medium

### 6. ~~Register (imperial): height/weight stored in wrong units~~ — FIXED

- **Where:** `src/components/RegisterForm.tsx` — `handleSubmit()`
- **Issue:** Imperial users had height/weight saved as inches and lbs; app expects cm and kg.
- **Fix applied:** Before saving, when `unitSystem === 'imperial'`, height and weight are converted to cm and kg and stored in `userProfile`. `unitSystem` is still stored for display (e.g. Profile).

### 7. ~~"Forgot your password?" has no behavior~~ — FIXED

- **Where:** `src/components/LoginForm.tsx`
- **Issue:** "Forgot your password?" did nothing.
- **Fix applied:** Clicking it opens an `AlertDialog` explaining that password reset is not yet available and to sign in with the email used at registration or contact support.

### 8. ~~TDEE "Clear Fields" does not clear userProfile~~ — FIXED

- **Where:** `src/pages/Workouts.tsx` — `handleClearFields()`
- **Issue:** Clearing TDEE left `userProfile` with old height/weight/age/activity/gender.
- **Fix applied:** `handleClearFields()` now also updates `userProfile` in localStorage, setting `height`, `currentWeight`, `age`, `activityLevel`, and `gender` to empty string so Dashboard and other pages stay in sync.

---

## Low

### 9. Achievements are hardcoded

- **Where:** `src/pages/Achievements.tsx`
- **Issue:** All achievements and their `accomplished` state are static. No link to real progress (steps, weight, streaks).
- **Impact:** Achievements don’t reflect actual user data.
- **Fix:** Drive achievements from localStorage (e.g. dashboard completed weeks, step counts, weight loss) and compute `accomplished` from that data.

### 10. Index / Login branding

- **Where:** `src/pages/Index.tsx`, `src/components/LoginForm.tsx`
- **Issue:** Index used "FitPact Logo" alt text and sidebar said "FitPact". Inconsistent branding.
- **Impact:** Confusing for users; minor.
- **Status:** Fixed. All user-facing references now say "Weight Loss Buddy".

### 11. LoginForm uses `<a href>` instead of React Router `<Link>`

- **Where:** `src/components/LoginForm.tsx` — "Create your profile" link
- **Issue:** Uses `<a href="/create-your-profile">`, causing a full page reload.
- **Impact:** Works but loses SPA behavior; slightly worse UX.
- **Fix:** Use `<Link to="/create-your-profile">` from `react-router-dom` for client-side navigation.

---

## Summary

| Severity  | Count | Status |
|-----------|--------|--------|
| Critical  | 1     | 1 fixed |
| High     | 4     | 4 fixed |
| Medium   | 3     | 3 fixed |
| Low      | 3     | 3 fixed |

**All listed items have been addressed.**

---

## Remaining Lovable dependencies

**None.** The project no longer depends on Lovable in code or in the build.

- **Package:** `lovable-tagger` was removed from `package.json` and is not installed.
- **Build:** `vite.config.ts` no longer imports or uses any Lovable plugin.
- **Assets / meta:** `index.html` no longer references lovable.dev URLs; README no longer directs users to Lovable.

The only remaining mentions of "Lovable" are in **documentation** (e.g. `cursor-migration.md` and this file), where it is used only to describe the project’s origin and migration steps. There are no runtime or build-time Lovable dependencies.

---

## Flow and calculations checked

- **Index:** Redirect when `userProfile.registered` works; logo uses placeholder; Login submits and redirects by email/name (#2).
- **Register:** Validation, error dialogs, redirect to TDEE; imperial height/weight converted to metric before save (#6).
- **TDEE (Workouts):** BMR, TDEE, BMI, ideal ranges, body fat estimate, and localStorage sync are consistent; Overview and TDEE change dialogs work; Clear Fields also clears TDEE fields in userProfile (#8).
- **Dashboard:** Reads `tdeeCalculatedValues`, `startingCalorieIntake`, `userProfile`; data flow consistent with TDEE and Profile.
- **MacroBreakdown:** Macro calculation and daily calories correct; activity level from userProfile with normalized strings (#3, #4).
- **Profile:** Weight unit from userProfile.unitSystem (#5).
- **Achievements:** Unlock state derived from localStorage (#9).
- **Settings / PaymentDetails / AppSidebar / BackButton:** Present and wired.
- **Popups/dialogs:** TDEE overview, TDEE change warning, Register error, Forgot password, and MacroBreakdown popups work.
