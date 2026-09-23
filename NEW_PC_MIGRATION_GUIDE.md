# Numi — New PC Migration Guide

This guide helps you move your **Numi** app project from your current PC to a **new desktop**, so you can continue development, deploy to Vercel, manage Supabase/Stripe, and (when ready) build Android releases.

**Assumption:** You know little about coding tools — every step explains *what*, *why*, and *where*.

**Your choices (from our conversation):**
- Transfer method: **Clone fresh from GitHub** on the new PC (recommended).
- GitHub repository: **https://github.com/AlanTat471/Fit-Pact**
- GitHub status: **Verify the latest changes are pushed** — complete **Part A** on your old PC first.
- OneDrive: **Same OneDrive account** will be available on both PCs.
- Android Studio: **Already installed on the new PC**.
- Android keystore: **Not created yet** — see [Android signing keystore](#android-signing-keystore-explained) below.

---

## Summary of recent app updates (v15 + v16)

These are the main changes from recent work sessions. Your **live site** (Vercel) and **backend** (Supabase) need to match this if you have deployed.

### v15 — Subscriptions, macros, UI locks
| Area | What changed |
|------|----------------|
| **Subscriptions** | Removed Weekly/Fortnightly. Added **Monthly ($8.99/month)** and **Annually ($71.88/year; equivalent to $5.99/month; 33% discount)**. |
| **Stripe / Supabase** | Billing function uses `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` secrets. |
| **Macro Breakdown** | Educational text for Protein, Fats, Carbs (later shortened in v16). |
| **Dashboard** | Acclimation Calories locked (read-only), synced from My TDEE. |
| **My TDEE** | Heading renamed from "Personal Information" to **My Details**. |

### v16 — Paywall, deferred billing, phased features
| Area | What changed |
|------|----------------|
| **4-week free Acclimation** | User logs Acclimation for 4 weeks **without being charged**. |
| **Week 4 popup** | After completing Week 4: **Let's Go!** (charge + unlock) or **No.** (stay on free Acclimation). |
| **Locked phases** | Weight Loss + Maintenance **hidden/locked** until subscribed or Let's Go! succeeds. |
| **Payment Details** | Early subscribe = **save plan + card via Stripe** (no charge until Week 4). Redirect from Week 4 without a plan = **immediate Stripe checkout**. |
| **Recurring subscriptions** | Stripe automatically charges Monthly subscribers every month and Annual subscribers $71.88 every year until cancellation is scheduled. Completing another Numi cycle must **not create a duplicate subscription or an extra one-off charge**. |
| **UI fixes** | Acclimation caption (no "Locked" word), Recommended Steps caption, Payment button text fit, **Annually** + Best Value badge. |
| **Achievements** | **Coming Soon** — tab disabled. |

### v16.6 — Annual repriced to $72; plan cards realigned (Aug 2026)
| Area | What changed |
|------|----------------|
| **Annual price** | **$71.88/year → $72/year (AUD)**. Displays as **$6.00/month** with small line **Billed $72 yearly**. $72 ÷ 12 = $6.00 exactly; saving vs Monthly is $35.88/year (33%); still ~4 months free. |
| **Quarterly plan** | Considered and **rejected** — a middle plan cannibalises Annual and reintroduces the choice overload removed in v15. |
| **Annual badge** | Two lines: **BEST VALUE - 33% DISCOUNT** / **(4 MONTHS FREE)**. |
| **Plan cards** | Shared `PlanCardHeader` for Free / Monthly / Annually with reserved slot heights; price moved out of the button into the header; all three buttons same width, height and baseline. |
| **Settings + switch popup** | Now quote **$72/year** so the app never shows two different annual prices. |
| **Stripe / Supabase** | New yearly price **A$72.00** created in Stripe; its ID replaces Supabase secret `STRIPE_PRICE_ANNUAL`. Billing function **code** unchanged. |
| **Settings** | Privacy Controls + Notifications phased out; **Delete Account** enabled. |
| **Supabase functions** | Updated **`billing`**, new **`delete-account`**. Batch file: `deploy-supabase-functions.bat`. |

### Cloud services (these do NOT move with your PC)
These stay online — you only **log in** on the new PC:

| Service | URL | Purpose |
|---------|-----|---------|
| **GitHub** | https://github.com | Code backup; clone on new PC |
| **Vercel** | https://vercel.com | Live website: https://fit-pact.vercel.app |
| **Supabase** | https://supabase.com | Database, auth, Edge Functions |
| **Stripe** | https://dashboard.stripe.com | Payments |
| **Google Play Console** | https://play.google.com/console | Android store (when you publish) |

---

## Android signing keystore (explained)

**What it is:** A small **secret file** (e.g. `numi-release.jks`) plus a **password** and **alias**. Google Play uses it to prove every app update came from you.

**Have you provided one before?** **No.** There is no `.jks` or `.keystore` file in this project folder. You have run `npm run build` and `npx cap sync android`, but a **signed Play Store release** keystore is created later in **Android Studio** (Generate Signed Bundle).

**What to do for migration:**
- If you **never** uploaded to Play Store: nothing to copy yet. On the new PC you will create the keystore when you are ready for Play release.
- If you **already** created one elsewhere: copy that `.jks` file + write down password and alias on a USB/password manager — **never lose it** (Google cannot reset it).

### Important distinction: recurring payment vs. a second subscription

- Clicking **Let's Go!** the first time creates one Stripe subscription.
- A **Monthly** Stripe subscription renews at **$8.99 every month**.
- An **Annual** Stripe subscription renews at **$72 every year** (was $71.88 before v16.6).
- When the user completes another full Numi cycle, the app must reuse the existing subscription. It must not create a second subscription or make an additional one-off payment.
- If the user selects **Cancel Subscription**, cancellation is scheduled for the end of the current paid period. Access remains until that date; Stripe then stops future renewals.

---

## Part A — On your OLD PC (before switching)

Do this **while you still have access** to the current machine.

### A1. Push latest code to GitHub

1. Open **File Explorer** → go to your project folder:
   ```
   C:\Users\Alan's PC\OneDrive\Desktop\FitPact - Cursor\sweat-script-buddy-main\sweat-script-buddy-main
   ```
2. Double-click **`git-push-update.bat`**.
3. Wait for **"Push complete!"** (or a message that there is nothing new to commit).
4. If push **fails**, note the error and fix before moving (common: need `git pull` first).

**Verify on GitHub (browser):**
1. Go to https://github.com and sign in.
2. Open your **Numi / FitPact** repository.
3. Check the **latest commit date** matches today (or your last work session).
4. Confirm folders exist: `src/`, `supabase/functions/billing/`, `supabase/functions/delete-account/`, `android/`.

### A2. Copy files that are NOT on GitHub — detailed explanation of “Step 2”

**What Step 2 means:** GitHub stores the app’s ordinary code, but it deliberately does **not** store secret local files such as `.env.local`. This protects your Supabase connection details from being published. Therefore, cloning GitHub alone may not be enough to run Numi locally. You must copy the excluded local files separately.

Because the new PC uses your **same OneDrive account**, use a private OneDrive folder:

1. On the **old PC**, open **File Explorer**.
2. Click **OneDrive** in the left sidebar.
3. Create a folder named **`Numi Private Transfer`**.
4. Open your current project folder.
5. In File Explorer, select **View → Show → Hidden items** so files beginning with a dot are visible.
6. Look for **`.env.local`** in the same folder as `package.json`.
7. Copy `.env.local` into **OneDrive → Numi Private Transfer**.
8. Wait until OneDrive shows a green tick beside the copied file. The green tick means it finished uploading.
9. On the **new PC**, sign in to the same OneDrive account, open **Numi Private Transfer**, and copy `.env.local` into `C:\Projects\numi`.
10. Do **not** upload `.env.local` to GitHub or share it publicly.

| File / item | Location on old PC | Why you need it |
|-------------|-------------------|-----------------|
| **`.env.local`** | Project root (same folder as `package.json`) | Supabase URL + anon key for local dev |
| **Android keystore** (if you have one) | Wherever you saved it | Play Store updates |
| **Keystore password + alias** | Your notes / password manager | Required with keystore file |
| **GitHub Personal Access Token** (if you use one for push) | GitHub → Settings → Developer settings | Push from new PC if HTTPS asks for password |
| **Stripe / Supabase passwords** | Your password manager | Log in on new PC |

**If `.env.local` is missing on old PC:**
1. Supabase → your **Numi** project → **Project Settings** → **API**.
2. Copy **Project URL** and **anon public** key.
3. On new PC create `.env.local` from `.env.local.example` (see Part C).

### A3. Optional — export Cursor settings

Cursor rules for Numi live in the repo: `.cursor/rules/fitpact-workflow.mdc` (will clone with GitHub).

Optional on old PC: **Cursor → File → Preferences → Cursor Settings** — note anything custom (model, etc.). Most project behaviour is in the repo.

### A4. Write down these reference values (screenshot or notepad)

| Item | Where to find it |
|------|------------------|
| GitHub repo URL | `https://github.com/AlanTat471/Fit-Pact` |
| Supabase project ref | Supabase URL: `https://XXXX.supabase.co` → `XXXX` is the ref (e.g. `qavbkmmspbtrqqeiczrd`) |
| Vercel project name | Vercel dashboard |
| Live app URL | https://fit-pact.vercel.app |

---

## Part B — On your NEW PC — install software

Install **in this order**. Restart the PC after installs if prompted.

### B1. Google Chrome (or Edge)
- For GitHub, Vercel, Supabase, Stripe dashboards.

### B2. Git for Windows
1. Download: https://git-scm.com/download/win
2. Run installer → accept defaults → ensure **"Git from the command line"** is enabled.
3. **Verify:** Open **Command Prompt** → type:
   ```cmd
   git --version
   ```
   You should see a version number (not "not recognized").

### B3. Node.js (LTS)
1. Download: https://nodejs.org → **LTS** version.
2. Install with defaults.
3. **Verify:**
   ```cmd
   node --version
   npm --version
   ```

### B4. Cursor
1. Download: https://cursor.com
2. Install and sign in with the **same account** as your old PC (optional but keeps history).

### B5. Android Studio — already installed
You have already installed Android Studio on the new PC. During first launch:
1. Select **Standard** setup.
2. Allow Android Studio to install the **Android SDK**, **Platform Tools**, and **Build Tools**.
3. Accept the Android licence prompts.
4. Do not create a new Android project — later you will open Numi’s existing `android` folder.

### B6. Supabase CLI (optional but recommended)
You deploy Edge Functions with **`deploy-supabase-functions.bat`**, which uses:
```cmd
npx supabase ...
```
No separate install required if Node.js works — `npx` downloads it when needed.

---

## Part C — On your NEW PC — get the project

### C1. Choose a folder location

Avoid special characters in the path if possible. Good example:
```
C:\Projects\numi
```
OneDrive paths with apostrophes (like `Alan's PC`) can break some scripts — the batch files in this repo use `cd /d "%~dp0"` to help, but a simple path like `C:\Projects\numi` is safer.

### C2. Clone from GitHub

1. Open **Command Prompt**.
2. Run:
   ```cmd
   mkdir C:\Projects
   cd C:\Projects
   ```
3. Clone your exact repository:
   ```cmd
   git clone https://github.com/AlanTat471/Fit-Pact.git numi
   cd numi
   ```

If GitHub asks for login, use your GitHub account or a **Personal Access Token** as the password.

### C3. Restore `.env.local` from OneDrive

1. On the new PC, open **OneDrive → Numi Private Transfer**.
2. Copy **`.env.local`**.
3. Paste it into **`C:\Projects\numi`**, beside `package.json`.
4. If you could not find the old file, copy `.env.local.example`, rename it `.env.local`, then obtain the values from Supabase and enter:
   ```
   VITE_SUPABASE_URL=https://qavbkmmspbtrqqeiczrd.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
5. Save the file.

### C4. Install project dependencies

**Option 1 — double-click:** `install-deps.bat`

**Option 2 — Command Prompt:**
```cmd
cd C:\Projects\numi
npm install
```

Wait until it finishes with no errors.

**Recommended automatic verification:** Double-click **`verify-new-pc-setup.bat`**. It checks Git, Node, npm, `.env.local`, installs dependencies, runs the production build, and synchronises Android. Do not dispose of the old PC until this reports **SUCCESS**.

### C5. Test local run

**Option 1:** Double-click **`start-dev.bat`**

**Option 2:**
```cmd
npm run dev
```

Open the URL shown (usually http://localhost:5173). You should see the Numi login/home page.

**Option 2 — production build test:**
```cmd
npm run build
```
Should end with `built in ...` and no errors.

---

## Part D — Reconnect cloud accounts (browser)

Log in on the new PC — **no code move required**:

### D1. Vercel
1. https://vercel.com → sign in.
2. Confirm project **fit-pact** (or your name) is linked to GitHub.
3. Future deploys: push to GitHub → Vercel auto-builds (if configured).

### D2. Supabase
1. https://supabase.com → **Numi** project.
2. Edge Functions should show: **billing**, **delete-account** (you deployed these already).
3. To redeploy functions from new PC after code changes:
   - Double-click **`deploy-supabase-functions.bat`**
   - First run: browser login for Supabase CLI.

### D3. Stripe
1. https://dashboard.stripe.com → same account.
2. Products: Numi Monthly / Annual — unchanged.

### D4. GitHub
1. Ensure new PC can **push** (test after a small change or run `git-push-update.bat`).

---

## ⚠️ Read this first — the rule that prevents a silent seven-week gap

Between **27 July and 15 September 2026**, finished work sat on the development PC and never reached GitHub. The live site kept serving the July build, which looked exactly like the app had "regressed". **Nothing was ever lost** — it simply was never pushed.

Two things caused it, and both are now guarded against:

1. **OneDrive is not a backup of your work history.** OneDrive copies files. It knows nothing about git. Uncommitted work follows you to a new PC and stays uncommitted, so everything looks fine locally while GitHub falls further behind.
2. **The old `git-push-update.bat` listed files by hand.** Anything not on the list was skipped without warning. It now uses `git add -A`, which stages everything, and prints the file list before committing and again after pushing.

**The rule: at the end of every working session, double-click `git-push-update.bat`.**

Quick way to check at any time — in Cursor's terminal:

```cmd
git status --short
```

- **No output** = everything is safely on GitHub.
- **Any lines** = that work exists only on this PC. Run `git-push-update.bat`.

And to confirm the live site actually matches your code:

```cmd
git log -1 --pretty="%h %ad %s" --date=short
```

Compare that commit against the newest deployment in the Vercel dashboard. If Vercel is older, your changes are not live.

**Why it matters beyond tidiness:** during this gap, Stripe and Supabase had already been switched to the new A$72.00 annual price while the live site still showed `$71.88`. Anyone subscribing would have been shown one price and charged another. A backend change plus an unpushed frontend is a genuine billing risk, not just untidiness.

---

## Part E — Deploy / update workflow on new PC

| Task | What to run | Where |
|------|-------------|--------|
| Push code to GitHub | `git-push-update.bat` | Project folder |
| Deploy Supabase functions | `deploy-supabase-functions.bat` | Project folder |
| Local preview | `start-dev.bat` or `npm run dev` | Project folder |
| Web production build | `npm run build` | Command Prompt |
| Android sync | `npm run build` then `npx cap sync android` | Command Prompt |
| Live website update | Push to GitHub → Vercel auto-deploy | Browser (Vercel) |

---

## Part F — Verification checklist (new PC)

Run through this after setup:

- [ ] `git --version` works in Command Prompt  
- [ ] `node --version` and `npm --version` work  
- [ ] Project cloned to `C:\Projects\numi` (or your path)  
- [ ] `.env.local` exists with correct Supabase values  
- [ ] `npm install` completed without errors  
- [ ] `npm run build` succeeds  
- [ ] `npm run dev` opens app in browser  
- [ ] Can log in to live site https://fit-pact.vercel.app  
- [ ] Can log in to Supabase, Vercel, Stripe, GitHub in browser  
- [ ] `deploy-supabase-functions.bat` runs (optional test — only if you changed backend)  
- [ ] Cursor opens project folder; rules in `.cursor/rules/` present  

---

## Part G — Android testing on the new PC before going live

Android Studio is already installed. Use the following process to continue testing without publishing publicly.

### G1. Prepare the latest Android files

1. Open **Command Prompt**.
2. Enter:
   ```cmd
   cd C:\Projects\numi
   npm run build
   npx cap sync android
   ```
3. `npm run build` creates the current web app inside `dist`.
4. `npx cap sync android` copies that build into the native Android project. You must repeat both commands after frontend code changes before testing Android.

### G2. Open the correct existing project

1. Start **Android Studio**.
2. On the welcome screen click **Open**. If a project is already open, use **File → Open**.
3. Select **`C:\Projects\numi\android`** — select the `android` folder, not the project root.
4. Click **Trust Project** if prompted.
5. Wait for **Gradle Sync** to finish. Progress appears at the bottom. Do not click Run until indexing/sync completes.

### G3. Test with an Android emulator

1. Android Studio → **Tools → Device Manager**.
2. Click **Create device**.
3. Choose a common phone such as **Pixel 7** → **Next**.
4. Download a recommended stable Android system image if required → **Next → Finish**.
5. In Device Manager click the triangular **Play** icon to start the virtual phone.
6. At the top of Android Studio, select the emulator in the device dropdown.
7. Click the green **Run ▶** button.
8. Numi should install and open on the virtual phone.

### G4. Optional: test on your physical Android phone

1. On the phone open **Settings → About phone**.
2. Tap **Build number** seven times to enable Developer Options.
3. Go to **Settings → System → Developer options** and enable **USB debugging**.
4. Connect the phone by USB and approve the computer when prompted.
5. Select the phone in Android Studio’s device dropdown → click **Run ▶**.

### G5. Test checklist before any Play release

- [ ] App opens without crashing.
- [ ] Login, registration, password reset, and logout work.
- [ ] My TDEE calculations update correctly.
- [ ] Acclimation Calories match My TDEE and cannot be edited on Dashboard.
- [ ] Acclimation Weeks 1–4 save and restore after app restart.
- [ ] Weight Loss and Maintenance remain locked before payment.
- [ ] Monthly displays `$8.99 /month` with the small line `Billed $8.99 monthly`.
- [ ] Annual Plan displays `$6.00 /month` with the small line `Billed $72 yearly`.
- [ ] Headings read **Free Plan**, **Monthly Plan**, **Annual Plan**.
- [ ] The `BEST VALUE` / `(4 MONTHS FREE)` badge sits **on the same line** as the "Annual Plan" heading, not below it.
- [ ] No blank gap under any heading.
- [ ] Exactly **one** word sits under each heading: `Active`, `Selected`, or `Inactive` — and only one card says Active.
- [ ] Buttons match the status: `Selected ✓` + *(your current active plan)* on the active plan, `Select Plan` + *(plan not active)* on the others.
- [ ] Free Plan shows `$0 / 4 weeks` and "Free trial for 4 weeks" (never 14 days).
- [ ] Trial Period reads `Your Free Trial will end on DD/MM/YY`, matching 4 weeks from the journey start date. A user with no journey start date sees "…will end 4 weeks after your journey start date".
- [ ] The three headings, tick lists and brown buttons all line up horizontally across the three cards.
- [ ] **The blue "… is selected" banner must NOT appear when a plan is already live.** If it does, the v16.9 stale-`pendingPlan` fix has not deployed.
- [ ] Subscription & Billing and Profile → Billing name the **same** plan.
- [ ] Dialogs still reachable: tap `Select Plan` on Free while subscribed → "Switch to Free Plan?" warning; tap the pen beside "Card saved via Stripe" → Stripe card update.
- [ ] Stripe test payment flow behaves as intended.
- [ ] Week 4 Let's Go unlocks without creating duplicate subscriptions.
- [ ] Cancel Subscription schedules cancellation at period end.
- [ ] Achievements, Privacy Controls, Notifications, and Download Data show Coming Soon.
- [ ] Delete Account works using a disposable test account.
- [ ] Back button, scrolling, keyboard, orientation, and different screen sizes work.

### G6. Internal testing in Google Play (not public)

When emulator/phone testing passes:
1. Create a signed Android App Bundle in Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. If creating your first keystore, store it in a private OneDrive backup and password manager.
3. Google Play Console → Numi → **Testing → Internal testing → Create new release**.
4. Upload the `.aab`, add release notes, and invite only your tester email addresses.
5. Internal testing is not a public launch. Testers install through Google Play using the private opt-in link.
6. Only move to Production after the internal test checklist passes.

---

## Part H — Troubleshooting

| Problem | Fix |
|---------|-----|
| **Live site shows old screens / prices** | Almost always unpushed work. Run `git status --short` — any output means it is not on GitHub. Run `git-push-update.bat`, wait 2–3 mins for Vercel, hard-refresh with Ctrl+Shift+R. |
| **`Author identity unknown` / `*** Please tell me who you are`** | Git does not know who you are on this PC — a per-machine setting OneDrive does not carry across. Run once in Command Prompt: `git config --global user.name "AlanTat471"` then `git config --global user.email "alan.tat@hotmail.com"`. Staged files are not lost; re-run `git-push-update.bat`. |
| **`npm` blocked: "running scripts is disabled"** | Cursor's terminal was PowerShell. It is now set to Command Prompt (prompt has no `PS`). If you land in PowerShell again, run once: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`. |
| **Asked to verify this device again** | Expected on a new PC, a different browser, or after clearing browser data — device trust is stored in that browser's own `localStorage` (`wlbd_install_id`) and cannot travel between machines. Verify once; it then persists for that browser profile. Chrome, Edge and the Android app each need their own one-time verification. |
| **Stripe checkout shows the wrong amount** | The app never hardcodes prices. Check the Supabase secret `STRIPE_PRICE_ANNUAL` holds the intended Stripe price ID, and that it is from the same Stripe mode (Test or Live) as `STRIPE_SECRET_KEY`. |
| `git is not recognized` | Reinstall Git; restart Command Prompt; check PATH. |
| `npm install` errors | Run from project folder; try `npm install` again; check Node LTS. |
| App blank / no login | Check `.env.local` values; restart `npm run dev`. |
| Push rejected | On old PC push first; or `git pull` before push on new PC. |
| Apostrophe in path errors | Move project to `C:\Projects\numi`. |
| Supabase deploy fails | Run `npx supabase login` in Command Prompt; run `deploy-supabase-functions.bat` again. |

---

## Quick reference — important files in the repo

| File | Purpose |
|------|---------|
| `git-push-update.bat` | Commit + push to GitHub |
| `deploy-supabase-functions.bat` | Deploy billing + delete-account to Supabase |
| `install-deps.bat` | Run `npm install` |
| `start-dev.bat` | Run local dev server |
| `verify-new-pc-setup.bat` | Automatically verify tools, secrets, build, and Android sync on the new PC |
| `.env.local.example` | Template for secrets (copy to `.env.local`) |
| `WEB_ANDROID_IOS_LAUNCH_AND_STITCH_WORKFLOW.md` | Launch checklist |
| `BUGS-AND-DEFECTS.md` | Audit log of fixes (v15, v16) |
| `capacitor.config.ts` | App ID: `com.tatindustries.numi` |

---

## Document history

| Date | Notes |
|------|-------|
| Jul 2026 | Initial migration guide; v15/v16 summary; GitHub clone path; no keystore in repo yet |
| Jul 2026 | Added exact GitHub URL, same-OneDrive transfer, recurring billing clarification, automatic setup verification, and detailed Android testing |
| Aug 2026 | New PC setup completed (Cursor terminal switched to Command Prompt; PowerShell script policy set to RemoteSigned). Added v16.6 — annual repriced to $72/year with realigned plan cards; test checklist prices updated |
| Sep 2026 | v16.7 — found and closed a seven-week deployment gap (work committed but never pushed since 27 Jul). `git-push-update.bat` now stages everything with `git add -A`. Added the "push at the end of every session" rule, device-trust explanation, expanded troubleshooting, and the Android `android/` project brought under version control |

---

*After migration, open this project in Cursor and continue with the same workflow: explain changes, validate flows, update `git-push-update.bat`, deploy Supabase when backend changes.*
