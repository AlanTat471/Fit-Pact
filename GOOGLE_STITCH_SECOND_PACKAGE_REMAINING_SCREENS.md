# Google Stitch Second Package (Remaining Screens)

Use this as a single copy/paste package in Google Stitch for the remaining screens.

## Global guardrails

- Keep app source of truth in React + TypeScript + Tailwind.
- Keep all Supabase and Stripe logic unchanged.
- Preserve existing labels/field names/routes.
- Produce visual specs and states only.

## Shared style brief

- Dark premium fitness UI.
- Accent palette: energetic blue, fresh green, electric purple.
- Components: rounded cards, depth shadows, subtle motion.
- Accessibility: high contrast, clear focus, mobile-first spacing.

## Screen prompts

### 1) Achievements

- Goal: gamified progress dashboard.
- Include:
  - unlocked summary module
  - recently unlocked list
  - full achievement grid with lock/active styles
- States:
  - no achievements, partially unlocked, fully unlocked
- Motion hints:
  - card hover lift
  - unlocked icon pulse cue

### 2) My Profile

- Goal: motivating personal dashboard with editable profile blocks.
- Include:
  - profile header, badges, goals, motivation quote, progress highlight
  - editable card visual cues and stateful controls
- States:
  - empty profile fields, normal, heavy goal list
- Motion hints:
  - avatar and badge hover scale
  - card elevation transitions

### 3) Settings

- Goal: clear account + privacy + payment controls.
- Include:
  - tabbed sections with improved hierarchy
  - safer destructive action emphasis
- States:
  - success toast state, validation state, disabled state

### 4) Macro Breakdown

- Goal: high-clarity macro planning and interaction screen.
- Include:
  - one and only one interactive bar per macro row (the slider itself)
  - no separate duplicate progress bars above sliders
  - sliders integrated directly into Protein/Carbs/Fats rows
  - recommendation/help zones
- States:
  - default, custom adjusted, out-of-range warning
- Motion hints:
  - slider feedback and smooth percentage/value updates

### 5) Register / Login / Reset Password

- Goal: confidence and trust in auth flow.
- Include:
  - visual hierarchy and secure cues
  - better OTP instruction layout
- States:
  - default, submitting, error, success

### 6) Community Help / About / Privacy

- Goal: content readability and trust.
- Include:
  - content cards with heading anchors
  - improved typography rhythm and spacing

## Export requirements from Stitch

- For each screen, export:
  - component hierarchy
  - spacing and typography rules
  - color usage map aligned to existing token map
  - state variants
  - interaction/motion notes
