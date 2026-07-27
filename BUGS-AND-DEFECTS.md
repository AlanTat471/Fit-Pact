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
- **Returning users:** Week 4 must not create a duplicate Stripe subscription or an extra one-off charge. Their existing Monthly/Annual subscription continues its normal automatic renewal schedule.

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

---

## v16.1 — Annual display, recurring billing clarification, cancellation (Jul 2026)

### 26. Annual price display corrected

- **Where:** `PaymentDetails.tsx`, `Settings.tsx`
- **Change:** Annual button now shows **$71.88/year**. The description states the equivalent **$5.99/month**, $36 saving, and the badge states **Best Value - 33% discount!**
- **Math:** Monthly comparison is $8.99 × 12 = $107.88. Saving is $107.88 − $71.88 = $36.00. Discount is 33.37%, rounded to **33%**.

### 27. Subscription renewal semantics clarified

- **Monthly:** Stripe renews at $8.99 every month until cancellation.
- **Annual:** Stripe renews at $71.88 every year until cancellation.
- **Returning cycle:** No duplicate subscription or extra one-off charge is created; the existing recurring Stripe subscription remains responsible for scheduled renewals.

### 28. Cancel Subscription now reaches Stripe — FIXED

- **Where:** `billing/index.ts`, `billingApi.ts`, `Settings.tsx`, `PaymentDetails.tsx`
- **Previous issue:** The UI only changed local `activePlan` to free; it did not stop Stripe renewal.
- **Fix:** New billing `cancel` action sets Stripe `cancel_at_period_end`. Access remains active through the paid period; future renewal stops after that date.

### 29. New PC migration guide refreshed

- **Where:** `NEW_PC_MIGRATION_GUIDE.md`
- **Change:** Exact GitHub repository URL, same-OneDrive secret transfer, detailed explanation of `.env.local`, Android Studio setup, emulator/device tests, and Play Internal testing steps.

---

## v16.2 — Subscription wording, restart popup flow, Starting Weight sync (Jul 2026)

### 30. Annual description wording updated

- **Where:** `PaymentDetails.tsx`
- **Change:** Annually description now reads: *"Get 4 months free with annual billing at $71.88 (equivalent to $5.99/month) - saving of $36 compared to Monthly subscription!"*

### 31. Subscribe button wording simplified

- **Where:** `PaymentDetails.tsx`
- **Change:** Both Monthly and Annually buttons now show **"Subscribe - Charged after Week 4"** under the price ("$8.99 / month" / "$71.88 / year") when browsing plans normally. When arriving from the Week 4 "Congratulations" popup, the button still says "Subscribe now via Stripe". Sub-label font increased from 9px to 10px since the shorter text fits comfortably.

### 32. Restart flow popup order corrected

- **Where:** `Dashboard.tsx`
- **Previous issue:** After "Clear All Dashboard Data" → TDEE re-entry → Dashboard, the popup order was Welcome → Acclimation info → journey start date, so the date prompt came last.
- **Fix:** The **"Ready to Start?"** (journey start date) popup now appears directly after the Welcome popup's Continue button. The Acclimation info popup is shown *after* the user saves their start date via "Let's Go!". The page-load popup check follows the same priority so the order holds even if the app is closed mid-flow.

### 33. Starting Weight did not match TDEE Current Body Weight — FIXED

- **Where:** `Dashboard.tsx`
- **Previous issue:** The TDEE weight was only copied into "Starting Weight" when the field was empty (`!startingWeight` guard). If the user later changed their weight on the TDEE page, the Dashboard kept showing (and re-saving) the stale value.
- **Fix:** Until Acclimation Week 4 completes, Starting Weight now always mirrors the TDEE "Current Body Weight" and live-updates on change. Once Acclimation completes, the 4-week acclimation average takes over (existing intended design, unchanged).

### 34. Weight loss end date hint expanded

- **Where:** `Dashboard.tsx`
- **Change:** Tooltip now ends with *"This does not include the 'Maintenance Phase'."* clarifying that the calculated end date covers only the 12-week Weight Loss Phase.

---

## v16.3 — Week 4 popup rewrite + payment verification hardening (Jul 2026)

### 35. Week 4 "Congratulations" popup reworded; button renamed to Subscribe

- **Where:** `Dashboard.tsx`
- **Change (first-time users):** New copy: *"Congratulations! You have successfully completed the 'Acclimation Phase'! You are now primed for weight loss, hit 'Subscribe' now to begin your life-changing weight loss journey. Numi will be with you every step of the way. This is your moment to make a change, let's do it together! New You, New Me!"* followed by a bold warning: *"Warning - you will be charged at your chosen 'Subscription' method upon clicking 'Subscribe'."* The primary button is now **Subscribe** (was "Let's Go!"). The "No." decline path is unchanged. Returning-subscriber wording and "Let's Go!" button are unchanged.

### 36. Checkout unlock no longer trusts the redirect URL — FIXED (security)

- **Where:** `billing/index.ts`, `billingApi.ts`, `Dashboard.tsx`
- **Previous issue:** Landing on `/dashboard?checkout=success&unlocked=1` unlocked premium with no server check. Stripe only redirects there after payment, but the URL could be typed manually to unlock without paying.
- **Fix:** The Stripe success URL now carries `session_id={CHECKOUT_SESSION_ID}`. The Dashboard calls a new **verify** billing action; the server retrieves the session from Stripe and confirms (a) it belongs to the signed-in user, (b) mode is subscription, status complete, `payment_status === "paid"`, and (c) the subscription is active/trialing. Only then are phases unlocked (server-side prefs + client state). On failure a "Payment not confirmed" toast shows and phases stay locked. Checkout params are stripped from the URL after handling so refresh doesn't re-verify.
- **Back-button case:** returning from the Stripe page without paying never reaches the success URL, so nothing unlocks; the cancel URL carries no unlock parameters.

### 37. Saved-card activation could unlock on a declined charge — FIXED (security)

- **Where:** `billing/index.ts` (`activate` action)
- **Previous issue:** `stripe.subscriptions.create` defaults to allowing "incomplete" subscriptions; a declined card still returned `success: true` and unlocked phases with no money taken.
- **Fix:** Activation now uses `payment_behavior: "error_if_incomplete"` so a declined card fails immediately (HTTP 402, `needsPaymentSetup: true` → user is sent to Payment Details). As a belt-and-braces check, any subscription not active/trialing after creation is cancelled and rejected.

### 38. Deploy notes (v16.3)

- **Supabase:** the **billing** Edge Function MUST be redeployed (`deploy-supabase-functions.bat`) or checkout returns will fail verification.
- Vercel auto-deploys from git push. No Stripe dashboard changes needed.

---

## v16.4 — Plan switching, cancellation warnings, double-charge protection (Jul 2026)

### 39. "Switch to Free Plan" ignored Stripe and enabled a double charge — FIXED (critical)

- **Where:** `PaymentDetails.tsx`, `billing/index.ts`
- **Previous issue:** Switching to Free only changed a local label. The Stripe subscription kept renewing, and because the app then thought the user was "free", the paid card showed the Subscribe button again — clicking it started a brand-new checkout (double charge).
- **Fix:** With an active Stripe subscription, "Switch to Free Plan" now shows a warning popup: *"You are paid up until DD/MM/YYYY (inclusive). Once the paid premium is finished, you will lose access to premium features. Are you sure you want to continue?"* — **Yes** schedules the Stripe cancellation at period end (no pro-rata refunds; access to the last paid day inclusive; premium locks automatically afterwards via webhook). **No** changes nothing.

### 40. Resubscribing within the paid period no longer re-charges — NEW "resume" action

- **Where:** `billing/index.ts`, `PaymentDetails.tsx`, `billingApi.ts`
- Paid → Free → back to the same paid plan: the plan card shows **"Resume plan — Access ends DD/MM/YYYY"**; a "Welcome back!" popup confirms the next renewal date and that nothing is charged today. The server just removes `cancel_at_period_end` — no payment screen, no new subscription.

### 41. Monthly ↔ Annually switching without re-payment — NEW "switch" action

- **Where:** `billing/index.ts`, `PaymentDetails.tsx`
- Selecting the other paid plan while subscribed shows a popup with both dates: paid up until DD/MM/YYYY (inclusive) on the current plan; the new plan starts on the renewal date and its price ($8.99 or $71.88) is charged then. Confirming updates the price on the **existing** Stripe subscription with `proration_behavior: "none"` — no charge today, no checkout page. Annual→Monthly keeps the full paid year; Monthly→Annual charges $71.88 the day after the month's last inclusive day.

### 42. Server-side double-subscription guard on activate/checkout

- **Where:** `billing/index.ts`
- If a live Stripe subscription already exists, "activate" resumes/reuses it and reports success without charging; "checkout" refuses to create a session and explains no new payment is needed. One account can never hold two subscriptions.

### 43. Card updates use Stripe setup flow; pre-charge plan change simplified

- **Where:** `PaymentDetails.tsx`
- "Add payment method" / the edit pen / "Update Payment Method" now always open Stripe's card-saving (setup) flow, which never charges. During the free Acclimation window, changing the chosen plan when a card is already saved just updates the pending plan with a toast — no Stripe visit.

### 44. Settings "Change Plan" centralised

- **Where:** `Settings.tsx`
- The old dialog only changed a label with no billing effect. "Change Plan" now opens the Payment Details page where the real switching logic lives. The dead dialog was removed.

### 45. Pre-charge (before Week 4) plan change/cancel was invisible and impossible — FIXED

- **Where:** `PaymentDetails.tsx`, `Settings.tsx`
- **Previous issue:** Before Week 4 no Stripe subscription exists (nothing has been charged), so "Cancel Subscription" in Settings was greyed out and selecting a different plan gave only a toast with no visible change — the user appeared unable to change or cancel anything.
- **Fix:**
  - The chosen plan card now shows "your selected plan — charged after Week 4" and its button reads "Selected ✓ — Charged after Week 4". Clicking another plan moves the selection instantly (no payment screen — the saved card is reused).
  - Clicking "Switch to Free Plan" with a selected plan opens a "Cancel your selected plan?" popup explaining nothing has been charged; confirming clears the selection so nothing is charged after Week 4.
  - Settings → Billing now shows "Selected plan: … — you will only be charged after completing Acclimation Week 4", and the button becomes "Cancel Selected Plan" (enabled), which clears the selection with matching popup wording. With a real active subscription the original Stripe cancellation flow is used, unchanged.

### 46. Deploy notes (v16.4)

- **Supabase:** redeploy the **billing** Edge Function (required for switch/resume/guards).
- **Stripe:** no dashboard changes; ensure the webhook for `customer.subscription.*` events remains configured so access locks automatically when a cancelled period ends.
- Dates shown in popups use Stripe's real billing dates (monthly renews on the same calendar date next month; "paid up until" is the day before renewal, inclusive).

---

## v16.5 — Free Plan "Active" lock blocked cancel before Week 4 (Jul 2026)

### 47. Free Plan stayed "Active" so cancel was unreachable — FIXED

- **Where:** `PaymentDetails.tsx`, `Settings.tsx`
- **Root cause:** Before Week 4, `activePlan` is still `free` (no Stripe subscription yet). The Free card therefore showed a disabled **Active** button, so the user could never open the cancel-selection popup. Settings Cancel stayed grey when pending plan state was stale.
- **Fix:**
  - Free card shows **"Cancel selected plan / Nothing charged yet"** whenever Monthly or Annually is selected with a saved card.
  - Selected paid card is highlighted; button shows **"Selected ✓ — Charged after Week 4 — tap another plan to switch"**.
  - Info banner explains change/cancel is always allowed; charge still only after Week 4 Subscribe.
  - Settings shows **"Monthly (selected)" / "Annually (selected)"** with charge-after-Week-4 pricing text, and enables **"Cancel Selected Plan"**.
  - Pending plan refreshes when returning to Settings (focus + storage sync).
- **Unchanged:** After a real payment, v16.4 switch/cancel-at-period-end rules still apply.
