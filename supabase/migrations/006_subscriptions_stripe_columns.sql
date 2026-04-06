-- 006: Add Stripe-specific columns to subscriptions table
-- Run this in Supabase Dashboard > SQL Editor AFTER 001-005

-- stripe_customer_id: links the Supabase user to a Stripe Customer object
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- stripe_price_id: the Stripe Price currently active (maps to plan type)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- plan_type: human-readable plan label, kept in sync with Stripe webhooks
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free'
    CHECK (plan_type IN ('free', 'weekly', 'fortnightly'));

-- cancel_at_period_end: true when user requested cancellation but still has time remaining
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- current_period_start / current_period_end: maps to Stripe billing period
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Index for looking up subscription by Stripe customer
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id);
