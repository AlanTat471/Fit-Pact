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

## v14 — Week 12 popup / maintenance flow (May 2026)

### 12. ~~"Got it" frozen on targets-updated popup (Week 12 + weight gain)~~ — FIXED

- **Where:** `src/pages/Dashboard.tsx` — steps/calories change popup + Week 12 summary `AlertDialog`
- **Issue:** Completing Week 12 with a steps/calorie adjustment opened the custom targets popup at 450ms and the Radix Week 12 summary at 600ms. Radix’s overlay/focus trap blocked clicks on "Got it" on the targets popup.
- **Fix:** Queue dialogs sequentially — Week 12 summary opens only after the user dismisses the targets popup. Raised popup z-index to `z-[200]`.

### 13. ~~Escape on Week 12 popups left user stuck (no maintenance / no restart)~~ — FIXED

- **Where:** `src/pages/Dashboard.tsx`
- **Issue:** Escape closed dialogs but `week12SummaryScheduledRef` blocked the reload recovery path; no visible way to start Maintenance or a new Weight Loss phase.
- **Fix:** Escape on targets popup closes without chaining; Dashboard shows **Maintenance Phase** and **Weight Loss Phase #N** fallback cards when `journeyComplete && !maintenancePhase.active && numiPendingMaintenanceAfterWeek12`. Removed auto-open maintenance dialog on reload.

### 14. ~~No fallback to start Maintenance or Weight Loss Phase #2 after dismissing Week 12 flow~~ — FIXED

- **Where:** `src/pages/Dashboard.tsx`
- **Fix:** Added two Acclimation-style section cards with **Start Maintenance Phase** and **Start Weight Loss Phase #{archivedPhases.length + 2}**. Skip-maintenance archives the completed 12-week cycle immediately and starts fresh Acclimation using Week 12 end weight.

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

---

## v15 — Subscription plans, macro education, UI locks (Jul 2026)

### 15. Monthly / Annual plans replace Weekly / Fortnightly

- **Where:** `PaymentDetails.tsx`, `Settings.tsx`, `supabase/functions/billing/index.ts`
- **Change:** Monthly ($8.99/mo) and Annually ($5.99/mo, $71.88/yr) only. Stripe secrets: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.

### 16. Macro Breakdown educational content

- **Where:** `MacroBreakdown.tsx`
- **Change:** Intro + Protein/Fats/Carbs bullet points under hero section.

### 17. Acclimation Calories locked on Dashboard

- **Where:** `Dashboard.tsx`
- **Change:** Read-only field synced from TDEE Starting Calorie Intake.

### 18. TDEE heading renamed to My Details

- **Where:** `Workouts.tsx`

---

## v16 — Acclimation paywall, deferred billing, phased features (Jul 2026)

### 19. Four-week free Acclimation; charge on Week 4

- **Where:** `Dashboard.tsx`, `PaymentDetails.tsx`, `billing/index.ts`, `billingApi.ts`
- **Flow:** User saves plan + card via Stripe **setup** checkout (no charge). Weight Loss + Maintenance locked until Week 4 **Let's Go!** triggers `activate` subscription, or user subscribes immediately via Payment Details redirect (`checkout` action).
- **Returning users:** `hasEverSubscribed` — Week 4 popup skips payment; unlock without re-charge.

### 20. Payment Details button text clipping — FIXED

- **Where:** `PaymentDetails.tsx`
- **Fix:** Taller buttons (`min-h-[56px]`), smaller billing line text (`text-[9px]`), wrap allowed. Annually heading + Best Value badge under title.

### 21. Dashboard caption / cursor fixes — FIXED

- **Acclimation Calories:** Caption without "Locked"; removed `cursor-not-allowed`.
- **Recommended Steps:** "Daily baseline steps during 'Acclimation Phase.'"

### 22. Macro education reworded (shorter, original copy)

- **Where:** `MacroBreakdown.tsx`

### 23. Achievements phased out — Coming Soon

- **Where:** `BottomNav.tsx`, `AppSidebar.tsx`, `Achievements.tsx`, `Profile.tsx`

### 24. Settings Privacy / Notifications phased out; Delete Account

- **Where:** `Settings.tsx`, `supabase/functions/delete-account/index.ts`
- **Delete Account:** Confirmation dialog → deletes auth user + profile, journey, TDEE, subscriptions, prefs → sign out.

### 25. Deploy notes (v16)

- Deploy **billing** and **delete-account** Edge Functions in Supabase.
- Vercel auto-deploy from git push.
- Android: bump `versionCode` to 16, sync Capacitor, upload AAB to Play Internal testing.
