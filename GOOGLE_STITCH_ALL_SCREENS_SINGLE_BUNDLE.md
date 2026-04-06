# FitPact Google Stitch Single Bundle (All Pages)

Copy and paste this entire bundle into Google Stitch.

## App context

- Existing production app.
- Stack: React + Vite + TypeScript + Tailwind + shadcn/ui.
- Integrations: Supabase (auth/data), Stripe (checkout/webhook).
- Objective: upgrade visual UX without changing business logic.

## Do-not-change rules

- Do not change authentication/session/device-trust flows.
- Do not change Stripe billing logic or webhook flow.
- Do not change Supabase persistence fields.
- Keep all route names and field labels intact.

## Visual direction

- Dark premium fitness aesthetic.
- Blue/green/purple accent system.
- Interactive cards, gradients, subtle depth, polished spacing.
- Mobile-first layouts and responsive behavior.
- Bottom tab order must be: `Profile`, `TDEE`, `Dashboard`, `Macros`, `Achievements`.
- No back button on pages (navigation relies on tabs/hamburger).

## Token bridge

- Colors and styles are mapped from code:
  - `src/index.css`
  - `tailwind.config.ts`
- Use these token anchors:
  - `hsl(var(--background))`, `hsl(var(--foreground))`
  - `hsl(var(--primary))`, `hsl(var(--secondary))`, `hsl(var(--accent))`
  - `var(--gradient-primary)`, `var(--gradient-secondary)`, `var(--gradient-hero)`
  - `var(--shadow-primary)`, `var(--shadow-glow)`

## Screen package A (initial 3)

### Dashboard
- Keep all current metrics and sections.
- Acclimation phase is 4 weeks and baseline average becomes starting weight.
- Emphasize stats cards and weekly tracking hierarchy.
- In Welcome section, keep:
  - `Ready to crush your fitness goals today?`
  - Add a visible gap, then `Daily Motivation` block directly below it.

### My TDEE Calculator
- Keep all calculator inputs/outputs and formulas.
- Improve scanability and section emphasis.
- Better visual hierarchy for personal info vs calculated values.

### Payment Details
- Keep plan cards and subscribe labels exactly:
  - Subscribe - $4.99/billed weekly
  - Subscribe - $8.99/billed fortnightly
- Emphasize active plan and trust/security cues.
- Remove heading tooltip icon.
- Keep all primary action buttons aligned on the same horizontal baseline across Free/Weekly/Fortnightly cards.
- Keep button heights and internal padding consistent across all plans.
- Ensure subscribe text stays centered and does not overflow or misalign.

## Screen package B (remaining)

### Achievements
- Gamified progression grid + unlocked highlights.
- Locked/unlocked visual distinction and interaction cues.

### My Profile
- Rich profile header with motivation, badges, and goals.
- Editable sections with clear affordance.
- Remove tooltip next to name title.
- Place `Edit Profile Description` action next to description text (not next to title).
- Keep `Go to my Dashboard`, `Go to my Community`, and `Go to my Achievements` buttons.
- Remove decorative background quotation mark behind `My Why` text.

### Settings
- Improved tab section hierarchy and clarity.
- Safe destructive action styling.
- This is a standalone page named `Profile Settings`.
- Access path should be available from the hamburger menu.

### Macro Breakdown
- Keep existing macro logic and 100% total behavior.
- Use one main bar only: the slider in each macro row (Protein/Carbs/Fats).
- Do not add separate/duplicate progress bars above or below sliders.
- Include note under total calories: "Total always remains 100%. When one macro changes, the other two auto-adjust proportionally."

### Register/Login/Reset Password
- Trust-forward auth visuals and cleaner guidance.

### About/Privacy/Community Help
- Readable content-first layout and typography improvements.

## Required state variants for each screen

- default
- loading
- error
- success
- empty (where relevant)
- disabled controls (where relevant)

## Required output from Stitch

- For every screen:
  - hierarchy map
  - components list
  - spacing/typography rules
  - color usage map tied to token bridge
  - interaction and motion hints

## Implementation rule on return to Cursor

- Apply only presentation changes:
  - layout wrappers
  - class names/CSS variables
  - visual component composition
- Keep all handlers, calculations, data models, and API calls unchanged.
- For tooltips, render content in a portal so tips are not clipped by parent containers.
