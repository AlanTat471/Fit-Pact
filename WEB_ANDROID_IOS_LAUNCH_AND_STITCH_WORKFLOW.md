# FitPact Launch Guide: Live URL -> Android -> iOS + Stitch Workflow

This guide covers:
- Getting your app off `localhost` and onto a public URL.
- Publishing to Android (Google Play) and iOS (Apple App Store).
- Keeping a stable workflow: refine in Cursor first, then Stitch polish.
- Practical steps to align visuals closer to Stitch now.

---

## 0) Current Position and Goal

You already have:
- Core app flow mostly complete.
- Supabase auth/data integrated.
- Stripe integration in place.
- Major UI updates done.

Now the goal is:
1. Launch public web URL.
2. Launch Android beta, then production.
3. Launch iOS beta, then production.
4. Keep design quality high using Cursor-first + Stitch polish.

---

## 1) Move from localhost to a live public web URL

`localhost` works only on your machine. You need a hosting platform.

### 1.1 Choose a hosting provider

Recommended for your stack (React + Vite + Supabase + Stripe):
- Vercel (recommended)
- Netlify
- Cloudflare Pages

Use one provider first (Vercel is easiest for your setup).

### 1.2 Prerequisites before deploy

1. Code is in GitHub repository.
2. Build runs locally (`npm run build`).
3. Environment variables are identified:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - any other `VITE_...` frontend variables.
4. Stripe secrets stay server-side only (Supabase secrets / Edge Functions), not in frontend.

### 1.3 Deploy to Vercel (step-by-step)

1. Create account at <https://vercel.com>.
2. Click **Add New Project**.
3. Import your GitHub repository.
4. Confirm framework = **Vite**.
5. Set:
   - Build command: `npm run build`
   - Output directory: `dist`
6. Add environment variables in Vercel Project Settings.
7. Click **Deploy**.
8. You get a public URL like `https://your-app-name.vercel.app`.

### 1.4 Add a custom domain (recommended)

1. Buy domain (Cloudflare/Namecheap/etc.).
2. In Vercel: Project -> Settings -> Domains -> Add domain.
3. Add DNS records exactly as instructed.
4. Wait for SSL to provision.

### 1.5 Post-deploy checks (must-do)

Run a full smoke test on the live URL:
- Sign up/login/logout.
- Dashboard saves/reloads correctly.
- Macro/TDEE calculations still correct.
- Payment Details opens Stripe Checkout.
- Success/cancel payment flow returns correctly.
- Route refreshes work (`/dashboard`, `/macro-breakdown`, etc.).

### 1.6 Stripe + Supabase production switch

Before real users:
1. Create live Stripe products/prices.
2. Update Supabase secrets with live Stripe keys and live price IDs.
3. Confirm Stripe webhook points to your live Supabase billing function endpoint.
4. Verify webhook events are arriving and processed.

### 1.7 Handoff map (You vs Me)

Use this sequence so work can continue with minimal waiting:

1. **You:** create Vercel account and connect GitHub repo.
   - **Then me:** verify project config files, env var list, and production-safe settings.
2. **You:** add env vars in Vercel dashboard and click deploy.
   - **Then me:** run a post-deploy QA script/checklist and provide pass/fail report.
3. **You:** share live URL.
   - **Then me:** test route behavior, auth flow, Stripe button flow, and surface fixes.
4. **You:** add/point custom domain DNS.
   - **Then me:** verify canonical URL behavior and update app links/callback assumptions.

---

## 2) Android release (Google Play) - after web URL is stable

You selected order: Web first -> Android -> iOS.

### 2.1 Accounts and tools

1. Create Google Play Console account.
2. Install Android Studio.
3. Ensure JDK + Android SDK are installed.

### 2.2 Add Capacitor to your app

1. Install:
   - `npm install @capacitor/core @capacitor/cli`
   - `npm install @capacitor/android`
2. Initialize Capacitor:
   - `npx cap init`
3. Build web app:
   - `npm run build`
4. Sync web build into native shell:
   - `npx cap add android`
   - `npx cap sync android`

### 2.3 Configure Android app

In `capacitor.config`:
- App ID (reverse-domain style).
- App name.
- Web dir = `dist`.

In Android Studio:
- Set app icon/splash.
- Set versionCode/versionName.
- Configure signing key for release.

### 2.4 Android testing and beta

1. Test on emulator and physical Android device.
2. Verify auth and payment flow in WebView/native shell.
3. Build signed AAB.
4. Upload to Google Play Console:
   - Internal testing -> Closed testing -> Open testing.
5. Start with internal/closed beta first.

### 2.5 Go production on Android

After beta feedback and fixes:
1. Complete store listing assets/text.
2. Complete app content + policy forms.
3. Promote release to production.

### 2.6 Handoff map (You vs Me)

1. **You:** create Google Play Console account and accept terms.
   - **Then me:** prepare Android release checklist and app config values to enter.
2. **You:** install Android Studio and SDK tools.
   - **Then me:** generate exact Capacitor commands and run project-side config updates.
3. **You:** open Android project and set signing key/app identifiers.
   - **Then me:** review config files and validate no mismatches before build.
4. **You:** upload AAB to Internal/Closed testing.
   - **Then me:** provide tester plan, QA matrix, and triage fix list from feedback.

---

## 3) iOS release (Apple App Store) - after Android beta is stable

### 3.1 Accounts and tools

1. Enroll in Apple Developer Program.
2. Use a Mac with Xcode installed.
3. Install iOS Capacitor platform:
   - `npm install @capacitor/ios`
   - `npx cap add ios`
   - `npx cap sync ios`

### 3.2 Configure iOS app

In Xcode:
- Bundle Identifier.
- Team + signing.
- App icons/splash.
- Version/build numbers.
- Privacy usage descriptions if needed.

### 3.3 iOS testing + TestFlight

1. Test on simulator + real iPhone.
2. Archive and upload build via Xcode.
3. Distribute to TestFlight testers.
4. Fix issues from TestFlight feedback.

### 3.4 App Store release

1. Create App Store Connect listing.
2. Upload screenshots and metadata.
3. Complete compliance forms.
4. Submit for review.
5. Release after approval.

### 3.5 Handoff map (You vs Me)

1. **You:** enroll Apple Developer account and provide Team/Bundle details.
   - **Then me:** prepare iOS config checklist and values to set in Xcode.
2. **You:** run Xcode signing/profile steps on Mac.
   - **Then me:** validate Capacitor/iOS project settings and resolve build/config issues.
3. **You:** upload TestFlight build.
   - **Then me:** build test script for testers and convert findings into implementation tasks.
4. **You:** submit app metadata/compliance in App Store Connect.
   - **Then me:** review copy, feature list, and release notes for consistency with app behavior.

---

## 4) Cursor-first -> Stitch polish workflow (recommended)

You selected: Cursor first.

### 4.1 Source of truth model

- Business logic/data flow source of truth: Cursor codebase.
- Visual exploration/polish: Stitch.
- Final implementation merge: Cursor.

### 4.2 Per-screen workflow

1. In Cursor, lock logic first (done for your core flows).
2. Export screen brief + constraints to Stitch.
3. Generate UI variants in Stitch.
4. Select one variant and map it back to real components.
5. Re-implement in Cursor without touching handlers/calculations.
6. QA all behavior after styling merge.

### 4.3 Non-negotiable guardrails

- Do not rewrite calculations or persistence for visual changes.
- Do not change route names unless explicitly planned.
- Keep Supabase/Stripe calls unchanged during UI pass.
- Update `GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md` after each major UI change.

### 4.4 Handoff map (You vs Me)

1. **You:** pick target screens and approve visual direction references.
   - **Then me:** implement pixel-match pass in Cursor without touching business logic.
2. **You:** if needed, paste/update Stitch prompt and generate variants.
   - **Then me:** map approved Stitch variant back into production-safe code.
3. **You:** perform visual acceptance review.
   - **Then me:** complete final polish + QA + update Stitch single-bundle `.md`.

---

## 9) Execution mode: "You step in only when needed"

When you send "continue", I will proceed through all tasks I can execute directly and pause only when a manual action is required from you.

### Manual actions only you can do
- Account creation/payment/legal acceptance (Vercel, Google Play, Apple).
- Dashboard-only operations behind your authenticated accounts.
- DNS changes and domain ownership validation.
- Xcode signing actions requiring your Apple certificates/profile access.

### Tasks I can take over immediately after your step
- Code/config updates in project files.
- Environment variable checklist validation.
- QA pass and bug-fix implementation.
- Stitch prompt/single-bundle updates.
- Release-readiness documentation and tester checklists.

---

## 5) "Align closer to Stitch now" practical checklist

Use this checklist for each screen:

1. Layout shell:
   - mobile-first width
   - top bar spacing
   - bottom nav proportions
2. Typography:
   - heading weight/size/line-height
   - uppercase tracking labels
3. Card system:
   - card radius
   - border opacity
   - glow shadows
4. Spacing rhythm:
   - section gaps
   - internal card padding
5. Buttons:
   - consistent height and baseline alignment across sibling cards
6. Motion:
   - subtle hover/tap transitions only
7. QA:
   - no logic regressions
   - tooltips/dialogs visible and usable

### 5.1 Step 5 status (actioned)

The following were implemented directly in Cursor to align closer to Stitch visuals without changing logic:

- `PaymentDetails`:
  - Visual treatment shifted toward Stitch dark-card style (`bg-[#131313]`, `border-zinc-800`, compact uppercase status text).
  - Header updated to `Subscription & Billing` with secure subtitle styling.
  - Plan card CTA alignment stabilized (equal card/button baseline behavior across Free/Weekly/Fortnightly).
  - Subscribe/active button text sizing and centering refined.

- `MacroBreakdown`:
  - Mobile-first compact width and stronger neon-dark styling.
  - Label treatment aligned toward Stitch (uppercase, tighter tracking, compact emphasis).
  - Kept single-slider-per-macro interaction model and 100% auto-balance note.

- `Dashboard`:
  - Welcome section visually tightened to Stitch-like hero card treatment.
  - Daily Motivation remains directly under the goals sentence with explicit spacing.
  - Content container width constrained for cleaner visual density.

### 5.2 What remains for final near-pixel Stitch pass

To get even closer to attached Stitch images, next pass should focus on:
- Exact typography scale mapping per screen (title/body/caption ratios).
- Fine-grained spacing tokens (8/12/16/20 rhythm) screen-by-screen.
- Card corner radius and shadow opacity parity with Stitch screenshots.
- Icon stroke/fill optical weight normalization.
- Final color calibration pass for cyan/purple accents against dark surfaces.

### 5.3 Handoff for Step 5 continuation

1. **You:** review the current visual pass on key pages and mark any remaining mismatches.
2. **Then me:** run a second pixel-match pass with your notes and update `GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md` again.

---

## 6) Suggested rollout timeline

### Week 1
- Final web polish pass.
- Deploy public URL.
- Full regression QA on production URL.

### Week 2
- Android Capacitor wrapper setup.
- Internal testing + bug fixes.

### Week 3
- Google Play closed/open beta.
- Collect feedback + stabilize.

### Week 4
- iOS wrapper setup + TestFlight.

### Week 5+
- App Store submission.
- Production readiness checklist and launch.

---

## 7) Release readiness checklist (before each store submission)

- Auth login/logout/restore session works.
- Supabase read/write works after app restart.
- Stripe checkout and status handling works.
- No blocked flows on mobile viewport.
- Crash-free smoke tests on at least:
  - 2 Android devices
  - 2 iOS devices.

---

## 8) Quick decision log for this project

- Delivery order: **Web -> Android -> iOS**
- UI workflow: **Cursor first, Stitch polish**
- Hosting: choose one now (Vercel recommended)
- Accounts pending: Google Play + Apple Developer accounts must be created

---

## 10) Current Progress Snapshot (Saved)

Latest completed implementation updates:

- Navigation and structure:
  - Bottom tab order is set to: `Profile`, `TDEE`, `Dashboard`, `Macros`, `Achievements`.
  - `Profile Settings` is restored as a standalone page and is accessible from the hamburger menu.

- UI and interaction polish:
  - Tooltip rendering fixed using portal behavior to avoid clipping issues.
  - Back button removed from page UI flow (tab/hamburger navigation model).
  - Daily Motivation is integrated into Dashboard Welcome section under the goals sentence.
  - Profile page refinements applied (description edit placement, no title tooltip, My Why cleanup).

- Pixel-match pass (Step 5) applied:
  - `PaymentDetails`: visual style moved closer to Stitch, heading adjusted, CTA sizing/alignment improved.
  - `MacroBreakdown`: compact mobile-first styling and hierarchy tightened.
  - `Dashboard`: welcome hero styling moved closer to Stitch.
  - Aqua glow/hover styling expanded across:
    - My TDEE cards
    - Dashboard stat/section cards
    - Achievements sections/cards
    - Profile stat/section cards
    - Community & Help cards

- Documentation updated:
  - `GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md` refreshed with latest rules.
  - This workflow file updated with execution handoff model and step status.

All progress is saved in the project files.

---

## 11) Ready-To-Action Next Steps (Start Here)

### Step A (You)
Choose and complete one hosting setup action:
1. Create Vercel account
2. Connect GitHub repo
3. Create project (do not deploy yet if env vars are not set)

### Step B (Me, immediately after Step A)
I will:
- verify build/deploy config values,
- provide exact env-var checklist,
- prepare final pre-deploy QA checklist.

### Step C (You)
Add production env vars in hosting dashboard and deploy.

### Step D (Me)
I will run full post-deploy action plan:
- live URL smoke-test checklist,
- Stripe return/callback validation checklist,
- route/deeplink test matrix,
- final issue list and fixes.

### Step E (You)
Create Google Play Console + Apple Developer accounts (required manual gating).

### Step F (Me)
I will then action platform rollout sequence:
- Capacitor Android setup plan execution,
- Android beta readiness checklist,
- iOS/TestFlight readiness checklist,
- release artifacts and store submission prep lists.

