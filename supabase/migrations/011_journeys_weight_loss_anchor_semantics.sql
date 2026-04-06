-- Journey anchor semantics for weight_loss_start_date:
-- TRUE  = Acclimation Day 1 (current app behaviour)
-- FALSE = legacy: value stored was Weight Loss Week 1 start (subtract 28 days client-side or migrate)

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS weight_loss_start_is_anchor BOOLEAN;

COMMENT ON COLUMN public.journeys.weight_loss_start_is_anchor IS
  'TRUE: weight_loss_start_date is journey anchor (Acclimation day 1). FALSE: legacy WL Week 1 start.';

-- Existing rows: NULL start date → anchor semantics irrelevant (treat as anchor). Non-null → legacy until proven otherwise.
UPDATE public.journeys
SET weight_loss_start_is_anchor = (weight_loss_start_date IS NULL)
WHERE weight_loss_start_is_anchor IS NULL;

-- When optional acclimation start was saved and matches WL Week 1 = acclimation + 28 days, normalize to anchor.
UPDATE public.journeys j
SET
  weight_loss_start_date = j.acclimation_phase_start_date,
  weight_loss_start_is_anchor = true
WHERE
  j.acclimation_phase_start_date IS NOT NULL
  AND j.weight_loss_start_date IS NOT NULL
  AND j.acclimation_phase_start_date ~ '^\d{4}-\d{2}-\d{2}$'
  AND j.weight_loss_start_date ~ '^\d{4}-\d{2}-\d{2}$'
  AND (j.weight_loss_start_date::date - j.acclimation_phase_start_date::date) = 28;

ALTER TABLE public.journeys
  ALTER COLUMN weight_loss_start_is_anchor SET DEFAULT true;

ALTER TABLE public.journeys
  ALTER COLUMN weight_loss_start_is_anchor SET NOT NULL;
