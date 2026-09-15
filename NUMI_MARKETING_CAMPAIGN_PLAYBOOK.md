# Numi Marketing Campaign Playbook

> **Status:** Ready for you to execute when you choose.  
> **Last updated:** July 2026  
> **Approved offer:** 28 days free (full acclimation phase) · Track your weight · Cancel anytime before day 29  
> **Campaign goal:** Spread awareness + **50 waitlist signups** (AU, US, UK)  
> **Ad budget:** Up to **$100/month**  
> **Platforms (Phase 1):** Facebook (paid + organic), LinkedIn (organic)  
> **Live URL (now):** Vercel `*.vercel.app` · Custom domain steps in Section 5  
> **App status:** Android internal testing · iOS after testing complete · Public launch after waitlist phase  

---

## Table of contents

1. [Campaign summary](#1-campaign-summary)
2. [Google Form vs Cursor waitlist — which to use?](#2-google-form-vs-cursor-waitlist--which-to-use)
3. [Waitlist implementation plan (codebase)](#3-waitlist-implementation-plan-codebase)
4. [GA4 and Meta Pixel on Vercel](#4-ga4-and-meta-pixel-on-vercel)
5. [How to get your own domain (step-by-step)](#5-how-to-get-your-own-domain-step-by-step)
6. [Social accounts to create](#6-social-accounts-to-create)
7. [Free posts + paid ads strategy](#7-free-posts--paid-ads-strategy)
8. [Canva copy blocks (28-day offer)](#8-canva-copy-blocks-28-day-offer)
9. [Meta Ads Manager setup ($100/month)](#9-meta-ads-manager-setup-100month)
10. [Subscription pricing note (monthly + annual)](#10-subscription-pricing-note-monthly--annual)
11. [Pre-launch checklist](#11-pre-launch-checklist)
12. [Post-deploy testing checklist](#12-post-deploy-testing-checklist)
13. [30-day execution calendar](#13-30-day-execution-calendar)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Campaign summary

### What you are selling right now

You are **not** selling app downloads yet. You are selling **interest**:

- Join the **Numi waitlist**
- At launch: **28 days free** (full 4-week acclimation phase)
- **Track your weight** from day one
- **Cancel anytime before day 29** — no lock-in for the free period

### One-line pitch (use everywhere)

> **Join the Numi waitlist — get 28 days free (acclimation phase). Track your weight. Cancel anytime before day 29.**

### Audience

- Ages **21 to 65+**
- People who want to take weight loss seriously
- Overweight / obese / health-focused / community-minded
- Beginner-friendly but premium and science-backed tone

### Tone

Motivational · Emotional · Science/trust · Premium · Beginner-friendly

### Long-term vision (not in ads yet, but drives your story)

Build a subscriber base → negotiate partner discounts (e.g. MyFitnessPal integrations, My Muscle Chef) for Numi users.

### Tool stack (all free for creative work)

| Tool | Purpose |
|------|---------|
| **Canva** (free) | Static posts, carousels, ad images |
| **CapCut** (free) | Optional later: 10–15 sec slideshow “videos” without filming |
| **Meta Business Suite** | Schedule Facebook posts, view insights |
| **Google Analytics 4** | Track waitlist page visits and signups |
| **Meta Pixel** | Measure ad performance; optimize for waitlist signups |
| **Meta Ads Manager** | Paid ads ($100/month) |

---

## 2. Google Form vs Cursor waitlist — which to use?

### Short answer

**Use the Cursor-built waitlist on Vercel.** It is the right choice for your goals.

### Comparison

| Factor | Google Form | Cursor waitlist on Vercel |
|--------|-------------|---------------------------|
| **Familiarity** | Many people know Google Forms | Standard web form — equally familiar |
| **Look & feel** | Google branding; looks generic | Matches Numi dark premium brand |
| **GA4 tracking** | Hard to track exact conversions | Full control — fire events on signup |
| **Meta Pixel** | Cannot fire `Lead` on your domain easily | Fire `Lead` when email submitted — **critical for $100 ad budget** |
| **Privacy Policy URL** | Awkward for Meta ad approval | Link to `yoursite.com/privacy` |
| **Data ownership** | Lives in Google Sheets | Lives in **your Supabase** database |
| **UTM links** | Messy redirect | Clean: `yoursite.com/waitlist?utm_source=facebook` |
| **Waitlist → app launch** | Manual export/import emails | Same database ecosystem as Numi app |
| **Time to build** | 30 minutes | 1–2 days (one-time, via Cursor) |

### When Google Form would make sense

Only as a **same-day emergency** if you need a form in the next hour before the Vercel page is ready. Even then, use it briefly and switch to Vercel as soon as possible.

### Your decision (confirmed)

> Build the waitlist with **Cursor**, deploy on **Vercel**, store emails in **Supabase**.

---

## 3. Waitlist implementation plan (codebase)

> **Do this when you are ready.** Ask Cursor to implement using this section as the spec.  
> No code is written until you start this phase.

### 3.1 Overview

Create a public `/waitlist` page that:

1. Explains Numi and the **28-day free offer**
2. Collects **email** (required) and optionally **first name** + **country** (AU / US / UK)
3. Saves to Supabase table `waitlist_signups`
4. Shows a thank-you state
5. Fires **GA4** `waitlist_signup` event and **Meta Pixel** `Lead` event
7. Links to `/privacy` for ad compliance

### 3.2 Files to create or edit

| Action | File | What to do |
|--------|------|------------|
| **Create** | `supabase/migrations/007_waitlist_signups.sql` | New table + RLS policies |
| **Create** | `src/lib/supabaseWaitlist.ts` | `submitWaitlistSignup()` helper |
| **Create** | `src/lib/analytics.ts` | GA4 + Meta Pixel init and event helpers |
| **Create** | `src/pages/Waitlist.tsx` | Public waitlist landing page |
| **Edit** | `src/App.tsx` | Add route: `/waitlist` |
| **Edit** | `index.html` | Optional: update meta description for waitlist SEO |
| **Edit** | `src/pages/Privacy.tsx` | Add short section on analytics cookies (GA4, Meta Pixel) |
| **Edit** | `.env.local.example` | Add `VITE_GA4_MEASUREMENT_ID`, `VITE_META_PIXEL_ID` |
| **Edit** | `git-push-update.bat` | List changed files when deploying |

### 3.3 Database migration (`007_waitlist_signups.sql`)

Run in **Supabase Dashboard → SQL Editor** after creating the file:

```sql
-- 007: Waitlist signups (pre-launch marketing)
CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  first_name TEXT,
  country TEXT CHECK (country IN ('AU', 'US', 'UK', 'OTHER')),
  source TEXT,           -- utm_source or 'direct'
  medium TEXT,           -- utm_medium
  campaign TEXT,         -- utm_campaign
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT waitlist_signups_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created
  ON public.waitlist_signups(created_at DESC);

-- Allow anonymous inserts only (no read for public)
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert waitlist signup"
  ON public.waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role / admin reads (no public SELECT policy)
```

**Why these fields:**

- `email` — your waitlist
- `country` — proves AU/US/UK interest for partners
- `source/medium/campaign` — tells you which ad or post worked
- Unique email — prevents duplicate signups

### 3.4 Supabase helper (`src/lib/supabaseWaitlist.ts`)

Pattern (match existing files like `supabaseUserPrefs.ts`):

```typescript
import { supabase } from "./supabaseClient";

export interface WaitlistSignupInput {
  email: string;
  first_name?: string;
  country?: "AU" | "US" | "UK" | "OTHER";
  source?: string;
  medium?: string;
  campaign?: string;
}

export async function submitWaitlistSignup(
  input: WaitlistSignupInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("waitlist_signups").insert({
    email: input.email.trim().toLowerCase(),
    first_name: input.first_name?.trim() || null,
    country: input.country || null,
    source: input.source || null,
    medium: input.medium || null,
    campaign: input.campaign || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This email is already on the waitlist." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
```

### 3.5 Analytics helper (`src/lib/analytics.ts`)

```typescript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;

export function initAnalytics(): void {
  // Load GA4 script dynamically if ID present
  // Load Meta Pixel script dynamically if ID present
  // (Cursor implements script injection — keeps index.html clean)
}

export function trackWaitlistSignup(): void {
  window.gtag?.("event", "waitlist_signup", { method: "email" });
  window.fbq?.("track", "Lead", {
    content_name: "Numi Waitlist",
    content_category: "waitlist",
  });
}
```

Call `initAnalytics()` once in `main.tsx` or `App.tsx`.  
Call `trackWaitlistSignup()` only after successful Supabase insert.

### 3.6 Waitlist page (`src/pages/Waitlist.tsx`)

**Layout (mobile-first, matches Numi dark theme):**

1. **Hero** — Numi wordmark + headline: *Weight loss, calculated — not guessed.*
2. **Offer card** — 28 days free · Track your weight · Cancel before day 29
3. **3 benefit bullets** — TDEE science, guided acclimation, pocket tracker
4. **Form** — Email (required), First name (optional), Country dropdown (AU/US/UK/Other)
5. **Checkbox** — “I agree to the [Privacy Policy](/privacy)” (required)
6. **Submit** — “Join the Waitlist”
7. **Success state** — “You’re on the list! We’ll email you when Numi launches.”
8. **Footer link** — Privacy Policy

**UTM capture:** On page load, read `URLSearchParams` for `utm_source`, `utm_medium`, `utm_campaign` and pass to `submitWaitlistSignup`.

**Do not require login** — page must work for anonymous visitors.

### 3.7 Route registration (`src/App.tsx`)

Add **above** the catch-all `*` route:

```tsx
import Waitlist from "./pages/Waitlist";
// ...
<Route path="/waitlist" element={<Waitlist />} />
```

### 3.8 Privacy Policy update

Add a section **“Cookies and Analytics”** to `src/pages/Privacy.tsx`:

- We use Google Analytics to understand site traffic
- We use Meta Pixel when you arrive from Facebook/Instagram ads
- These tools may use cookies
- Data is used to measure marketing performance, not sold to third parties

Required for Meta ad approval in AU, US, UK.

### 3.9 Environment variables

**Local** (`.env.local`):

```
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_META_PIXEL_ID=123456789012345
```

**Vercel** → Project → Settings → Environment Variables → add same keys for Production (and Preview if you want).

### 3.10 Deploy to Vercel

1. Open **Command Prompt** in project folder
2. Run `git-push-update.bat` (after Cursor updates it with new files)
3. Wait for Vercel green deploy (automatic on push if repo is connected)
4. Visit: `https://fit-pact.vercel.app/waitlist` (or your Vercel URL)
5. Hard-refresh: **Ctrl + Shift + R**

### 3.11 View waitlist signups in Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your Numi project
3. **Table Editor** → `waitlist_signups`
4. Count rows toward your **50 signup goal**

Optional later: export CSV or send welcome email via Supabase Edge Function.

### 3.12 Cursor prompt (copy-paste when ready)

When you are ready to build, paste this into Cursor:

```
Implement the Numi waitlist per NUMI_MARKETING_CAMPAIGN_PLAYBOOK.md Section 3:
- Migration 007_waitlist_signups.sql
- src/lib/supabaseWaitlist.ts
- src/lib/analytics.ts (GA4 + Meta Pixel from env vars)
- src/pages/Waitlist.tsx (dark theme, mobile-first, UTM capture, privacy checkbox)
- Route /waitlist in App.tsx
- Privacy Policy cookies section
- Update .env.local.example and git-push-update.bat
Do not change unrelated files. Run lint on edited files.
```

---

## 4. GA4 and Meta Pixel on Vercel

### Why you need both

| Tool | Plain-English purpose |
|------|----------------------|
| **GA4** | Tells you how many people visited `/waitlist`, where they came from (Facebook, LinkedIn, direct), and how many submitted the form |
| **Meta Pixel** | Tells Facebook which visitors signed up so it can show ads to **similar people** — makes your $100/month work harder |

Without tracking, you cannot know if Facebook or LinkedIn drove signups.

### GA4 setup (click-by-click)

1. Go to [analytics.google.com](https://analytics.google.com)
2. **Admin** (gear icon, bottom left)
3. **Create** → **Property** → Name: `Numi Waitlist`
4. Choose your timezone (Australia)
5. **Web** data stream → URL: your Vercel URL
6. Copy **Measurement ID** (`G-XXXXXXXXXX`)
7. Add to Vercel env: `VITE_GA4_MEASUREMENT_ID`
8. After deploy, visit `/waitlist` → GA4 **Reports → Realtime** should show 1 active user

**Custom event to watch:** `waitlist_signup` (fire on form success)

### Meta Pixel setup (click-by-click)

1. Go to [business.facebook.com/events_manager](https://business.facebook.com/events_manager)
2. **Connect data sources** → **Web** → **Meta Pixel**
3. Name: `Numi Waitlist Pixel`
4. Copy **Pixel ID** (15-digit number)
5. Add to Vercel env: `VITE_META_PIXEL_ID`
6. Install Chrome extension: **Meta Pixel Helper**
7. Visit live `/waitlist` → extension shows green **PageView**
8. Submit test email → extension shows **Lead**

### Verify after deploy

| Check | How | Pass? |
|-------|-----|-------|
| Page loads | Open `/waitlist` on phone | ☐ |
| Form saves | Submit test email → check Supabase table | ☐ |
| GA4 realtime | analytics.google.com → Realtime | ☐ |
| Pixel PageView | Meta Pixel Helper on page load | ☐ |
| Pixel Lead | Meta Pixel Helper after submit | ☐ |
| Privacy link | Footer links to `/privacy` | ☐ |

---

## 5. How to get your own domain (step-by-step)

Use a custom domain (e.g. `numi.app`, `getnumi.com`) when you want a professional link in ads. Until then, `https://fit-pact.vercel.app/waitlist` works fine.

### Step 1 — Choose and buy a domain

**Registrars (pick one):**

| Registrar | Website | Notes |
|-----------|---------|-------|
| **Cloudflare** | [cloudflare.com/products/registrar](https://www.cloudflare.com/products/registrar/) | At-cost pricing, good DNS |
| **Namecheap** | [namecheap.com](https://www.namecheap.com) | Beginner-friendly |
| **Google Domains / Squarespace** | [domains.squarespace.com](https://domains.squarespace.com) | Simple UI |

**Steps:**

1. Search for your name (e.g. `numi`, `getnumi`, `numifit`)
2. Prefer `.com` or `.app` (`.app` requires HTTPS — fine for Vercel)
3. Add to cart → checkout → pay (~$10–20/year for `.com`)
4. You now **own** the domain

### Step 2 — Add domain in Vercel

1. Go to [vercel.com](https://vercel.com) → your Numi project
2. **Settings** → **Domains**
3. Click **Add**
4. Type your domain: `numi.app` or `www.numi.app`
5. Vercel shows **DNS records** you must create

### Step 3 — Point DNS to Vercel

1. Log in to your registrar (where you bought the domain)
2. Find **DNS Settings** or **Manage DNS**
3. Add records exactly as Vercel shows. Typical setup:

| Type | Name | Value |
|------|------|-------|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

4. Save DNS changes
5. Wait **5 minutes to 48 hours** (usually under 1 hour)
6. Vercel **Settings → Domains** shows green checkmark when ready
7. Vercel auto-provisions **SSL** (padlock in browser)

### Step 4 — Update marketing links

Replace every `fit-pact.vercel.app` link with your custom domain:

- Facebook Page website field
- LinkedIn company website
- All ad URLs
- UTM links in this playbook

### Step 5 — Update Supabase auth URLs (when app launches)

In Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://yourdomain.com`
- **Redirect URLs:** add `https://yourdomain.com/**`

Do this when you move from waitlist-only to full app login.

---

## 6. Social accounts to create

Create these **before** posting or running ads.

### Facebook Page (required for paid ads)

1. [facebook.com/pages/create](https://www.facebook.com/pages/create)
2. Type: **Business or Brand**
3. Name: **Numi**
4. Category: **Health & wellness website**
5. Logo: `resources/icon.png` from project
6. Bio: *Science-backed weight loss tracking. Join the waitlist — 28 days free at launch. Cancel before day 29.*
7. Website: `https://fit-pact.vercel.app/waitlist` (update when domain is ready)

### Meta Business Suite

1. [business.facebook.com](https://business.facebook.com)
2. Create portfolio: **Numi**
3. Add your Facebook Page
4. Use this to schedule posts and view insights

### LinkedIn Company Page (free organic)

1. [linkedin.com/company/setup/new](https://www.linkedin.com/company/setup/new)
2. Name: **Numi**
3. Industry: **Wellness and Fitness**
4. Tagline: *Your pocket weight-loss companion. Waitlist open — 28 days free.*
5. Logo: `resources/icon.png`

### YouTube Channel (optional — defer Shorts)

1. [youtube.com](https://www.youtube.com) → Create channel → **Numi**
2. Reserve name now; post Shorts in Phase 2 if desired

---

## 7. Free posts + paid ads strategy

### Recommended split

| Type | Platform | Frequency | Cost |
|------|----------|-----------|------|
| **Organic (free)** | Facebook Page | 2× per week | $0 |
| **Organic (free)** | LinkedIn Company Page | 2× per week | $0 |
| **Paid** | Facebook Ads only | $3–4/day (~$100/month) | ~$100/month |

**Do not pay for LinkedIn ads yet** — clicks cost $5–15 each and would burn $100 in days.

**Defer Instagram, TikTok, YouTube Shorts** until you want to create simple Canva slideshow clips (no filming).

### Free post schedule (Week 1–4)

| Day | Platform | Content | Copy block |
|-----|----------|---------|------------|
| Mon W1 | Facebook | Hero waitlist image | Block 1 |
| Wed W1 | LinkedIn | Science/trust carousel or image | Block 3 |
| Fri W1 | Facebook | Emotional post | Block 2 |
| Mon W2 | LinkedIn | Text post | Block 7 |
| Wed W2 | Facebook | 28-day offer / urgency | Block 4 |
| Fri W2 | LinkedIn | Community / founding members | Block 5 |
| Mon W3 | Facebook | Reshare best performer | Same as top post |
| Wed W3 | LinkedIn | Science/trust (variation) | Block 3 |
| Mon W4 | Facebook | “X people joined” update | Custom — use signup count |
| Wed W4 | LinkedIn | Milestone post | Custom |

**How to post on Facebook (free):**

1. Go to [business.facebook.com](https://business.facebook.com)
2. Select your Numi Page
3. **Create post** → Upload Canva image
4. Paste caption from copy block
5. Add link: `https://fit-pact.vercel.app/waitlist?utm_source=facebook&utm_medium=organic&utm_campaign=waitlist_w1`
6. Click **Publish** (or **Schedule**)

**How to post on LinkedIn (free):**

1. Go to your **Numi Company Page** (not personal profile)
2. **Start a post** → Add image or document carousel
3. Paste caption
4. Put link in post or first comment: `...?utm_source=linkedin&utm_medium=organic&utm_campaign=waitlist_w1`
5. Click **Post**

### Paid ad schedule

| When | Action |
|------|--------|
| **After** waitlist page + pixel live | Create first campaign |
| **Week 2** | Launch $3/day campaign |
| **Week 3** | Pause worst ad; duplicate best ad |
| **Week 4** | Review: cost per email signup |

See Section 9 for full Ads Manager steps.

### UTM link templates

```
# Facebook organic
https://fit-pact.vercel.app/waitlist?utm_source=facebook&utm_medium=organic&utm_campaign=waitlist

# Facebook paid
https://fit-pact.vercel.app/waitlist?utm_source=facebook&utm_medium=paid&utm_campaign=waitlist_launch

# LinkedIn organic
https://fit-pact.vercel.app/waitlist?utm_source=linkedin&utm_medium=organic&utm_campaign=waitlist
```

Replace `fit-pact.vercel.app` with your custom domain when ready.

---

## 8. Canva copy blocks (28-day offer)

Use **Space Grotesk** or similar clean sans font. Dark background. Logo from `resources/icon.png`.

### Block 1 — Hero waitlist (Facebook + LinkedIn)

```
[LARGE]
Weight loss, calculated — not guessed.

[MEDIUM]
Numi is your pocket weight-loss companion.
Science-backed TDEE. Personal macros. Weekly guidance.

[SMALL]
Join the waitlist → First 28 days FREE at launch
Full acclimation phase · Track your weight · Cancel before day 29

[CTA BUTTON]
Join the Waitlist

[CAPTION]
Most apps guess your calories. Numi calculates your real numbers — then guides you through acclimation first, week by week.

🎁 Waitlist members get the full 4-week acclimation phase free when we launch.
Cancel anytime before day 29 — no commitment.

👉 Join here: [YOUR LINK]

#weightloss #weightlossjourney #caloriecounting #macrotracking #fitnessapp #healthapp #Numi #waitlist
```

### Block 2 — Emotional / motivational

```
[LARGE]
You don't have to do this alone.

[MEDIUM]
Numi fits in your pocket — track your weight, build habits, and see if it's right for you.

[SMALL]
Your first 28 days free. Cancel anytime before day 29.

[CTA BUTTON]
Get Early Access

[CAPTION]
Starting again doesn't mean starting over. It means starting smarter.

Join the Numi waitlist and get your first 28 days free — the full acclimation phase. Track your weight. No payment to join the list. Cancel anytime before day 29 when the app launches.

Join: [YOUR LINK]

#motivation #weightlosstransformation #healthyhabits #Numi #wellness
```

### Block 3 — Science / trust (LinkedIn)

```
[LARGE]
Professional-grade fitness math.
In an app anyone can use.

[MEDIUM]
✓ TDEE & BMI calculations
✓ Macro breakdown
✓ 4-week acclimation phase
✓ Weight tracking from day one
✓ Structured journey when you're ready to continue

[SMALL]
Try 28 days free. Cancel anytime before day 29.

[CTA BUTTON]
Join the Waitlist

[CAPTION]
Precision matters when you're losing weight. Small errors in calorie targets compound into weeks of frustration.

Numi combines science-based calculations with a guided journey — starting with a 4-week acclimation phase so your body and habits adjust before deeper weight loss work.

We're validating interest before launch. Waitlist members get 28 days free at launch. Cancel anytime before day 29.

Join: [YOUR LINK]

#healthtech #fitness #nutrition #data-driven #weightmanagement #startup
```

### Block 4 — Free offer / urgency

```
[LARGE]
28 days. $0. No guesswork.

[MEDIUM]
Waitlist members receive at launch:
→ Full 4-week acclimation phase (free)
→ Weight tracking from day one
→ Cancel anytime before day 29

[SMALL]
See if Numi fits your life — then decide.

[CTA BUTTON]
Claim Your Spot

[CAPTION]
We're limiting early access while we finish the app. Join the waitlist now to lock in 28 days free — the complete acclimation phase.

Track your weight. Cancel anytime before day 29. No payment required to join the list.

[YOUR LINK]

#free #earlyaccess #weightloss #Numi #waitlist
```

### Block 5 — Community / founding members

```
[LARGE]
Be part of something from day one.

[MEDIUM]
Numi is for people who take weight loss seriously — with partner perks on the roadmap.

[SMALL]
Waitlist → 28 days free at launch → cancel before day 29 if it's not for you

[CTA BUTTON]
Join as a Founding Member

[CAPTION]
We're building Numi for people who want a pocket tracker, real guidance, and a community — not another generic calorie app.

Join the waitlist: 28 days free (acclimation phase). Track your weight. Cancel anytime before day 29.

[YOUR LINK]

#community #foundingmembers #health #fitness #Numi
```

### Block 6 — Meta paid ad (paste into Ads Manager)

```
[PRIMARY TEXT]
Still guessing how many calories you need? Numi calculates your real TDEE and guides you week by week. Join the free waitlist — get 28 days free at launch (full acclimation phase). Track your weight. Cancel anytime before day 29.

[HEADLINE]
Join Numi — 28 Days Free

[DESCRIPTION]
Science-backed. Beginner-friendly. AU · US · UK.

[CTA BUTTON]
Sign Up
```

### Block 7 — LinkedIn short post (text-only)

```
We're building Numi — a pocket weight-loss companion for people who want science-backed guidance, not guesswork.

If you've ever quit a diet app because the numbers felt wrong or the plan felt overwhelming, we're designing this for you.

🎯 Waitlist open (goal: first 50 founding members)
🎁 28 days free at launch — full acclimation phase
📊 Track your weight from day one
✅ Cancel anytime before day 29
🌏 Australia · US · UK

Link in comments: [YOUR LINK]

#weightloss #healthapp #wellness #startup
```

### Canva sizes cheat sheet

| Format | Size (px) |
|--------|-----------|
| Facebook / LinkedIn square post | 1080 × 1080 |
| Facebook link ad | 1200 × 628 |
| LinkedIn post image | 1200 × 627 |

---

## 9. Meta Ads Manager setup ($100/month)

### Before you start

- ☐ Facebook Page created
- ☐ Waitlist page live on Vercel
- ☐ Meta Pixel verified (PageView + Lead)
- ☐ Privacy Policy live at `/privacy`
- ☐ 2–3 Canva images exported

### Create campaign (click-by-click)

1. Go to [adsmanager.facebook.com](https://adsmanager.facebook.com)
2. Click **Create**
3. Choose objective: **Sales** or **Leads** → if no Sales catalog, use **Traffic** (sends people to waitlist URL)
4. Campaign name: `Numi Waitlist — AU US UK`
5. Turn **Advantage campaign budget** ON → Daily budget: **$3.50** (~$105/month; adjust to $3.33 for exactly $100)
6. Click **Next**

### Ad set

1. Name: `Waitlist — 21-65 — AU US UK`
2. **Conversion location:** Website
3. **Performance goal:** Maximize number of landing page views (or Conversions if Pixel shows Lead event)
4. **Budget:** inherited from campaign ($3.50/day)
5. **Audience:**
   - Locations: **Australia**, **United States**, **United Kingdom**
   - Age: **21–65+**
   - Gender: All
   - **Detailed targeting** → Interests: weight loss, calorie counting, fitness and wellness, nutrition, MyFitnessPal (if available)
6. **Placements:** Advantage+ placements (or manual: Facebook Feed only to start)
7. Click **Next**

### Ad creative

1. Name: `Static — 28 days free`
2. **Identity:** Select Numi Facebook Page
3. **Ad setup:** Create ad
4. Upload Canva image (1080×1080)
5. **Primary text:** paste from Block 6
6. **Headline:** `Join Numi — 28 Days Free`
7. **Description:** `Science-backed. Beginner-friendly.`
8. **Call to action:** **Sign Up**
9. **Website URL:**
   ```
   https://fit-pact.vercel.app/waitlist?utm_source=facebook&utm_medium=paid&utm_campaign=waitlist_launch
   ```
10. Click **Publish**

### Week 2–4 optimization

| Metric | Good sign | Action if bad |
|--------|-----------|---------------|
| **CPM** (cost per 1000 views) | Under ~$15 | Narrow audience or change image |
| **CPC** (cost per click) | Under ~$1.50 | Test new headline |
| **Cost per waitlist signup** | Under ~$5 | Pause ad; try Block 4 image |
| **Signups in Supabase** | Trending toward 50 | Scale budget slightly if under $5/signup |

### When you hit 50 signups

1. Post milestone on LinkedIn + Facebook
2. Pause or reduce ads
3. Begin partner outreach (MyFitnessPal, My Muscle Chef) with waitlist count as proof of demand

---

## 10. Subscription pricing note (monthly + annual)

### Marketing implication

When you launch beyond the waitlist, paid plans will be **monthly and annual only** — **no fortnightly plan**.

**Do not mention fortnightly pricing in any waitlist marketing.**

Current codebase still references weekly/fortnightly in some files. When you update app pricing, change these (separate task from waitlist):

| File | Change |
|------|--------|
| `src/pages/PaymentDetails.tsx` | Replace Weekly/Fortnightly cards with Monthly/Annual |
| `src/pages/Settings.tsx` | Update plan picker |
| `supabase/functions/billing/index.ts` | Map `monthly` / `annual` price IDs |
| `supabase/migrations/` | New migration: `plan_type IN ('free', 'monthly', 'annual')` |
| Stripe Dashboard | Create Monthly + Annual products/prices |
| This playbook + Canva | Use “plans from $X/month” only after prices are final |

### Suggested marketing language (post-launch, TBD prices)

> After your 28-day free acclimation, continue with a **monthly** or **annual** plan — cancel anytime.

Waitlist phase: **do not quote monthly/annual prices** until you finalize them in Stripe.

---

## 11. Pre-launch checklist

Complete in order. Do not run paid ads until all **Required** items are checked.

### Infrastructure

- [ ] Waitlist page built (`/waitlist`) and deployed on Vercel
- [ ] Supabase `waitlist_signups` table created
- [ ] Test signup appears in Supabase Table Editor
- [ ] GA4 Measurement ID in Vercel env vars
- [ ] Meta Pixel ID in Vercel env vars
- [ ] Privacy Policy updated (analytics cookies section)
- [ ] `/privacy` link on waitlist page

### Accounts

- [ ] Facebook Page created
- [ ] Meta Business Suite connected
- [ ] LinkedIn Company Page created
- [ ] Meta Events Manager pixel verified

### Creative

- [ ] Canva Brand Kit (logo, dark colors)
- [ ] 3–5 static images exported
- [ ] Copy blocks pasted into a Canva doc or notes for easy access

### Legal / offer clarity

- [ ] All copy says **“at launch”** for the 28-day free offer
- [ ] **Cancel before day 29** appears on waitlist page
- [ ] No fortnightly pricing mentioned

### Optional (recommended before scaling ads)

- [ ] Custom domain purchased and pointed to Vercel
- [ ] Export waitlist CSV from Supabase (backup)

---

## 12. Post-deploy testing checklist

Run after every Vercel deploy that touches waitlist or analytics.

### Web

1. Open `https://[your-url]/waitlist` on desktop and phone
2. Page loads with Numi dark theme — no login required
3. Submit email with Privacy checkbox checked → success message
4. Same email again → friendly “already on waitlist” error
5. Check Supabase → new row with correct email
6. GA4 Realtime → shows active user
7. Meta Pixel Helper → PageView on load, Lead on submit
8. Click Privacy link → `/privacy` loads

### Ads (after pixel live)

1. Ads Manager → Events Manager → Test Events — send test Lead
2. Create draft ad → no policy errors on URL
3. Landing URL includes UTM parameters

### Android testing (parallel track)

- Internal testing continues on Android
- Waitlist marketing uses **web URL only** until Play Store listing is public
- When Play Store is live, add store link as secondary CTA — not replacement for waitlist during pre-launch phase

---

## 13. 30-day execution calendar

| Week | Focus | Tasks |
|------|-------|-------|
| **Week 0** | Build | Cursor implements waitlist (Section 3); deploy Vercel; GA4 + Pixel |
| **Week 1** | Organic only | Create accounts; Canva images; 2 Facebook + 2 LinkedIn posts |
| **Week 2** | Ads on | Launch Meta campaign $3/day; monitor Supabase signup count |
| **Week 3** | Optimize | Pause weak ad; post milestone if 25+ signups |
| **Week 4** | Close goal | Target 50 signups; milestone posts; plan partner outreach |

### Success metrics

| Metric | Target |
|--------|--------|
| Waitlist signups | **50** |
| Countries represented | AU, US, UK in `country` column |
| Cost per signup (paid) | Aim under **$5** |
| Best traffic source | Identify via `source` column in Supabase |

---

## 14. Troubleshooting

### “Ad rejected” by Meta

- Ensure `/privacy` is public and linked
- Remove exaggerated claims (“guaranteed weight loss”)
- Use “at launch” for free offer language

### Pixel not firing

- Check Vercel env vars are set for **Production**
- Redeploy after adding env vars
- Disable ad blockers when testing

### No signups from ads

- Verify UTM link opens `/waitlist` not login page
- Check Meta Events Manager for Lead events
- Try broader interests or single country (Australia only) for 7 days

### Duplicate email errors

- Expected behavior — unique constraint working
- Show user-friendly message: “You're already on the list!”

### Google Form temptation

- If someone suggests Google Form for speed, say no for ads — you lose Pixel `Lead` tracking and brand trust

---

## Quick reference

| Item | Value |
|------|-------|
| **Approved offer** | 28 days free · acclimation · cancel before day 29 |
| **Waitlist URL** | `https://fit-pact.vercel.app/waitlist` (update with custom domain later) |
| **Goal** | 50 waitlist signups |
| **Budget** | $100/month Meta Facebook ads |
| **Free posts** | Facebook 2×/week + LinkedIn 2×/week |
| **Build waitlist** | Cursor + Section 3 prompt |
| **View signups** | Supabase → `waitlist_signups` |
| **Future pricing** | Monthly + annual only (no fortnightly) |

---

*When you are ready to build the waitlist, open Cursor and use the prompt in Section 3.12.*
