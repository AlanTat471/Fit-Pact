-- Persist Acclimation Phase weeks 3 & 4 completion (same as weeks 1 & 2)
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS week3_complete BOOLEAN DEFAULT FALSE;

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS week4_complete BOOLEAN DEFAULT FALSE;
