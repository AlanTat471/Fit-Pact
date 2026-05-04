-- =====================================================================
-- Numi: support_messages table
-- =====================================================================
-- Run this once in the Supabase SQL Editor to create the support inbox
-- that receives Contact Support submissions from the Community & Help
-- page. Idempotent — safe to re-run.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard
--   2. Select your Numi project
--   3. Left sidebar -> SQL Editor -> New query
--   4. Paste THIS WHOLE FILE
--   5. Click "Run" (or press Ctrl+Enter)
--   6. You should see "Success. No rows returned"
--
-- HOW TO READ MESSAGES:
--   - Left sidebar -> Table Editor -> support_messages
--   - Newest messages appear at the top by created_at
-- =====================================================================

-- 1) Table itself
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  name         text not null,
  email        text not null,
  subject      text not null,
  message      text not null,
  status       text not null default 'new',  -- 'new' | 'in_progress' | 'resolved'
  created_at   timestamptz not null default now()
);

-- 2) Helpful index for the Table Editor (sort newest first)
create index if not exists support_messages_created_at_idx
  on public.support_messages (created_at desc);

-- 3) Row Level Security (RLS) — turn it on
alter table public.support_messages enable row level security;

-- 4) Policy: any signed-in user can INSERT their own message.
--    (No SELECT/UPDATE/DELETE policy is granted to end users — only the
--    service role / project admin can read these. That stops one user from
--    reading another user's enquiries.)
drop policy if exists "Authenticated can insert support messages"
  on public.support_messages;

create policy "Authenticated can insert support messages"
  on public.support_messages
  for insert
  to authenticated
  with check (
    -- If a user_id is provided, it must match the caller's auth.uid().
    -- We also allow user_id IS NULL so anonymous-style submissions still work
    -- (the form passes user.id when signed in, NULL otherwise).
    user_id is null or user_id = auth.uid()
  );

-- 5) (Optional) allow anonymous (unauthenticated) inserts too. Uncomment if
--    you want logged-out users to be able to send a support message.
-- drop policy if exists "Anyone can insert support messages"
--   on public.support_messages;
-- create policy "Anyone can insert support messages"
--   on public.support_messages
--   for insert
--   to anon
--   with check (user_id is null);
