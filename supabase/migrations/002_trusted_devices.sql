-- Trusted devices table (for OTP skip on known devices)
-- Run this ONLY if you already ran 001 before and need to add trusted_devices
-- Otherwise, 001_initial_schema.sql already includes this

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
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can manage own trusted devices" ON public.trusted_devices FOR ALL USING (auth.uid() = user_id);
