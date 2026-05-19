@echo off
echo ============================================================
echo   Numi v12 - device-trust fingerprint fix + Stitch refresh
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM ─────────────────────────────────────────────────────────────────────
REM v12 — fixes the "verify on each previously-verified device" bug.
REM
REM Root cause (confirmed by reading src/lib/deviceFingerprint.ts):
REM
REM   getDeviceFingerprint() hashed five inputs together:
REM     - getOrCreateInstallId()   (stable UUID in localStorage)
REM     - navigator.userAgent      (CHANGES on every browser auto-update)
REM     - navigator.language
REM     - new Date().getTimezoneOffset()
REM     - navigator.hardwareConcurrency
REM
REM   Chrome / Edge / Safari / Android WebView all auto-update every
REM   ~4 weeks and ship a new userAgent string each time. That change
REM   was enough to flip the hash, evict the device from the
REM   `trusted_devices` row in Supabase, and force an OTP re-verify
REM   even though the install_id (the real device identity) had not
REM   changed. Phone hit it less often because WebView updates less
REM   frequently than desktop Chrome — matches the user's symptom of
REM   "phone signs in fine, desktop always asks again".
REM
REM v12 fix:
REM
REM   getDeviceFingerprint() now hashes ONLY getOrCreateInstallId().
REM   The install_id is already a unique random UUID stored in
REM   localStorage at first visit — it IS the device identity.
REM   Browser version bumps no longer invalidate trust.
REM
REM   Migration cost: each previously-trusted device will OTP-verify
REM   ONCE more (because the new hash differs from the v1 hash stored
REM   in Supabase). After that one OTP, trust is permanent for the
REM   life of that browser profile / app install.
REM
REM Also in v12: GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md refreshed
REM to reflect v11 (data-persistence fixes, hybrid tooltip behavior)
REM and v12 (fingerprint fix), and adds the previously-missing
REM Register and ResetPassword screens.
REM
REM Files touched in v12:
git add src/lib/deviceFingerprint.ts

REM versionCode 11 -> 12, versionName 1.7 -> 1.8. Required by Play Console.
git add android/app/build.gradle

REM Refreshed Stitch bundle reflecting v11 + v12.
git add GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md

git add git-push-update.bat

echo Committing...
git commit ^
  -m "v12: device-trust fingerprint now depends only on install_id" ^
  -m "Previously, getDeviceFingerprint() mixed navigator.userAgent into the hash. Every browser auto-update (Chrome / Edge / Safari / Android WebView) ships a new userAgent string, which changed the hash and silently evicted the device from the Supabase trusted_devices table, forcing an OTP re-verify roughly every 4 weeks. This is why the user saw 'I have to verify on desktop again' even after previously verifying that exact browser." ^
  -m "v12 uses only the localStorage-stored install_id UUID (the actual stable device identity) in the fingerprint hash. Browser version bumps no longer invalidate trust. Existing trusted devices will OTP-verify ONCE on next sign-in (because the new hash differs from the v1 hash stored in Supabase) and then stay trusted permanently for the life of that browser profile / app install." ^
  -m "Also refreshes GOOGLE_STITCH_ALL_SCREENS_SINGLE_BUNDLE.md to reflect v11 (data-persistence, hybrid tooltip) and v12 (fingerprint), and adds previously-missing Register and ResetPassword screens."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!
echo.
echo   No new npm dependencies in v12.
echo.
echo   Next steps (do in this order):
echo.
echo   ----------------------------------------------------------
echo   1. VERCEL (web): auto-deploys from main.
echo   ----------------------------------------------------------
echo      a. Open https://vercel.com -^> your Numi project.
echo      b. Watch Deployments tab until the new commit shows
echo         a green checkmark (~2 min).
echo      c. In your browser, hard-refresh https://fit-pact.vercel.app
echo         with Ctrl+Shift+R.
echo      d. Sign in on a device you have ALREADY verified before.
echo         FIRST TIME ONLY after this deploy you will see the
echo         8-digit OTP code screen — enter the code from your
echo         email. This is the one-time migration cost.
echo      e. Sign out and sign back in on the same browser.
echo         You should go STRAIGHT to the dashboard, no OTP.
echo         That confirms the fingerprint is now stable.
echo.
echo   ----------------------------------------------------------
echo   2. SUPABASE: nothing to do.
echo   ----------------------------------------------------------
echo      No schema, RLS, or function changes. The existing
echo      trusted_devices table is reused — old rows from the v1
echo      fingerprint are simply ignored and replaced on the
echo      one-time re-verify in step 1.
echo.
echo   ----------------------------------------------------------
echo   3. STRIPE: nothing to do.
echo   ----------------------------------------------------------
echo      No billing or webhook changes in v12.
echo.
echo   ----------------------------------------------------------
echo   4. ANDROID (Play Store): rebuild the AAB.
echo   ----------------------------------------------------------
echo      a. Open Command Prompt at this folder and run:
echo            npm run build
echo            npx cap sync android
echo      b. Open Android Studio and open the folder:
echo            android\
echo         (let Gradle sync, ~1-2 min)
echo      c. Top menu: Build -^> Generate Signed Bundle / APK...
echo         Choose: Android App Bundle -^> Next
echo         Use the SAME keystore as the v11 release (a different
echo         keystore is rejected by Play Console).
echo         Build variant: release -^> Create
echo      d. When the build finishes, click the bottom-right
echo         "locate" notification. The AAB is at:
echo            android\app\release\app-release.aab
echo      e. Go to https://play.google.com/console -^> Numi -^>
echo         Testing -^> Internal testing.
echo         Click "Create new release".
echo         Drag in app-release.aab.
echo         Confirm versionCode = 12, versionName = 1.8.
echo         Release notes:
echo            v12 (1.8): Trusted devices stay trusted across
echo            browser updates. Sign-in no longer prompts for
echo            an 8-digit code on devices you have already
echo            verified.
echo         Save -^> Review release -^> Start rollout to Internal
echo         testing -^> Rollout.
echo      f. Wait ~5-15 minutes for Google to process. You will
echo         get an email when the release is available.
echo      g. On your test phone: open Play Store -^> search Numi
echo         -^> tap Update. Open the app. Sign in once (OTP this
echo         one time — the migration cost above). Sign out and
echo         sign back in: should go straight to dashboard with
echo         no OTP.
echo.
echo   ----------------------------------------------------------
echo   5. iOS: no iOS target, nothing to do.
echo   ----------------------------------------------------------
echo.
echo   ----------------------------------------------------------
echo   Testing checklist (please verify after deploys):
echo   ----------------------------------------------------------
echo      [ ] Desktop Vercel: hard-refresh, sign-in, OTP once,
echo          sign-out, sign-in again -^> no OTP.
echo      [ ] Phone (after Play Store update): sign-in OTP once,
echo          sign-out, sign-in again -^> no OTP.
echo      [ ] Existing v11 data-persistence: typing a new value
echo          on phone and signing back in on desktop still shows
echo          that value (cross-device sync still works).
echo      [ ] Completed weeks visible after logout/login on both
echo          devices.
echo ============================================================
pause
