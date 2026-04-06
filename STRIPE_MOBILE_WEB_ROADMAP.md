## Weight Loss Buddy – Stripe, Web Hosting, and Mobile Native Roadmap

This document gives you a **practical, buildable roadmap** for:

- Integrating **Stripe** as your payment system.
- Keeping the app ready for use with **web-based UI tools**, while remaining safe to move into **mobile-native** apps.
- Deploying the app as a **web app**.
- Converting the same app into **Android (Google Play)** and **iOS (Apple App Store)** native apps, **without losing your UI improvements**.
- Running **beta / free / trial** access with full premium features for selected users.

Wherever you see “later” steps, you can safely pause there and come back when you are ready.

---

## 1. Stripe Integration – Step‑by‑Step (for This Supabase App)

Goal: Safely charge users for premium plans using Stripe, with Supabase as your data source of truth.

### 1.1. Create and configure your Stripe account

1. Go to `https://dashboard.stripe.com` and create an account.
2. Complete the **business / individual details** so Stripe can process payments.
3. In the **Developers → API keys** section:
   - Note your **Secret key** (starts with `sk_live_` in production, `sk_test_` in test).
   - Note your **Publishable key** (starts with `pk_live_` or `pk_test_`).
4. Switch to **Test mode** (toggle in top right of Stripe Dashboard) while developing.

### 1.2. Define your products and prices

In Stripe Dashboard:

1. Go to **Products → Add product**.
2. Create products that match your plans, for example:
   - “Weekly Plan” → recurring, AUD $4.99, billed every 1 week.
   - “Fortnightly Plan” → recurring, AUD $8.99, billed every 2 weeks.
3. For each product, create the appropriate **Price**.
4. Note down each **Price ID**, e.g.:
   - `price_weekly_XXXX`
   - `price_fortnightly_YYYY`

You will link these to your `plan_type` in the `subscriptions` table.

### 1.3. Decide on your Stripe integration style

For your stack (React + Vite + Supabase, no custom Node server yet) the **safest and simplest option** is:

- Use **Stripe Checkout** and **Customer Portal**:
  - Frontend redirects the user to a **Stripe-hosted checkout page**.
  - A **Supabase Edge Function** (serverless function) handles:
    - Creating the Checkout Session.
    - Handling Stripe webhooks (subscription events).
  - Your `subscriptions` table and `user_preferences.activePlan` are updated based on webhook events.

You **do not** let Stripe logic live only on the client. All critical subscription state is stored in Supabase.

### 1.4. Wire up environment variables

You will need secrets in **two places**:

1. **Supabase Edge Functions** (backend):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (you get this later when you configure the webhook).
2. **Vite frontend** (if you ever need Stripe.js on the client):
   - `VITE_STRIPE_PUBLISHABLE_KEY`

Never expose your Secret key in the Vite frontend.

### 1.5. Add a Supabase Edge Function for billing

When you are ready to implement:

1. In your project repo, follow Supabase docs to **create an Edge Function**, e.g. `billing`:
   - The function will expose endpoints like:
     - `POST /create-checkout-session`
     - `POST /stripe-webhook`
2. Inside `create-checkout-session`:
   - Read user identity from the Supabase JWT (user must be logged in).
   - Accept a JSON body with `planType: 'weekly' | 'fortnightly'`.
   - Map `planType` to the correct Stripe `price_id`.
   - Create or look up a Stripe **Customer** for this Supabase user:
     - Use `profiles.email` as the Stripe customer email.
   - Create a **Checkout Session**:
     - `mode: 'subscription'`
     - `line_items: [{ price: <price_id>, quantity: 1 }]`
     - `success_url`: your app’s URL, e.g. `https://yourapp.com/billing/success`.
     - `cancel_url`: e.g. `https://yourapp.com/billing/cancelled`.
   - Return the `url` from the session to the frontend.
3. On the frontend (`PaymentDetails` or `Settings` billing section):
   - When user clicks “Subscribe” for a plan:
     - Call the Edge Function `POST /create-checkout-session`.
     - Redirect the browser (or Capacitor Browser on mobile) to the returned `url`.

### 1.6. Handle Stripe webhooks to update Supabase

Stripe will send server‑to‑server events to a **Webhook endpoint** in your Edge Function:

1. In Stripe Dashboard, go to **Developers → Webhooks**.
2. Add a new webhook endpoint pointing to your deployed Edge Function, e.g.:
   - `https://<your-supabase-function-url>/billing/stripe-webhook`
3. Select these event types (at minimum):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Webhook Signing Secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in Supabase.
5. In the `/stripe-webhook` handler:
   - Verify the event with the signing secret.
   - For each relevant event, update:
     - `subscriptions` table:
       - `status` (`active`, `past_due`, `cancelled`, `trialing`, `free`).
       - `stripe_subscription_id`, `stripe_price_id`, `plan_type`.
       - `current_period_start`, `current_period_end`, `cancel_at_period_end`, `expires_at`.
     - `user_preferences`:
       - Set `activePlan` to `'weekly'`, `'fortnightly'`, or `'free'`.

Your frontend already reads `activePlan` from Supabase. Once webhooks write it, the app will automatically reflect the correct plan.

### 1.7. Beta testers and free premium access via Stripe or flags

You have two good options:

1. **Application-level beta flag** (simpler to start):
   - Add a field like `beta_tester` or `role` in `profiles` or `user_preferences`.
   - In the frontend, if `beta_tester = true`, treat them as premium regardless of Stripe subscription.
   - Use this for a **small group** of trusted testers.
2. **Stripe coupons / promo codes**:
   - In Stripe Dashboard, create a **100% off coupon** or promo code.
   - Send private checkout URLs or codes to your beta group.
   - Stripe still tracks them as paying subscriptions (at zero cost), and your backend logic does not need special cases.

You can combine these approaches if desired.

---

## 2. Making the App Ready for Web‑Based UI Tools (and Future Native)

Goal: Design with tools like Figma / Tailwind UI / shadcn, while keeping the code fully compatible with:

- Web hosting.
- Capacitor-based Android/iOS apps.

### 2.1. Principles to follow

1. **Single source of truth = your React codebase**
   - Always bring designs / generated code **into** `src/` (components, CSS/Tailwind).
   - Do not rely on a hosted UI builder as the place where the app actually runs.
2. **Keep logic and layout separated**
   - Pages like `Dashboard`, `Workouts (TDEE)`, `MacroBreakdown`:
     - Keep the **data and calculation logic** in hooks and helpers.
     - Put the **UI structure** (cards, grids, colors) in presentational components.
3. **Use mobile‑friendly patterns from day one**
   - Stick with **responsive layouts** using Tailwind or CSS flex/grid.
   - Avoid absolute positioning that only works on desktop.
   - Keep font sizes and tap targets usable on small screens.

### 2.2. Recommended UI tool stack (compatible with Cursor + mobile)

You can decide later, but these combinations work well:

- **Design**: Figma
  - Draw screens: Login, Dashboard, TDEE, Macros, Profile, Billing, Onboarding.
  - Define color styles and typography scales.
- **Implementation**:
  - **shadcn/ui** + Tailwind CSS (you already use shadcn).
  - Optionally, a Figma → React helper like **Locofy** or **Anima**:
    - These generate React components and Tailwind/CSS that you paste into Cursor.

Why this is safe for mobile:

- Capacitor simply runs the compiled React app in a WebView.
- If it looks good on mobile Chrome/Safari (responsive), it will look the same in the native shell.

### 2.3. Practical workflow

1. In Figma:
   - Design key pages.
   - Use **Auto Layout** and 375px width frames to simulate mobile.
2. In Cursor:
   - For each screen, create or refine components in `src/components` and `src/pages` to match the Figma design.
   - Use Tailwind/shadcn components for layout and styling.
3. Test in your browser at **mobile widths** (DevTools device toolbar).
4. When satisfied, these same components will be included in both:
   - Web builds (`npm run build`).
   - Capacitor builds for Android and iOS.

---

## 3. Web Hosting – Step‑by‑Step (Vercel as a Concrete Example)

You can use Netlify or Cloudflare, but Vercel is a very smooth choice for a Vite + React app.

### 3.1. Prepare the repo

1. Ensure your app builds locally:
   ```bash
   npm install
   npm run build
   ```
2. Commit your code to a Git provider (GitHub is easiest here).

### 3.2. Create a Vercel account and import the project

1. Go to `https://vercel.com` and create an account (use GitHub login).
2. Click **“New Project”**.
3. Import your GitHub repo that contains the Vite app.
4. Vercel will auto‑detect **Vite**:
   - Build command: `npm run build`
   - Output directory: `dist`

### 3.3. Configure environment variables

In the Vercel project settings:

1. Go to **Settings → Environment Variables**.
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Later, `VITE_STRIPE_PUBLISHABLE_KEY` (when you integrate Stripe).
3. For any Supabase environment (test vs prod), use matching keys.

### 3.4. Deploy

1. Click **Deploy**.
2. Vercel builds the app and gives you a **Preview URL**.
3. Once you’re happy, click **Promote to Production** or merge your main branch:
   - Your production URL is something like `https://your-app-name.vercel.app`.

From this point:

- Your **web app** is live.
- Android/iOS builds will load the **same bundle** (either from this URL or bundled locally via Capacitor’s build process).

> You can do the same overall steps with Netlify or Cloudflare Pages; the main differences are UI screens, not concepts.

---

## 4. From Web App to Mobile Native (While Keeping All UI)

Goal: Turn your existing, hosted web app into native Android/iOS apps **without losing designs**.

### 4.1. Introduce Capacitor into your project

From your project root:

1. Install Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Weight Loss Buddy" "com.yourcompany.weightlossbuddy"
   ```
2. In `capacitor.config.(ts|json)`:
   - Set `webDir` to your Vite build folder: `"dist"`.
   - Set `server.url` to your Vercel URL **if** you prefer to load directly from the web in development.

### 4.2. Build the web app and sync to Capacitor

1. Build:
   ```bash
   npm run build
   ```
2. Add platforms when you’re ready:
   ```bash
   npx cap add android
   npx cap add ios   # later, on macOS
   ```
3. Copy the built app into native projects:
   ```bash
   npx cap copy
   ```

At this point, your exact Vite build (with all UI changes) is what Capacitor will ship inside the native app.

### 4.3. Test the Capacitor app

1. For Android:
   ```bash
   npx cap open android
   ```
   - Android Studio opens your native wrapper project.
   - Run it on an emulator or physical device.
2. For iOS (on a Mac):
   ```bash
   npx cap open ios
   ```
   - Xcode opens.
   - Run on simulator or physical device.

All your Figma/Tailwind/shadcn UI improvements are already there, because they were built into `dist`.

---

## 5. Android / Google Play – Beta Launch as a Native App

### 5.1. Prepare release build in Android Studio

1. Build web bundle:
   ```bash
   npm run build
   npx cap copy android
   npx cap open android
   ```
2. In Android Studio:
   - Set **applicationId** (e.g. `com.yourcompany.weightlossbuddy`).
   - Configure app name, icons, themes.
3. Create a **signed release**:
   - Build → Generate Signed Bundle / APK.
   - Choose **Android App Bundle (.aab)** (recommended for Play Store).
   - Create or use an existing keystore; remember the password and alias.

### 5.2. Google Play Console – app setup

1. Create a **Google Play Developer** account.
2. In **Play Console**:
   - Click **Create app**.
   - Fill in app name, language, app type (App), category (Health & Fitness).
   - Agree to policies.
3. Fill out:
   - **Store listing**: description, screenshots, icon, feature graphic.
   - **Content rating**.
   - **App access / privacy policy / data safety** (link to a hosted privacy policy).

### 5.3. Upload your bundle and configure tracks

1. Go to **Testing → Closed testing**:
   - Create a new test track (e.g. “Beta Testers”).
   - Upload your `.aab` build.
   - Add testers by email or a Google Group.
2. Set app to **Free** or configure pricing (you can leave Stripe billing as internal/optional during testing).
3. Roll out to the closed testing track.

### 5.4. Control access and premium features during beta

Use a combination of:

- Play Store closed track (only invited testers can install).
- Supabase flags (`beta_tester`, `role`, or special `activePlan`).

This lets a **small group** of real users install from Play Store, log in, and experience all premium features while you gather feedback.

---

## 6. iOS / Apple App Store – Beta Launch as a Native App

> iOS requires a Mac (or CI service) and is a bit more process‑heavy, but conceptually similar.

### 6.1. Prepare iOS project with Capacitor

On macOS:

1. From your project:
   ```bash
   npm run build
   npx cap copy ios
   npx cap open ios
   ```
2. In Xcode:
   - Set **Bundle Identifier** (e.g. `com.yourcompany.weightlossbuddy`).
   - Choose a **Team** (your Apple Developer account).
   - Set Version and Build numbers.

### 6.2. TestFlight (beta testing for iOS)

1. Archive a build in Xcode:
   - Product → Archive → Distribute via App Store Connect.
2. In App Store Connect:
   - Create a new app entry (if not already).
   - Fill metadata similar to Play Store: description, screenshots, privacy, etc.
3. Once the build is processed:
   - Enable **TestFlight**.
   - Invite testers by email or public link.

Your beta testers can now install the native iOS app and use all features (including Supabase + Stripe flows) just like Android.

### 6.3. Consider Apple’s in‑app purchase policies

Apple is stricter about **digital goods subscriptions**:

- They often require using **StoreKit / In‑App Purchases** for purely digital content.
- Some apps still use Stripe for cross‑platform billing but may need to:
  - Restrict certain purchase flows on iOS.
  - Or treat Stripe more as a web‑only billing option.

You should plan to:

- Start with **TestFlight testing** using your existing Stripe + Supabase flows.
- Then review App Store guidelines before a full public release, and be ready to adjust how billing is presented on iOS if Apple requires it.

---

## 7. Questions / Clarifications to Make the Path Smoother

To fine‑tune this plan when you’re ready to execute, it will help to know:

1. **Business model details**
   - Do you plan only **recurring subscriptions**, or also **one‑time purchases** (e.g. lifetime access, add‑on programs)?
2. **Regions and currencies**
   - Are you targeting a specific country/currency first (e.g. AUD only), or global multi‑currency?
3. **Trial strategy**
   - Do you prefer:
     - Stripe’s built‑in **trial periods** (e.g. 7 days free), or
     - A completely separate “beta tester” group with manual flags in Supabase?
4. **Device requirements**
   - Do you expect most users to use **mobile only**, **web only**, or both?
   - This can influence UI decisions and priority of native features.

Once you decide you’re ready to start executing one part (e.g. “Stripe Checkout on web first”), we can go through that section of this roadmap and I can help you implement it step by step inside this codebase.

