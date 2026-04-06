-- Unique constraints on email and mobile to prevent duplicate records
-- RPC to check if email/mobile exists (for login and signup validation)
-- Run in Supabase Dashboard > SQL Editor

-- Add unique constraint on email (profiles)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Add unique constraint on mobile (profiles) - only for non-empty values; allows multiple NULLs/empty
DROP INDEX IF EXISTS profiles_mobile_unique_idx;
CREATE UNIQUE INDEX profiles_mobile_unique_idx ON public.profiles (trim(mobile)) WHERE mobile IS NOT NULL AND trim(mobile) != '';

-- RPC: check if email is already registered (checks auth.users)
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE LOWER(trim(email)) = LOWER(trim(p_email))
  );
END;
$$;

-- RPC: check if mobile is already registered
CREATE OR REPLACE FUNCTION public.check_mobile_exists(p_mobile text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_mobile IS NULL OR trim(p_mobile) = '' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE trim(mobile) = trim(p_mobile)
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mobile_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_mobile_exists(text) TO authenticated;
