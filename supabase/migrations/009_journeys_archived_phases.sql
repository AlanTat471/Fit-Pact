-- Store completed journey cycles (acclimation + weight loss + maintenance) for dashboard "Archived Phases"
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS archived_phases JSONB DEFAULT '[]'::jsonb;
