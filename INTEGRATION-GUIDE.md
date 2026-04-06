# Weight Loss Buddy — Supabase & Stripe Integration Guide

This guide explains **why** Supabase and Stripe are recommended, and gives **step-by-step directions** to add secure auth, profile storage, forgot-password, and payments—**without writing SQL or backend code**. Both platforms are built to work together and scale.

---

## 1. Recommended platforms

### Auth + profiles: **Supabase**

**Yes, Supabase is the best fit for your requirements.**

| Requirement | How Supabase delivers it |
|-------------|---------------------------|
| Users create profiles once | **Supabase Auth** handles sign up. After sign up, the user is “logged in”; their identity is stored securely. |
| Safe, secure, compliant storage | Data lives in **Supabase (PostgreSQL)** with encryption at rest. You never store passwords in your app. Supabase is **SOC 2 Type II** and **GDPR-friendly**. |
| Returning users don’t create a profile again | **Sign in** with email + password (or magic link). Session is stored securely; users come back and are recognized. |
| Forgot password with real auth | **Built-in “Reset password”**: user requests reset → receives email → sets new password. No custom backend needed. |
| Scalable | Managed service; scales with usage. Free tier is enough to start. |
| No coding/SQL experience needed | **Supabase Dashboard** lets you create tables with the UI. You can use **Table Editor** to view/edit data. For auth, you use their **JavaScript client** (copy-paste style); no SQL required for basic flows. |

**What Supabase gives you:**

- **Auth:** Sign up, sign in, sign out, forgot password (email link), optional email verification.
- **Database:** Store profile fields (name, age, height, weight, etc.) linked to the user’s ID.
- **Row Level Security (RLS):** So each user only sees/edits their own data (good for compliance).

---

### Payments: **Stripe**

**Yes, Stripe is the right choice for sensitive payment data.**

| Requirement | How Stripe delivers it |
|-------------|-------------------------|
| Store customer/payment info safely and compliantly | **You do not store card numbers.** Stripe stores all sensitive data. You store only **Stripe IDs** (e.g. `customer_id`, `payment_method_id`) in your database. Stripe is **PCI DSS Level 1** compliant. |
| Safe & compliant | Stripe handles PCI; you avoid handling card data. Works well with GDPR (you store minimal data). |
| Works with Supabase | Store `stripe_customer_id` (and optionally `stripe_subscription_id`) in Supabase, linked to the Supabase user. |
| Seamless for users | **Stripe Checkout** or **Payment Element**: hosted or embedded flows that feel like part of your app. |
| Scalable | Used by large companies; no need to change provider as you grow. |

**What you store in your app (e.g. Supabase):**

- Stripe **Customer ID**
- Optionally: Subscription ID, product/price IDs  
You do **not** store card numbers or full payment details.

---

## 2. How they work together (no delays, seamless)

- **Supabase** = identity + profile data (who the user is, and their fitness profile).
- **Stripe** = payments; linked to the user via Supabase user ID and Stripe Customer ID.

**Typical flow:**

1. User signs up / signs in with **Supabase Auth** (email + password).
2. App loads or creates their **profile** row in Supabase (linked to `auth.uid()`).
3. When they go to pay, you create or retrieve a **Stripe Customer** (using their email/name from Supabase), save `stripe_customer_id` in their profile.
4. You send them to **Stripe Checkout** (or show the Payment Element). After payment, Stripe sends a webhook; you update Supabase (e.g. “premium” flag or subscription status).

No SQL needed for you: Supabase Dashboard + their JS client; Stripe Dashboard + their JS SDK.

---

## 3. Step-by-step: Supabase (auth + profiles + forgot password)

### A. Create a Supabase project (no code)

1. Go to [supabase.com](https://supabase.com) and sign up / sign in.
2. **New project** → choose organization → set project name, database password, region → Create.
3. In the left sidebar: **Authentication** → **Providers** → ensure **Email** is enabled. (Optional: enable “Confirm email” if you want verification.)
4. **Authentication** → **URL Configuration**:
   - Set **Site URL** to your app URL (e.g. `https://yourapp.com` or `http://localhost:8080` for dev).
   - Add **Redirect URLs** (e.g. `http://localhost:8080/**`, `https://yourapp.com/**`).

### B. Create a profiles table (no SQL – use Table Editor)

1. In Supabase: **Table Editor** → **New table**.
2. Name: `profiles` (or `user_profiles`).
3. Add columns (you can add more later):

   - `id` – type **uuid**, **Primary Key**, **Default value**: `gen_random_uuid()` (or leave default; we’ll link to auth later).
   - `user_id` – type **uuid**, **Unique**, **References** `auth.users(id)` (if the UI offers it). This links the row to the logged-in user.
   - `email` – **text**
   - `first_name` – **text**
   - `last_name` – **text**
   - `age` – **int** or **text**
   - `gender` – **text**
   - `height` – **text** (e.g. "175")
   - `current_weight` – **text** (e.g. "70")
   - `activity_level` – **text**
   - `unit_system` – **text** ("metric" / "imperial")
   - `mobile` – **text**
   - `stripe_customer_id` – **text**, nullable (for Stripe later)
   - `created_at` – **timestamptz**, default `now()`
   - `updated_at` – **timestamptz**, default `now()`

4. If there is an option to **enable RLS**, turn it on. Then add a policy: “Users can read/update only rows where `user_id = auth.uid()`.” (Supabase UI often has a “Create policy” wizard.)

### C. Get your Supabase keys

1. **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL**
   - **anon public** key (safe to use in the browser).

### D. Add Supabase to your app

1. Install the client:
   ```bash
   npm install @supabase/supabase-js
   ```
2. Create a file (e.g. `src/lib/supabase.ts`):
   - Create a Supabase client with the Project URL and anon key (from env vars; see below).
3. In **Root** (e.g. `App.tsx`), wrap the app with Supabase’s **Auth context** so you can read the current user and session everywhere.
4. **Environment variables:**  
   Create `.env.local` in the project root:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Use these in `src/lib/supabase.ts` so the client uses your project.

### E. Auth flows (no SQL)

- **Sign up:** Call `supabase.auth.signUp({ email, password })`. Optionally then insert a row into `profiles` with `user_id = user.id` and the rest of the form data.
- **Sign in:** `supabase.auth.signInWithPassword({ email, password })`.
- **Forgot password:**  
  - User clicks “Forgot your password?” → you call `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://yourapp.com/reset-password' })`.  
  - Supabase sends an email with a link.  
  - User clicks link → lands on your `/reset-password` page where you collect the new password and call `supabase.auth.updateUser({ password: newPassword })`.  
  No custom backend; Supabase sends the email and handles the secure link.

### F. Profiles and “don’t create profile again”

- On sign in, you have `user.id` (and optionally `user.email`).
- **Load profile:** `supabase.from('profiles').select('*').eq('user_id', user.id).single()`.
- If no row exists (first time after sign up), **insert** one with the data from your registration form and `user_id = user.id`.
- If a row exists, **returning user**: just load it and show the app; they do not need to “create a profile” again.

All of this is done with the Supabase JavaScript client (no raw SQL in your app). The Dashboard’s Table Editor is enough to inspect or tweak data without SQL.

---

## 4. Step-by-step: Stripe (payments)

### A. Stripe account and keys

1. Sign up at [stripe.com](https://stripe.com).
2. **Developers** → **API keys**.
3. Copy **Publishable key** (starts with `pk_`) and **Secret key** (starts with `sk_`). Use **test keys** while building.

### B. Store only Stripe IDs in your app

- In Supabase `profiles` (or a `subscriptions` table), store:
  - `stripe_customer_id`
  - Optionally: `stripe_subscription_id`, plan name, etc.
- Never store card numbers or full payment details.

### C. Add Stripe to your app

1. Install:
   ```bash
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```
2. For **Checkout** (redirect): create a Checkout Session on your backend (or use Stripe’s “Payment Links” for no backend). For **embedded** card form, use Stripe’s **Payment Element** with `@stripe/react-stripe-js`.
3. When a user is ready to pay:
   - If they don’t have a `stripe_customer_id`, create a Stripe Customer (via your backend or Stripe API with a small serverless function) and save the ID in Supabase.
   - Redirect to **Stripe Checkout** or show the Payment Element; on success, Stripe can send a **webhook** to your backend to update Supabase (e.g. set “premium” or store subscription ID).

### D. Webhooks (so payments and app stay in sync)

- In Stripe Dashboard: **Developers** → **Webhooks** → Add endpoint (your backend URL + e.g. `/api/stripe-webhook`).
- Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- In the webhook handler, verify the event with Stripe, then update Supabase (e.g. profile or subscriptions table). This avoids delays or mismatches: Stripe is the source of truth; your app updates from webhooks.

**Minimal backend:** You need a small backend (e.g. Supabase Edge Functions or a tiny Node/ serverless API) only for:
- Creating Stripe Checkout Sessions or Customers (so the secret key is never in the browser),
- Receiving Stripe webhooks and updating Supabase.

Supabase Edge Functions can do both; no separate server required.

---

## 5. Making the two integrations seamless

- **Single sign-in:** User signs in with Supabase once; use the same session for the whole app, including the payment flow.
- **Link Stripe to user:** When creating a Stripe Customer, pass the Supabase user id (or email) and store `stripe_customer_id` in that user’s profile. All payment flows use this customer.
- **Webhooks:** Use webhooks to update Supabase as soon as a payment or subscription changes. That way the app and Stripe stay in sync without delays.
- **Error handling:** In the app, show clear messages for auth errors (e.g. “Wrong password”) and payment errors (e.g. “Card declined”). Supabase and Stripe return clear error codes.

---

## 6. Quick answers to your questions

| Question | Answer |
|----------|--------|
| Best platform for profiles + auth + “no create profile again”? | **Supabase.** |
| Forgot password with correct auth and verification? | **Supabase Auth** built-in reset: `resetPasswordForEmail` + reset page with `updateUser({ password })`. |
| Scalable and user-friendly without coding/SQL? | **Yes.** Use Supabase Dashboard (Table Editor, Auth settings) and their JS client; no SQL needed for basic use. |
| Best platform for payments and sensitive data? | **Stripe.** You don’t store card data; Stripe does (PCI compliant). |
| Can Supabase + Stripe work together without issues/delays? | **Yes.** Use Supabase for identity and profile; Stripe for payments; link via `stripe_customer_id` and use webhooks so the app and payments stay in sync. |

---

## 7. Next steps in your codebase

1. **Supabase:** Add `@supabase/supabase-js`, create `src/lib/supabase.ts`, add env vars, then replace the current “localStorage-only” auth and profile with Supabase Auth + `profiles` table.
2. **Forgot password:** Replace the current dialog with a “Forgot password?” flow that calls `resetPasswordForEmail` and add a `/reset-password` page that calls `updateUser({ password })`.
3. **Stripe:** Add Stripe SDK, add a small backend (e.g. Supabase Edge Function) for Checkout Session creation and webhooks, and store only `stripe_customer_id` (and related IDs) in Supabase.

If you want, the next step can be concrete code changes in this repo (e.g. Supabase client setup, auth context, and a minimal “forgot password” + reset page) so you can try it locally.

---

## 8. Logo (Fit.jpg)

The app is set to use **Fit.jpg** as the logo on the login/landing page so the image stays high quality and the people in the photo are clearly visible.

- **What to do:** Place (or copy) **Fit.jpg** inside the **`public`** folder so the path is `public/Fit.jpg`. Vite will serve it at `/Fit.jpg` with no compression.
- **Display:** The logo uses `object-contain` and a max width so the whole image (including the three people in the plank) fits without cropping.
