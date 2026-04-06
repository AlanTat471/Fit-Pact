-- 005: Harden handle_new_user trigger and support_tickets RLS
-- Run this in Supabase Dashboard > SQL Editor AFTER 001-004

-- Fix: handle_new_user should use NEW.email (always set by Supabase Auth)
-- and fall back to a user-unique value to avoid UNIQUE constraint violations on empty email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb;
  fname text;
  lname text;
  uage int;
  ugender text;
  uheight text;
  uweight text;
  uactivity text;
  uemail text;
  umobile text;
  uunit text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  fname := COALESCE(meta->>'firstName', meta->>'first_name', 'User');
  lname := COALESCE(meta->>'lastName', meta->>'last_name', '');
  uage := (meta->>'age')::int;
  ugender := COALESCE(meta->>'gender', 'male');
  uheight := COALESCE(meta->>'height', '175');
  uweight := COALESCE(meta->>'currentWeight', meta->>'current_weight', '70');
  uactivity := COALESCE(meta->>'activityLevel', meta->>'activity_level', 'moderately-active');
  -- Always prefer NEW.email (guaranteed by Supabase Auth for email-based signups).
  -- Fall back to a unique placeholder so we never violate the UNIQUE constraint on profiles.email.
  uemail := COALESCE(NULLIF(TRIM(NEW.email), ''), NULLIF(TRIM(meta->>'email'), ''), 'user_' || NEW.id::text);
  umobile := NULLIF(TRIM(COALESCE(meta->>'mobile', '')), '');
  uunit := COALESCE(meta->>'unitSystem', meta->>'unit_system', 'metric');

  IF uage IS NULL OR uage < 18 THEN
    uage := 30;
  END IF;

  INSERT INTO public.profiles (
    id, first_name, last_name, age, gender, height, current_weight,
    activity_level, email, mobile, unit_system
  ) VALUES (
    NEW.id, fname, lname, uage, ugender, uheight, uweight,
    uactivity, uemail, umobile, uunit
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    height = EXCLUDED.height,
    current_weight = EXCLUDED.current_weight,
    activity_level = EXCLUDED.activity_level,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    unit_system = EXCLUDED.unit_system,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Harden support_tickets: enforce user_id = auth.uid() on insert to prevent spoofing
DROP POLICY IF EXISTS "Authenticated users can submit support" ON public.support_tickets;
CREATE POLICY "Authenticated users can submit support"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
