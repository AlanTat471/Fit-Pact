# Google Stitch Upload Steps (FitPact)

This workflow keeps your app functional by using Stitch for visual design only, then implementing visuals in Cursor.

## 1) Prepare Inputs From Cursor

- Open these files for screenshot/reference:
  - `src/pages/Dashboard.tsx`
  - `src/pages/Workouts.tsx`
  - `src/pages/PaymentDetails.tsx`
- Use `GOOGLE_STITCH_SCREEN_BRIEFS.md` as the prompt payload.
- Use `src/design/stitch-token-map.json` as your design token contract.

## 2) Create Project in Google Stitch

- Create a new Stitch project/workspace.
- Set project goal: "Mobile-first fitness app UI refresh."
- Paste the relevant brief section for the screen you are generating.

## 3) Attach References

- Add screenshots of current app for each screen.
- Paste brand direction:
  - dark background
  - energetic blue, fresh green, electric purple accents
  - high-contrast readable typography

## 4) Generate Screen Variants

- Generate at least 2 variants per screen:
  - default
  - state variants (loading/error/success where applicable)
- Keep same fields and labels as existing app.

## 5) Export From Stitch

- Export assets/specs (colors, spacing, typography, iconography, shape treatments).
- If Stitch exports CSS tokens, map them to `src/design/stitch-token-map.json`.
- Do not replace app logic files with generated code.

## 6) Implement Back in Cursor

- Apply only visual changes in existing page files:
  - container hierarchy
  - class names
  - presentational wrappers
  - icon/spacing/typography tweaks
- Keep all handlers, API calls, Supabase reads/writes, and Stripe logic untouched.

## 7) Validate Safety

- Confirm these still work after visual updates:
  - login and OTP/device trust flow
  - billing subscribe flow and checkout redirect
  - Supabase persistence for journey/TDEE/macros/profile
- Run lints and a production build to catch regressions.

## 8) Mobile Carry-Over Confirmation

- Because your app is React + Tailwind, these UI changes carry into Capacitor Android/iOS wraps.
- Test responsive widths before native wrapping:
  - 375px
  - 390px
  - 430px
