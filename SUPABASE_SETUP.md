# Weight Loss Buddy – Supabase Setup Guide

## 1. Environment Variables

Create a file named `.env.local` in the project root (same folder as `package.json`) with:

```
VITE_SUPABASE_URL=https://imtlgitcjdsqirbjjxik.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdGxnaXRjamRzcWlyYmpqeGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTQ4NTMsImV4cCI6MjA4OTEzMDg1M30.D5pc9TDOvxsbOijhQtA1vdMFqQjgzOocUV9t_sDJqGk
```

Restart the dev server after creating or changing `.env.local`.

---

## 2. Run the Database Migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Open `supabase/migrations/001_initial_schema.sql` from this project
5. Copy its contents and paste into the SQL Editor
6. Click **Run**

This creates the tables: `profiles`, `journeys`, `subscriptions`, `tdee_values`, `user_preferences`, `custom_macros`, `support_tickets`, and Row Level Security policies.

7. **Run the auto-profile migration** (fixes "Database error saving new user"):
   - Open `supabase/migrations/003_auto_create_profile.sql`
   - Copy its contents and paste into the SQL Editor
   - Click **Run**

This creates a trigger that auto-creates a profile when a new user signs up, so profile creation succeeds even if the app insert fails.

8. **Run the unique constraints migration** (email and mobile must be unique):
   - Open `supabase/migrations/004_unique_email_mobile_and_check.sql`
   - Copy its contents and paste into the SQL Editor
   - Click **Run**

This adds unique constraints on email and mobile to prevent duplicate records, and RPCs for validation.

---

## 3. Enable Email Confirmation (Required)

1. In Supabase Dashboard: **Authentication** → **Providers** → **Email**
2. Turn **Confirm email** ON so users must verify their email before signing in
3. Customize the confirmation email template if desired

**Note:** Google and Apple sign-in are not configured. Users sign up and sign in with email/password only. These can be added later.

---

## 4. Add Redirect URLs (Required)

In Supabase: **Authentication** → **URL Configuration** → **Redirect URLs**

Add these two URLs:

- `http://localhost:8080/` (after sign-in/sign-up)
- `http://localhost:8080/reset-password` (after password reset link)

For production, also add your live URLs (e.g. `https://yourapp.com/`, `https://yourapp.com/reset-password`)

---

## 5. Install Dependencies and Run

```bash
npm install
npm run dev
```

---

## What’s Implemented

- **Auth**: Email + password sign-up with email confirmation
- **Sign-in options**: Password OR Email OTP (user chooses)
- **OTP**: Email only (no Twilio/SMS)
- **Trusted devices**: On new devices/browsers, OTP is required after password. Known devices skip OTP.
- **Profiles**: Stored in Supabase, synced to localStorage for compatibility
- **Protected routes**: Dashboard and app pages require a signed-in user
- **Logout**: Clears session and redirects to home

## Next Steps (Dashboard + Data Migration)

The Dashboard and other pages still use `localStorage` for journey data, TDEE values, etc. To move fully to Supabase:

1. Run the migration (step 2 above)
2. Implement loading/saving of `journeys` in the Dashboard
3. Implement loading/saving of `tdee_values` in the TDEE calculator
4. Update Profile, Achievements, MacroBreakdown to read from Supabase

The schema and helpers (`supabaseJourney.ts`, `supabaseProfile.ts`) are in place for this migration.
