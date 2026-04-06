-- Weight Loss Buddy - Initial Supabase Schema (idempotent)
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times - skips objects that already exist

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  height TEXT NOT NULL,
  current_weight TEXT NOT NULL,
  activity_level TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT,
  unit_system TEXT NOT NULL DEFAULT 'metric',
  profile_description TEXT,
  my_why TEXT,
  my_goals JSONB DEFAULT '[]',
  my_day_goals JSONB DEFAULT '[]',
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOURNEYS (multiple per user: 12-week phases)
-- ============================================
CREATE TABLE IF NOT EXISTS public.journeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'acclimation' CHECK (status IN ('acclimation', 'weight_loss', 'maintenance', 'completed')),
  acclimation_data JSONB DEFAULT '{"week1":{},"week2":{}}',
  weekly_data JSONB DEFAULT '{}',
  previous_week_data JSONB DEFAULT '{}',
  completed_weeks JSONB DEFAULT '[]',
  recommended_steps INTEGER DEFAULT 4000,
  recommended_calories INTEGER,
  weight_loss_start_date TEXT,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  week1_complete BOOLEAN DEFAULT FALSE,
  week2_complete BOOLEAN DEFAULT FALSE,
  starting_weight TEXT,
  journey_complete BOOLEAN DEFAULT FALSE,
  maintenance_phase JSONB,
  step_debug JSONB,
  acclimation_steps INTEGER DEFAULT 4000,
  acclimation_calories INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journeys_user_id ON public.journeys(user_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON public.journeys(user_id, status);

-- ============================================
-- SUBSCRIPTIONS (for Stripe integration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'free' CHECK (status IN ('free', 'active', 'cancelled', 'past_due', 'trialing')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- ============================================
-- TDEE / CALCULATOR VALUES (per user, latest)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tdee_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_bmi TEXT,
  body_fat_percentage TEXT,
  classification TEXT,
  current_weight TEXT,
  weight_to_lose TEXT,
  height TEXT,
  starting_calorie_intake TEXT,
  suggested_weight_goal TEXT,
  values_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tdee_values_user_id ON public.tdee_values(user_id);

-- ============================================
-- USER PREFERENCES (theme, sidebar, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ============================================
-- CUSTOM MACROS (per user)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_macros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  macros_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_macros_user_id ON public.custom_macros(user_id);

-- ============================================
-- TRUSTED DEVICES (for OTP skip on known devices)
-- ============================================
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT DEFAULT 'Unknown device',
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON public.trusted_devices(user_id);

-- ============================================
-- SUPPORT TICKETS (from Contact Support form)
-- ============================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  enquiry TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdee_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if re-running) then recreate
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own journeys" ON public.journeys;
DROP POLICY IF EXISTS "Users can insert own journeys" ON public.journeys;
DROP POLICY IF EXISTS "Users can update own journeys" ON public.journeys;
DROP POLICY IF EXISTS "Users can delete own journeys" ON public.journeys;
CREATE POLICY "Users can view own journeys" ON public.journeys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journeys" ON public.journeys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journeys" ON public.journeys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journeys" ON public.journeys FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own tdee" ON public.tdee_values;
DROP POLICY IF EXISTS "Users can insert own tdee" ON public.tdee_values;
DROP POLICY IF EXISTS "Users can update own tdee" ON public.tdee_values;
DROP POLICY IF EXISTS "Users can delete own tdee" ON public.tdee_values;
CREATE POLICY "Users can view own tdee" ON public.tdee_values FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tdee" ON public.tdee_values FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tdee" ON public.tdee_values FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tdee" ON public.tdee_values FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own macros" ON public.custom_macros;
CREATE POLICY "Users can manage own macros" ON public.custom_macros FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can manage own trusted devices" ON public.trusted_devices FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can submit support" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
CREATE POLICY "Authenticated users can submit support" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
