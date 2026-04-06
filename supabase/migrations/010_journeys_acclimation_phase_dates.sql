-- Optional calendar bounds for Acclimation Phase (for reporting; independent of Weight Loss start date)
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS acclimation_phase_start_date TEXT,
  ADD COLUMN IF NOT EXISTS acclimation_phase_end_date TEXT;
