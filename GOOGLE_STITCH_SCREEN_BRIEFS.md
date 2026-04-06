# Google Stitch Screen Briefs

Use these briefs directly in Google Stitch as input prompts. These briefs are visual-only and keep existing business logic untouched.

## Logic-Locked Rules (Do Not Change)

- Do not change auth, OTP, trusted-device, or session logic.
- Do not change Stripe checkout/webhook flow or plan state persistence.
- Do not change Supabase reads/writes for journey, TDEE, macros, and profile data.
- Do not rename React route paths or state field names.

## Screen 1: Dashboard

- **Source file**: `src/pages/Dashboard.tsx`
- **Goal**: Transform into a motivational, premium fitness control center.
- **Primary audience**: users tracking fat-loss progress and adherence.
- **Layout structure**:
  - Hero block with welcome message and key CTA.
  - Weight-loss phase container with expandable sections.
  - Stats grid with 5 KPI cards.
  - Weekly/acclimation sections and dialogs.
- **Required components**:
  - Hero banner card with gradient background.
  - KPI cards with icon, value, and short context label.
  - Section containers with clear hierarchy and spacing.
- **States to design**:
  - default, loading, collapsed/expanded, success milestone, warning/anomaly.
- **Interaction notes**:
  - Keep all existing button actions and dialog behavior unchanged.
  - Add visual feedback only (hover, focus, subtle transitions).

## Screen 2: Workouts (TDEE Calculator)

- **Source file**: `src/pages/Workouts.tsx`
- **Goal**: Make calculator easier to scan and more premium.
- **Primary audience**: users entering baseline profile and body metrics.
- **Layout structure**:
  - Header and subtitle.
  - Two-column desktop / single-column mobile:
    - Personal info form.
    - Calculated values panel.
  - Ideal range cards.
  - Action button row.
- **Required components**:
  - Elevated cards with clear section headers.
  - Better grouping of related inputs.
  - Highlighted read-only calculated output fields.
- **States to design**:
  - default, loading profile, input validation error, calculated success.
- **Interaction notes**:
  - Keep current labels, field IDs, and calculation fields intact.
  - Visual refinements only: spacing, color, depth, emphasis.

## Screen 3: Payment Details

- **Source file**: `src/pages/PaymentDetails.tsx`
- **Goal**: Improve trust and conversion without touching billing logic.
- **Primary audience**: users choosing plan and managing payment details.
- **Layout structure**:
  - Heading + trust microcopy.
  - Plan grid (Free, Weekly, Fortnightly).
  - Billing history card.
  - Update payment and cancel dialogs.
- **Required components**:
  - Emphasized active plan card.
  - Strong visual CTA on subscribe buttons.
  - Security/trust indicators in dialogs.
- **States to design**:
  - active plan, inactive plan, loading checkout, error toast state.
- **Interaction notes**:
  - Keep subscribe button actions and API wiring unchanged.
  - Keep copy for billed weekly/fortnightly labels unchanged.

## Stitch Prompt Template (Copy/Paste)

Use this template per screen:

1. Build a mobile-first UI for `<Screen Name>` for a fitness app.
2. Use dark premium theme with electric blue, green, and purple accents.
3. Keep existing data fields, labels, and interactions exactly the same.
4. Improve hierarchy using gradient hero, elevated cards, clear section headers, and micro-interactions.
5. Produce variants for default, loading, error, empty (if applicable), and success.
6. Ensure accessibility: 4.5:1 contrast, clear focus states, tap targets >= 44px.
