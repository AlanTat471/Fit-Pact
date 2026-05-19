# Numi — Google Stitch Full Code Bundle (All Screens) — v12 (1.8)

> **Copy and paste this entire document into Google Stitch.**
> All business logic has been replaced with mock data. Only UI/presentation code is included.
>
> **Brand:** The user-facing brand is **Numi** (lowercase wordmark on most surfaces). The project folder is named `FitPact` for historical reasons — ignore that, the app's display name is Numi.
>
> **Bundle version:** v12 (1.8). Reflects all fixes up to and including the v11 data-persistence work and the v12 device-fingerprint fix.

---

## v11 / v12 Changelog (for context only — do not regress these behaviors)

- **Data persistence** — Completed weeks, weekly inputs, acclimation phase, weight-loss phase, maintenance phase all save automatically on input blur, on autosave debounce, on logout, on idle timeout, and on Android background. No data is lost across sign-out / re-sign-in on either device.
- **Tooltip behavior** — All `?` help icons next to section headings open on **hover** on desktop (devices with `hover:hover`) and on **tap** on phone/tablet (touch-only devices). Tap outside or press `Esc` to close on touch devices. Same icon style on both platforms.
- **Device-trust fingerprint (v12)** — Trusted-device check is now based purely on a localStorage UUID, so browser auto-updates (Chrome/Edge/Safari/WebView) no longer force OTP re-verification on previously trusted devices. Visually the OTP screen still exists — it just appears far less often (first sign-in per device only).
- **Bottom nav** — Order is **Profile → TDEE → Dashboard → Macros → Achievements**. Dashboard is the visual center.

---

## App Context

- **Stack:** React 18 + Vite + TypeScript + Tailwind CSS 3 + shadcn/ui (Radix primitives) + Capacitor (Android wrap)
- **Font:** Space Grotesk (Google Fonts) — `font-family: "Space Grotesk", system-ui, sans-serif`
- **Icons:** Google Material Icons (ligature font: `<i class="material-icons">icon_name</i>`)
- **Theme:** Dark premium fitness aesthetic, black background, cyan/green/purple accents
- **Integrations (do NOT change logic):** Supabase (auth/data/RLS), Stripe (billing/webhooks)
- **Objective:** Redesign the visual UX for all screens below. Keep all field labels, route names, and section headings intact. Only change layout, spacing, typography, colors, card styles, and interactions.

---

## Do-Not-Change Rules

1. Do NOT change authentication, session, or device-trust flows.
2. Do NOT change Stripe billing logic or webhook flow.
3. Do NOT change Supabase persistence fields or data shapes (`journeys`, `profiles`, `trusted_devices` tables).
4. Do NOT change route paths or field names.
5. Do NOT change calculation formulas (BMR, TDEE, BMI, macros, weight-loss logic).
6. Keep bottom tab order: **Profile → TDEE → Dashboard → Macros → Achievements**.
7. No back button on pages — navigation is via bottom tabs + hamburger menu.
8. Tooltip dual-mode (hover on desktop, tap on touch) MUST be preserved. Do not switch to hover-only.
9. Autosave / blur-save behavior MUST be preserved on every editable input across the app.

---

## Design Tokens (CSS Variables)

```css
:root {
  /* Background & Foreground */
  --background: 0 0% 0%;
  --foreground: 0 0% 100%;

  /* Card */
  --card: 0 0% 0%;
  --card-foreground: 0 0% 100%;

  /* Popover */
  --popover: 0 0% 5%;
  --popover-foreground: 0 0% 100%;

  /* Primary: Cyan */
  --primary: 187 94% 55%;
  --primary-foreground: 0 0% 0%;
  --primary-glow: 187 94% 65%;

  /* Secondary: Fresh Green */
  --secondary: 142 76% 36%;
  --secondary-foreground: 0 0% 100%;

  /* Accent: Electric Purple */
  --accent: 262 83% 58%;
  --accent-foreground: 0 0% 100%;

  /* Muted */
  --muted: 0 0% 10%;
  --muted-foreground: 0 0% 70%;

  /* Destructive */
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  /* Borders / Inputs / Ring */
  --border: 0 0% 20%;
  --input: 0 0% 15%;
  --ring: 187 94% 55%;

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, hsl(187 94% 55%), hsl(262 83% 58%));
  --gradient-secondary: linear-gradient(135deg, hsl(142 76% 36%), hsl(187 94% 55%));
  --gradient-hero: linear-gradient(135deg, hsl(187 94% 55% / 0.1), hsl(262 83% 58% / 0.1));

  /* Shadows */
  --shadow-primary: 0 10px 30px -10px hsl(187 94% 55% / 0.3);
  --shadow-glow: 0 0 40px hsl(187 94% 55% / 0.2);

  /* Radius */
  --radius: 0.5rem;
}
```

---

## Typography Tokens

| Role | Classes |
|------|---------|
| Hero title | `text-3xl md:text-4xl font-bold tracking-tight` |
| Section title | `text-xl md:text-2xl font-semibold` |
| Body | `text-sm md:text-base` |
| Meta / Caption | `text-xs text-muted-foreground` |
| Uppercase label | `text-[10px] uppercase tracking-widest font-bold` |

## Spacing Tokens

| Role | Classes |
|------|---------|
| Page sections | `space-y-6` |
| Within section | `space-y-4` |
| Card content | `space-y-4` |
| Grid gap | `gap-6` |

## Motion Tokens

| Role | Classes |
|------|---------|
| Card hover | `transition-all duration-300 hover:-translate-y-1 hover:shadow-primary` |
| Button hover | `transition-colors duration-200` |
| Fade-in | `animate-in fade-in-0 duration-500` |

---

## Screen 1: App Shell (Layout + Header + Bottom Nav)

This wraps every authenticated page. Unauthenticated pages (Login, Register, Reset Password) have their own layouts.

```tsx
{/* === APP LAYOUT SHELL === */}
<div className="min-h-screen flex flex-col w-full bg-[#0A0A0A] text-zinc-100">

  {/* Fixed Header */}
  <header className="fixed top-0 w-full z-50 bg-[#131313]/70 backdrop-blur-xl px-6 py-4 flex justify-between items-center shadow-[0_0_20px_rgba(34,211,238,0.1)]">
    {/* Hamburger Menu (opens left-side sheet) */}
    <button className="p-2 text-zinc-400 hover:text-primary transition-colors">
      <i className="material-icons text-xl">menu</i>
    </button>

    {/* Logo (lowercase wordmark) */}
    <h1 className="text-2xl font-bold text-primary lowercase tracking-tight cursor-pointer">
      Numi
    </h1>

    {/* Notifications */}
    <button className="p-2 text-zinc-400 hover:text-primary transition-colors">
      <i className="material-icons text-xl">notifications</i>
    </button>
  </header>

  {/* Main Content Area */}
  <main className="flex-1 pt-20 pb-24 px-4 sm:px-6 overflow-x-hidden">
    {/* Page content renders here */}
  </main>

  {/* Fixed Bottom Navigation */}
  <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#131313]/70 backdrop-blur-xl h-20 flex justify-around items-center px-4 shadow-[0_-10px_30px_rgba(34,211,238,0.05)]">
    {[
      { label: "Profile", icon: "person", active: false },
      { label: "TDEE", icon: "calculate", active: false },
      { label: "Dashboard", icon: "dashboard", active: true },
      { label: "Macros", icon: "restaurant", active: false },
      { label: "Achievements", icon: "emoji_events", active: false },
    ].map((item) => (
      <a
        key={item.label}
        className={`flex flex-col items-center justify-center pt-2 text-[10px] uppercase tracking-widest font-bold transition-colors ${
          item.active
            ? "text-primary border-t-2 border-primary"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <i className="material-icons text-xl">{item.icon}</i>
        <span className="mt-0.5">{item.label}</span>
      </a>
    ))}
  </nav>
</div>
```

### Hamburger Menu (Left Side Sheet)

```tsx
{/* === HAMBURGER MENU (Sheet sliding from left) === */}
<div className="fixed inset-0 z-[60] flex">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50" />

  {/* Sheet */}
  <div className="relative w-72 bg-[#131313] border-r border-zinc-800 h-full flex flex-col">
    {/* Header */}
    <div className="px-6 py-6 border-b border-zinc-800">
      <h2 className="text-2xl font-bold text-primary lowercase tracking-tight">Numi</h2>
    </div>

    {/* Menu Items */}
    <nav className="px-4 py-4 space-y-1">
      {[
        { label: "Profile Settings", icon: "settings" },
        { label: "Payment Details", icon: "credit_card" },
        { label: "Community & Help", icon: "help_outline" },
        { label: "Privacy", icon: "shield" },
        { label: "About Us", icon: "info" },
        { label: "Log Out", icon: "logout" },
      ].map((item) => (
        <button
          key={item.label}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-sm text-zinc-300 hover:text-primary hover:bg-zinc-800/50 transition-colors text-sm font-medium"
        >
          <i className="material-icons text-base">{item.icon}</i>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  </div>
</div>
```

---

## Screen 2: Login Page (Index / Landing)

This is the unauthenticated landing page. No app shell — standalone layout.

```tsx
{/* === LOGIN PAGE === */}
<div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
  <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">

    {/* Left Side — Logo Image */}
    <div className="flex justify-center lg:justify-start">
      <img
        src="/Fit.jpg"
        alt="Numi — Your fitness journey starts here"
        className="w-full max-w-md object-contain rounded-lg shadow-md"
      />
    </div>

    {/* Right Side — Login Card */}
    <div className="flex justify-center lg:justify-end">
      <div className="w-full max-w-md mx-auto bg-background border border-border rounded-lg">
        <div className="text-center space-y-2 p-6 pb-2">
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
          <p className="text-foreground/70 text-sm">Sign in to continue your fitness journey</p>
        </div>
        <div className="p-6 pt-4 space-y-6">
          {/* Password Sign-In Mode */}
          <form className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <button className="w-full h-12 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                Sign In
              </button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground h-auto py-1">
                Sign in with OTP
              </button>
            </div>
          </form>

          <div className="text-center space-y-3">
            <button className="text-sm text-foreground hover:text-primary underline-offset-4 hover:underline">
              Forgot your password?
            </button>
            <div className="text-sm text-foreground">
              Don't have an account?{" "}
              <a className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline">
                Create a new profile
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Sub-state: "Verify new device" OTP card

This card replaces the password card when the user signs in on a device that isn't yet in the `trusted_devices` table for their account. After successful 8-digit code entry, the device is recorded and the user proceeds to the dashboard.

```tsx
{/* === NEW-DEVICE OTP CARD === */}
<div className="w-full max-w-md mx-auto bg-background border border-border rounded-lg">
  <div className="text-center space-y-2 p-6 pb-2">
    <h2 className="text-2xl font-bold text-foreground">Verify new device</h2>
    <p className="text-foreground/70 text-sm">
      We sent an 8-digit code to <span className="font-medium">name@example.com</span>.
      Enter it below to trust this device.
    </p>
  </div>
  <div className="p-6 pt-4 space-y-4">
    <div className="space-y-2">
      <label htmlFor="new-device-otp" className="text-sm font-medium">Enter 8-digit code</label>
      <input
        id="new-device-otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        placeholder="••••••••"
        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base tracking-[0.5em] text-center"
      />
    </div>
    <button className="w-full h-12 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
      Verify and continue
    </button>
    <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground">
      Resend code
    </button>
  </div>
</div>
```

---

## Screen 3: Dashboard

The most complex page. Contains: Welcome hero, Stats cards, Acclimation Phase (4-week grid), Weight Loss Phase (12 weekly tracking tables), Maintenance Phase, and Archived Phases. All data below is mock.

```tsx
{/* === DASHBOARD (inside AppLayout) === */}
<div className="space-y-6 max-w-5xl mx-auto">

  {/* Welcome Hero Section */}
  <div className="flex flex-col space-y-4 rounded-sm border border-primary/30 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 px-6 py-6 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
    <h1 className="text-2xl md:text-4xl font-black tracking-tight text-primary">Hey, John!</h1>
    <div className="pt-3">
      <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">Daily Motivation</p>
      <blockquote>
        <p className="text-base md:text-lg font-medium italic text-zinc-100">
          "The only bad workout is the one that didn't happen."
        </p>
        <footer className="text-sm text-zinc-400 mt-1 italic">— Unknown</footer>
      </blockquote>
    </div>
  </div>

  {/* Weight Loss Phase — Main Container Card */}
  <div className="bg-background border border-primary/20 shadow-primary rounded-lg">
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <i className="material-icons text-xl text-primary">gps_fixed</i>
          Weight Loss Phase
        </h2>
        <button className="border border-border px-3 py-1 rounded-md text-xs hover:bg-muted">
          Collapse All
        </button>
      </div>
    </div>
    <div className="p-6 pt-0 space-y-6">

      {/* Dates & Starting Weight Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Journey start (Acclimation Day 1):</label>
          <input type="date" value="2026-03-23" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium flex items-center gap-1">
            Weight loss end date:
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </label>
          <input type="date" value="2026-07-13" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium flex items-center gap-1">
            Starting Weight (kg):
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </label>
          <input type="text" value="85.0" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* BMI */}
          <div className="bg-background border border-purple-500/20 rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
            <div className="flex flex-row items-center justify-between p-6 pb-2">
              <h3 className="text-sm font-medium text-foreground">Estimated BMI</h3>
              <i className="material-icons text-base text-purple-500">monitor_weight</i>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold text-purple-500">27.8</div>
              <p className="text-xs text-muted-foreground">Body Mass Index</p>
            </div>
          </div>
          {/* Body Fat % */}
          <div className="bg-background border border-teal-500/20 rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
            <div className="flex flex-row items-center justify-between p-6 pb-2">
              <h3 className="text-sm font-medium text-foreground">Estimated Body %</h3>
              <i className="material-icons text-base text-teal-500">trending_up</i>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold text-teal-500">24.3%</div>
              <p className="text-xs text-muted-foreground">Body fat percentage</p>
            </div>
          </div>
          {/* Classification */}
          <div className="bg-background border border-green-500/20 rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
            <div className="flex flex-row items-center justify-between p-6 pb-2">
              <h3 className="text-sm font-medium text-foreground">Classification</h3>
              <i className="material-icons text-base text-green-500">emoji_events</i>
            </div>
            <div className="p-6 pt-0">
              <div className="text-lg font-bold text-green-500">Overweight</div>
              <p className="text-xs text-muted-foreground">Health category</p>
            </div>
          </div>
          {/* Starting Weight */}
          <div className="bg-background border border-indigo-500/20 rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
            <div className="flex flex-row items-center justify-between p-6 pb-2">
              <h3 className="text-sm font-medium text-foreground">Starting Weight</h3>
              <i className="material-icons text-base text-indigo-500">monitor_weight</i>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold text-indigo-500">85.0 kg</div>
              <p className="text-xs text-muted-foreground">From 4-week acclimation average</p>
            </div>
          </div>
          {/* Weight to Lose */}
          <div className="bg-background border border-red-500/20 rounded-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
            <div className="flex flex-row items-center justify-between p-6 pb-2">
              <h3 className="text-sm font-medium text-foreground">Weight to lose (Kg)</h3>
              <i className="material-icons text-base text-red-500">gps_fixed</i>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold text-red-500">12.3 kg</div>
              <p className="text-xs text-muted-foreground">To healthy weight midpoint</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acclimation Phase Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <i className="material-icons text-xl text-primary">timeline</i>
            Acclimation Phase (4 Weeks)
          </h3>
          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">Week 2 of 4</span>
        </div>

        {/* Acclimation Week Grid (4 weeks, 7 days each) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["Week 1", "Week 2", "Week 3", "Week 4"].map((week, idx) => (
            <div key={week} className="bg-[#131313] border border-zinc-800 rounded-sm p-4 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{week}</h4>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500 uppercase">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[85.2, 84.8, 85.1, 84.9, 85.0, 84.7, 85.3].map((w, i) => (
                  <input
                    key={i}
                    type="text"
                    value={idx < 2 ? w : ""}
                    className="w-full h-8 text-center text-xs rounded border border-zinc-700 bg-background"
                    readOnly
                  />
                ))}
              </div>
              {idx < 2 && (
                <p className="text-xs text-zinc-500">Average: <span className="text-primary font-medium">85.0 kg</span></p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Tracking Section (Weight Loss Weeks 1-12) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <i className="material-icons text-xl text-primary">fitness_center</i>
            Weight Loss Tracking
          </h3>
          <span className="text-xs text-zinc-500">Week 3 of 12</span>
        </div>

        {/* Current Week Entry Grid */}
        <div className="bg-[#131313] border border-zinc-800 rounded-sm p-4 space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Current Week (Week 3)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-center">Weight (kg)</th>
                  <th className="p-2 text-center">Steps</th>
                  <th className="p-2 text-center">Calories</th>
                </tr>
              </thead>
              <tbody>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, i) => (
                  <tr key={day} className="border-t border-zinc-800">
                    <td className="p-2 text-sm">{day}</td>
                    <td className="p-2">
                      <input type="text" value={i < 3 ? (83.5 - i * 0.2).toFixed(1) : ""} className="w-full h-8 text-center text-xs rounded border border-zinc-700 bg-background" />
                    </td>
                    <td className="p-2">
                      <input type="text" value={i < 3 ? (8000 + i * 500).toLocaleString() : ""} className="w-full h-8 text-center text-xs rounded border border-zinc-700 bg-background" />
                    </td>
                    <td className="p-2">
                      <input type="text" value={i < 3 ? (2100 - i * 50).toLocaleString() : ""} className="w-full h-8 text-center text-xs rounded border border-zinc-700 bg-background" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">Weekly Averages:</span>
            <span className="text-xs text-primary font-medium">83.2 kg · 8,750 steps · 2,050 cal</span>
          </div>
        </div>

        {/* Completed Weeks Summary */}
        <div className="space-y-2">
          {["Week 1", "Week 2"].map((week, i) => (
            <div key={week} className="flex items-center justify-between bg-[#131313] border border-zinc-800 rounded-sm px-4 py-3">
              <span className="text-sm font-medium">{week}</span>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span>Avg: {(84.2 - i * 0.5).toFixed(1)} kg</span>
                <span>{(7500 + i * 500).toLocaleString()} steps</span>
                <span>{(2200 - i * 50).toLocaleString()} cal</span>
                <i className="material-icons text-sm text-green-500">check_circle</i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Targets Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <i className="material-icons text-xl text-primary">track_changes</i>
          Recommended Targets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#131313] border border-zinc-800 rounded-sm p-4 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Recommended Calories</p>
            <p className="text-2xl font-bold text-primary">2,050</p>
            <p className="text-[10px] text-zinc-500">cal/day</p>
          </div>
          <div className="bg-[#131313] border border-zinc-800 rounded-sm p-4 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Recommended Steps</p>
            <p className="text-2xl font-bold text-secondary">9,000</p>
            <p className="text-[10px] text-zinc-500">steps/day</p>
          </div>
          <div className="bg-[#131313] border border-zinc-800 rounded-sm p-4 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Weight Loss Rate</p>
            <p className="text-2xl font-bold text-accent">0.5 kg</p>
            <p className="text-[10px] text-zinc-500">per week</p>
          </div>
        </div>
      </div>

      {/* Export / Actions */}
      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
          <i className="material-icons text-base">download</i>
          Export to Excel
        </button>
        <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
          <i className="material-icons text-base">delete_sweep</i>
          Clear All Data
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Screen 4: My TDEE Calculator

```tsx
{/* === TDEE CALCULATOR (inside AppLayout) === */}
<div className="space-y-6">

  {/* Header */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-xl border border-primary/20 bg-gradient-hero px-4 py-5 shadow-primary">
    <div>
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        My TDEE Calculator
        <i className="material-icons text-base text-muted-foreground cursor-help">help_outline</i>
      </h1>
      <p className="text-muted-foreground">Calculate your Total Daily Energy Expenditure and ideal body metrics</p>
    </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

    {/* Personal Information Card */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary">
      <div className="p-6 pb-4"><h3 className="text-lg font-semibold">Personal Information</h3></div>
      <div className="p-6 pt-0 space-y-4">
        {/* Gender */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Gender</label>
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2">
              <input type="radio" name="gender" value="male" checked className="accent-primary" />
              <span>Male</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" name="gender" value="female" className="accent-primary" />
              <span>Female</span>
            </label>
          </div>
        </div>
        {/* Age */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Age (years)</label>
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </div>
          <input type="text" value="30" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {/* Height */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Height (cm)</label>
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </div>
          <input type="text" value="175" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {/* Activity Level */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Activity Level</label>
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </div>
          <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option>Moderately Active (x1.55) — 7,500–9,000 steps/day</option>
          </select>
        </div>
        {/* Weight */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Current Body Weight (kg)</label>
            <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
          </div>
          <input type="text" value="85" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>
    </div>

    {/* Calculated Values Card */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary">
      <div className="p-6 pb-4"><h3 className="text-lg font-semibold">Calculated Values</h3></div>
      <div className="p-6 pt-0 space-y-4">
        {[
          { label: "Basal Metabolic Rate (BMR)", value: "1,815", tooltip: true },
          { label: "Total Daily Energy Expenditure (TDEE)", value: "2,813", tooltip: true },
          { label: "Starting Calorie Intake", value: "2,813", tooltip: true },
          { label: "Estimated BMI", value: "27.8", tooltip: true },
          { label: "Estimated Body Fat %", value: "24.3", tooltip: true },
          { label: "Your Classification", value: "Overweight", tooltip: true },
        ].map((field) => (
          <div key={field.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{field.label}</label>
              <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
            </div>
            <input type="text" value={field.value} className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* Ideal Ranges */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Ideal Weight Range */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary">
      <div className="p-6 pb-2">
        <h3 className="text-lg font-semibold">Ideal Weight Range</h3>
        <p className="text-xs text-muted-foreground mt-1">Uses the Robinson formula (1983)</p>
      </div>
      <div className="p-6 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From (kg)</label>
            <input type="text" value="68.4" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Up to (kg)</label>
            <input type="text" value="80.2" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
        </div>
      </div>
    </div>
    {/* Ideal Body Fat Range */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6 pb-2"><h3 className="text-lg font-semibold">Ideal Body Fat Range</h3></div>
      <div className="p-6 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From (%)</label>
            <input type="text" value="10" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Up to (%)</label>
            <input type="text" value="18" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
        </div>
      </div>
    </div>
    {/* Ideal BMI Range */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6 pb-2">
        <h3 className="text-lg font-semibold">Ideal Body Mass Index (BMI) Range</h3>
        <p className="text-xs text-muted-foreground mt-1">18.5–24.9 (WHO standard)</p>
      </div>
      <div className="p-6 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <input type="text" value="18.5" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Up to</label>
            <input type="text" value="24.9" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
          </div>
        </div>
      </div>
    </div>
    {/* Suggested Weight Goal */}
    <div className="border border-primary/20 rounded-lg transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6 pb-2"><h3 className="text-lg font-semibold">Suggested Weight Goal</h3></div>
      <div className="p-6 pt-2 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Weight to Lose (kg)</label>
          <input type="text" value="12.30" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
        </div>
        <p className="text-sm text-muted-foreground">This value represents the weight you need to lose to reach the mid-range of your healthy weight range.</p>
      </div>
    </div>
  </div>

  {/* Action Buttons */}
  <div className="flex flex-col sm:flex-row justify-center gap-4">
    <button className="flex items-center justify-center gap-2 border border-border px-6 py-3 rounded-md text-sm hover:bg-muted transition-colors">
      <i className="material-icons text-base">refresh</i>
      Clear Fields
    </button>
    <button className="flex items-center justify-center gap-2 text-lg font-medium text-foreground hover:text-primary transition-colors">
      Go to your Dashboard
      <i className="material-icons text-base">arrow_forward</i>
    </button>
  </div>
</div>
```

---

## Screen 5: Macro Breakdown

```tsx
{/* === MACRO BREAKDOWN (inside AppLayout) === */}
<div className="space-y-6 max-w-md mx-auto">

  {/* Header */}
  <div className="flex flex-col gap-1">
    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2 text-zinc-100">
      Macro Breakdown
      <i className="material-icons text-base text-muted-foreground cursor-help">help_outline</i>
    </h1>
    <p className="text-zinc-400 text-sm">Calibrated from your daily target calories</p>
  </div>

  {/* Calorie & Macro Card */}
  <div className="bg-[#131313] border border-zinc-800 rounded-lg">
    <div className="p-6 pb-4"><h3 className="text-lg font-semibold text-zinc-100">Calorie & Goal Information</h3></div>
    <div className="p-6 pt-0 space-y-4">

      {/* Daily Calories */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Daily Calories</label>
          <i className="material-icons text-sm text-muted-foreground cursor-help">help_outline</i>
        </div>
        <input type="text" value="2,813" className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" readOnly />
      </div>

      {/* Macro Sliders */}
      <div className="space-y-6 pt-4 border-t border-zinc-800">
        <h3 className="font-semibold text-zinc-100 uppercase tracking-wide text-sm">Daily Target</h3>

        {/* Protein */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-primary uppercase tracking-widest text-xs">Protein</label>
            <span className="text-sm text-muted-foreground">30%</span>
          </div>
          <input type="range" min="0" max="100" value="30" className="w-full accent-[hsl(187,94%,55%)]" />
          <div className="flex justify-between text-sm">
            <span>211g</span>
            <span>844 calories</span>
          </div>
        </div>

        {/* Carbohydrates */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-secondary uppercase tracking-widest text-xs">Carbs</label>
            <span className="text-sm text-muted-foreground">50%</span>
          </div>
          <input type="range" min="0" max="100" value="50" className="w-full accent-[hsl(142,76%,36%)]" />
          <div className="flex justify-between text-sm">
            <span>352g</span>
            <span>1,407 calories</span>
          </div>
        </div>

        {/* Fats */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-bold text-accent uppercase tracking-widest text-xs">Fats</label>
            <span className="text-sm text-muted-foreground">20%</span>
          </div>
          <input type="range" min="0" max="100" value="20" className="w-full accent-[hsl(262,83%,58%)]" />
          <div className="flex justify-between text-sm">
            <span>63g</span>
            <span>563 calories</span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex justify-between items-center font-medium">
            <span>Total Daily Calories</span>
            <span>2,813</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total always remains 100%. When one macro changes, the other two auto-adjust proportionally.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 pt-4">
          <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            Recommended
            <i className="material-icons text-base">help_outline</i>
          </button>
          <button className="border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            Customise Macro
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## Screen 6: Profile

```tsx
{/* === PROFILE PAGE (inside AppLayout) === */}
<div className="space-y-8 animate-in fade-in-0 duration-500">

  {/* Profile Header */}
  <section className="text-center space-y-4">
    <div className="relative w-32 h-32 mx-auto rounded-2xl overflow-hidden border-2 border-primary/30 p-1 bg-gradient-to-br from-primary/20 to-accent/20">
      <div className="w-full h-full rounded-xl bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-400">
        JD
      </div>
      <span className="absolute bottom-2 right-2 bg-green-400 text-[#0A0A0A] text-[10px] font-black px-2 py-0.5 rounded-sm uppercase">PRO</span>
      <button className="absolute bottom-1 left-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90">
        <i className="material-icons text-base">photo_camera</i>
      </button>
    </div>
    <div>
      <h2 className="text-3xl font-black tracking-tighter uppercase italic">John Doe</h2>
      <div className="mt-1 flex items-center justify-center gap-2">
        <p className="text-zinc-500 text-xs italic uppercase tracking-widest">Fitness enthusiast and runner</p>
        <button className="h-6 w-6 flex items-center justify-center">
          <i className="material-icons text-sm text-zinc-400">edit</i>
        </button>
      </div>
    </div>
  </section>

  {/* Stats Row */}
  <div className="grid grid-cols-3 gap-4">
    <div className="bg-[#131313] p-4 rounded-sm border-l-2 border-primary text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <span className="block text-2xl font-black text-primary">3</span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Badges</span>
    </div>
    <div className="bg-[#131313] p-4 rounded-sm border-l-2 border-accent text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <span className="block text-2xl font-black text-accent">-2.1 kg</span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Weight change</span>
    </div>
    <div className="bg-[#131313] p-4 rounded-sm border-l-2 border-green-400 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <span className="block text-2xl font-black text-green-400">14</span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Streak</span>
    </div>
  </div>

  {/* Achievement Icons */}
  <div className="flex flex-wrap gap-2 justify-center">
    {[
      { icon: "bolt", color: "text-primary", bg: "bg-primary/10" },
      { icon: "directions_walk", color: "text-secondary", bg: "bg-secondary/10" },
      { icon: "check_circle", color: "text-accent", bg: "bg-accent/10" },
    ].map((a, i) => (
      <div key={i} className={`w-8 h-8 rounded-full ${a.bg} flex items-center justify-center cursor-pointer hover:scale-110 transition-transform`}>
        <i className={`material-icons text-base ${a.color}`}>{a.icon}</i>
      </div>
    ))}
  </div>

  {/* My Why Card */}
  <section className="space-y-4">
    <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">My Why</h3>
    <div className="bg-[#131313] p-8 rounded-sm border-l-4 border-primary relative transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <p className="text-xl font-medium leading-relaxed italic text-zinc-200">
        "I want to be healthier and have more energy for my family. I want to feel confident in my clothes and improve my overall well-being."
      </p>
      <button className="mt-4 flex items-center text-primary text-xs font-bold uppercase tracking-widest">
        <i className="material-icons text-sm mr-1">edit</i> Edit Statement
      </button>
    </div>
  </section>

  {/* Daily Goals Section */}
  <section className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Daily Goals</h3>
      <button className="text-primary"><i className="material-icons text-xl">add_circle</i></button>
    </div>
    <div className="space-y-2">
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
        <div key={day} className="bg-[#131313] border border-zinc-800 rounded-sm overflow-hidden transition-all duration-300 hover:shadow-primary">
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors">
            <h4 className="font-bold text-sm">{day}</h4>
            <span className="text-xs text-zinc-500">{day === "Monday" ? "2 goals" : "0 goals"}</span>
          </div>
          {day === "Monday" && (
            <div className="px-4 pb-3 space-y-1">
              <div className="flex items-center justify-between p-2 rounded-sm border border-primary/30">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-sm flex items-center justify-center bg-primary">
                    <i className="material-icons text-xs text-[#0A0A0A]">check</i>
                  </div>
                  <span className="text-sm font-medium line-through text-zinc-500">Walk 10,000 steps</span>
                </div>
                <span className="text-xs text-zinc-500">10,000/10,000</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-sm border border-zinc-800">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-sm border-2 border-zinc-700" />
                  <span className="text-sm font-medium">Drink 3L water</span>
                </div>
                <span className="text-xs text-zinc-500">2/3</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </section>

  {/* Navigation Buttons */}
  <div className="flex flex-wrap gap-4 justify-center pt-4">
    <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
      <i className="material-icons text-base">trending_up</i> Go to my Dashboard
    </button>
    <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
      <i className="material-icons text-base">gps_fixed</i> Go to my Community
    </button>
    <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
      <i className="material-icons text-base">emoji_events</i> Go to my Achievements
    </button>
  </div>
</div>
```

---

## Screen 7: Achievements

```tsx
{/* === ACHIEVEMENTS PAGE (inside AppLayout) === */}
<div className="space-y-8 animate-in fade-in-0 duration-500">

  {/* Header with Progress */}
  <header className="space-y-6">
    <div className="flex justify-between items-end">
      <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-2">
        My Achievements
        <i className="material-icons text-xs text-zinc-500 cursor-help">help_outline</i>
      </h3>
      <div className="text-right">
        <span className="text-4xl font-black italic text-primary">3</span>
        <span className="text-xl font-black text-primary ml-1 italic">/ 8</span>
      </div>
    </div>
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-primary shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-500" style={{ width: "37.5%" }} />
    </div>
    <p className="text-sm text-zinc-400">
      Track your milestones and celebrate your progress. You have unlocked <span className="text-primary font-bold">3</span> achievements.
    </p>
  </header>

  {/* Recently Unlocked */}
  <section className="space-y-4">
    <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center">
      <i className="material-icons text-base text-accent mr-2">local_fire_department</i> Recently Unlocked
    </h3>
    <div className="bg-[#131313] p-6 rounded-sm border border-zinc-800 space-y-4 transition-all duration-300 hover:shadow-primary">
      {[
        { icon: "bolt", title: "7-Day Streak", desc: "Completed a week of tracking", color: "text-primary", bg: "bg-primary/10" },
        { icon: "directions_walk", title: "Big Stepper", desc: "Walked 10,000 steps in a day", color: "text-primary", bg: "bg-primary/10" },
        { icon: "check_circle", title: "Consistency is Key", desc: "Completed 7 day streak", color: "text-primary", bg: "bg-primary/10" },
      ].map((a) => (
        <div key={a.title} className="flex items-center gap-4 p-3 rounded-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800/50">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${a.bg}`}>
            <i className={`material-icons text-3xl ${a.color}`}>{a.icon}</i>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest">{a.title}</h4>
            <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{a.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>

  {/* Collection Grid */}
  <section className="space-y-6">
    <h3 className="text-xl font-black italic tracking-tighter uppercase">Collection</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[
        { icon: "bolt", title: "7-Day Streak", desc: "Completed a week of tracking", unlocked: true },
        { icon: "directions_walk", title: "Big Stepper", desc: "Walked 10,000 steps in a day", unlocked: true },
        { icon: "check_circle", title: "Consistency is Key", desc: "Completed 7 day streak", unlocked: true },
        { icon: "monitor_weight", title: "1kg Club", desc: "Lose 1 kilogram", unlocked: false },
        { icon: "event", title: "30-Day Challenge", desc: "Complete 30 consecutive days", unlocked: false },
        { icon: "emoji_events", title: "Little Achiever", desc: "Completed 10 goals", unlocked: false },
        { icon: "monitor_weight", title: "Weight Watcher", desc: "Track weight for 14 days", unlocked: false },
        { icon: "event", title: "Consistency King", desc: "Complete all 12 weeks", unlocked: false },
      ].map((a) => (
        <div
          key={a.title}
          className={`bg-[#131313] p-6 rounded-sm border border-zinc-800 text-center space-y-4 flex flex-col items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-primary ${!a.unlocked ? "opacity-40" : ""}`}
        >
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${a.unlocked ? "bg-zinc-800" : "border-2 border-dashed border-zinc-700"}`}>
            <i className={`material-icons text-3xl ${a.unlocked ? "text-primary" : "text-zinc-600"}`}>
              {a.unlocked ? a.icon : "lock"}
            </i>
          </div>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-widest">{a.title}</h5>
            <p className="text-[9px] text-zinc-500 mt-1 uppercase">{a.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
</div>
```

---

## Screen 8: Payment Details (Subscription & Billing)

```tsx
{/* === PAYMENT DETAILS (inside AppLayout) === */}
<div className="max-w-5xl mx-auto space-y-6">

  {/* Header */}
  <div className="rounded-sm border border-zinc-800 bg-[#0D0F14] px-5 py-5 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
    <h1 className="text-3xl font-black mb-1 tracking-tight flex items-center gap-2 text-zinc-100">
      Subscription & Billing
    </h1>
    <p className="text-[11px] uppercase tracking-widest text-zinc-500">Securely managed via Stripe</p>
  </div>

  {/* Plans Grid (3 cards) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">

    {/* Free Plan Card */}
    <div className="relative border border-primary shadow-glow bg-gradient-hero flex flex-col min-h-[500px] rounded-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <div className="p-6 pb-3 min-h-[140px]">
        <h3 className="text-xl font-semibold">Free Plan</h3>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">(your active subscription)</span>
        <p className="text-[13px] leading-5 text-zinc-400 mt-1.5 max-w-[30ch]">
          There is nothing wrong with trying before buying! Get 14 days limited access to get a feel of the app!
        </p>
      </div>
      <div className="p-6 pt-0 space-y-3 flex-1 flex flex-col pb-24">
        {[
          { title: "Free trial for 14 days", desc: "Limited access to pro features" },
          { title: "No credit card required", desc: "Try before you commit" },
          { title: "Trial Period", desc: "Free Trial will end after 14 days automatically" },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-1.5">
            <i className="material-icons text-base text-primary mt-0.5 shrink-0">check_circle</i>
            <div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
        <div className="absolute left-6 right-6 bottom-6 h-10">
          <button className="w-full h-10 text-[11px] px-3 py-2 rounded-md bg-gradient-primary text-primary-foreground font-medium" disabled>
            Active
          </button>
        </div>
      </div>
    </div>

    {/* Weekly Plan Card */}
    <div className="relative border border-zinc-800 bg-[#131313] flex flex-col min-h-[500px] rounded-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <div className="p-6 pb-3 min-h-[140px]">
        <h3 className="text-xl font-semibold">Weekly</h3>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">(inactive subscription)</span>
        <p className="text-[13px] leading-5 text-zinc-400 mt-1.5 max-w-[30ch]">
          For a price of a small coffee, you can be on your way to looking and feeling better!
        </p>
      </div>
      <div className="p-6 pt-0 space-y-3 flex-1 flex flex-col pb-24">
        {[
          { title: "Paid subscription", desc: "Access to '12 Week' Plan, downloadable reports, unlock 'Achievements' and more." },
          { title: "Payment Method", desc: "Visa, Mastercard, Amex, Google Pay, Apple Pay" },
          { title: "Cancel Anytime", desc: "No lock in contract. Cancel anytime." },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-1.5">
            <i className="material-icons text-base text-primary mt-0.5 shrink-0">check_circle</i>
            <div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
        <div className="absolute left-6 right-6 bottom-6 h-10">
          <button className="w-full h-10 text-[11px] px-3 py-2 rounded-md bg-gradient-primary text-primary-foreground font-medium">
            Subscribe - $4.99/billed weekly
          </button>
        </div>
      </div>
    </div>

    {/* Fortnightly Plan Card */}
    <div className="relative border border-zinc-800 bg-[#131313] flex flex-col min-h-[500px] rounded-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-primary">
      <div className="p-6 pb-3 min-h-[140px]">
        <h3 className="text-xl font-semibold">Fortnightly</h3>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">(inactive subscription)</span>
        <p className="text-[13px] leading-5 text-zinc-400 mt-1.5 max-w-[30ch]">
          Save more with our fortnightly plan. All the same great features at a better value!
        </p>
      </div>
      <div className="p-6 pt-0 space-y-3 flex-1 flex flex-col pb-24">
        {[
          { title: "Paid subscription", desc: "Access to '12 Week' Plan, downloadable reports, unlock 'Achievements' and more." },
          { title: "Payment Method", desc: "Visa, Mastercard, Amex, Google Pay, Apple Pay" },
          { title: "Cancel Anytime", desc: "No lock in contract. Cancel anytime." },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-1.5">
            <i className="material-icons text-base text-primary mt-0.5 shrink-0">check_circle</i>
            <div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
        <div className="absolute left-6 right-6 bottom-6 h-10">
          <button className="w-full h-10 text-[11px] px-3 py-2 rounded-md bg-gradient-primary text-primary-foreground font-medium">
            Subscribe - $8.99/billed fortnightly
          </button>
        </div>
      </div>
    </div>
  </div>

  {/* Billing History */}
  <div className="max-w-4xl mx-auto">
    <div className="border border-primary/20 shadow-primary rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Billing History</h3>
      <div className="flex justify-center">
        <button className="border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
          View Full Billing History
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Screen 9: Settings (Profile Settings)

Accessible from hamburger menu. Has 3 tabs: Account, Privacy & Notifications, Billing.

```tsx
{/* === SETTINGS PAGE (inside AppLayout) === */}
<div className="space-y-6">
  <div>
    <h1 className="text-3xl font-bold">Settings</h1>
    <p className="text-muted-foreground">Manage your account details and settings.</p>
  </div>

  {/* Tab Bar */}
  <div className="grid w-full grid-cols-3 bg-muted rounded-md p-1">
    <button className="flex items-center justify-center gap-2 py-2 rounded-md bg-background text-sm font-medium">
      <i className="material-icons text-base">person</i>
      <span className="hidden sm:inline">Account</span>
    </button>
    <button className="flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
      <i className="material-icons text-base">shield</i>
      <span className="hidden sm:inline">Privacy & Notifications</span>
    </button>
    <button className="flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
      <i className="material-icons text-base">credit_card</i>
      <span className="hidden sm:inline">Billing</span>
    </button>
  </div>

  {/* Account Tab Content */}
  <div className="border rounded-lg">
    <div className="p-6 pb-2">
      <h3 className="text-lg font-semibold">Profile Information</h3>
      <p className="text-sm text-muted-foreground">Update your personal information. Changes sync across the app.</p>
    </div>
    <div className="p-6 pt-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">First Name</label>
          <input type="text" value="John" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Last Name</label>
          <input type="text" value="Doe" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email Address</label>
        <input type="email" value="john.doe@email.com" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Height (cm)</label>
          <input type="text" value="175" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Weight (kg)</label>
          <input type="text" value="85" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>
      <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
        Save Changes
      </button>
    </div>
  </div>

  {/* Privacy & Notifications Tab Content (shown when active) */}
  {/* Contains: Privacy Controls card + Notifications card with toggle switches */}

  {/* Billing Tab Content (shown when active) */}
  {/* Contains: Subscription card + Payment & Billing Details card + Billing History table */}
</div>
```

---

## Screen 10: Community & Help

```tsx
{/* === COMMUNITY & HELP PAGE (inside AppLayout) === */}
<div className="max-w-4xl mx-auto space-y-6">
  <div>
    <h1 className="text-3xl font-bold mb-2">Community & Help</h1>
    <p className="text-muted-foreground">Get support and connect with other users</p>
  </div>

  <div className="grid md:grid-cols-2 gap-6">
    {/* Email Support — active */}
    <div className="border rounded-lg transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6">
        <i className="material-icons text-3xl text-primary mb-2">email</i>
        <h3 className="text-lg font-semibold">Email Support</h3>
        <p className="text-sm text-muted-foreground mt-1">Need help? Our support team is here to assist you</p>
      </div>
      <div className="p-6 pt-0">
        <button className="w-full border border-border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
          Contact Support
        </button>
      </div>
    </div>

    {/* FAQ — coming soon */}
    <div className="border rounded-lg opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6">
        <i className="material-icons text-3xl text-muted-foreground mb-2">chat</i>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">FAQ</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Find answers to frequently asked questions</p>
      </div>
      <div className="p-6 pt-0">
        <button className="w-full border border-border px-4 py-2 rounded-md text-sm opacity-50" disabled>
          Browse FAQs
        </button>
      </div>
    </div>

    {/* Articles — coming soon */}
    <div className="border rounded-lg opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6">
        <i className="material-icons text-3xl text-muted-foreground mb-2">menu_book</i>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Articles</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Read tips, guides, and expert advice on fitness</p>
      </div>
      <div className="p-6 pt-0">
        <button className="w-full border border-border px-4 py-2 rounded-md text-sm opacity-50" disabled>
          Read Articles
        </button>
      </div>
    </div>

    {/* Your Community — coming soon */}
    <div className="border rounded-lg opacity-60 transition-all duration-300 hover:shadow-primary hover:-translate-y-1">
      <div className="p-6">
        <i className="material-icons text-3xl text-muted-foreground mb-2">group</i>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Your Community</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Connect with others on their fitness journey</p>
      </div>
      <div className="p-6 pt-0">
        <button className="w-full border border-border px-4 py-2 rounded-md text-sm opacity-50" disabled>
          Join Community
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Screen 11: About Us

```tsx
{/* === ABOUT US PAGE (inside AppLayout) === */}
<div className="max-w-4xl mx-auto space-y-6">
  <div>
    <h1 className="text-3xl font-bold mb-2">About Weight Loss Buddy</h1>
    <p className="text-muted-foreground">Your personal fitness companion</p>
  </div>

  <div className="border rounded-lg p-6">
    <p className="text-lg leading-relaxed">
      Weight Loss Buddy is designed to help you achieve your health and fitness goals through
      personalized calculations and tracking. We combine science-based TDEE calculations with
      macro tracking to provide you with the tools you need to succeed.
    </p>
  </div>

  <div className="grid md:grid-cols-3 gap-6">
    {[
      { icon: "gps_fixed", title: "Our Mission", text: "To empower individuals with accurate, personalized fitness data to make informed decisions about their health journey." },
      { icon: "group", title: "Our Community", text: "Join thousands of users who are transforming their health with data-driven insights and personalized recommendations." },
      { icon: "favorite", title: "Our Values", text: "We believe in transparency, accuracy, and providing tools that are accessible to everyone, regardless of their fitness level." },
    ].map((card) => (
      <div key={card.title} className="border rounded-lg">
        <div className="p-6">
          <i className="material-icons text-3xl text-primary mb-2">{card.icon}</i>
          <h3 className="text-lg font-semibold">{card.title}</h3>
        </div>
        <div className="p-6 pt-0">
          <p className="text-muted-foreground text-sm">{card.text}</p>
        </div>
      </div>
    ))}
  </div>

  <div className="border rounded-lg">
    <div className="p-6 pb-2"><h3 className="text-lg font-semibold">Our Story</h3></div>
    <div className="p-6 pt-2 space-y-4 text-sm text-muted-foreground">
      <p>
        Weight Loss Buddy was created by fitness enthusiasts who understand the importance of
        accurate calorie and macro tracking. We noticed that many fitness apps were either too
        complicated or lacked the precision needed for serious results.
      </p>
      <p>
        Our team developed Weight Loss Buddy to bridge that gap — providing professional-grade
        calculations in an easy-to-use interface that anyone can master.
      </p>
    </div>
  </div>
</div>
```

---

## Screen 12: Privacy Policy

```tsx
{/* === PRIVACY POLICY PAGE (inside AppLayout) === */}
<div className="max-w-4xl mx-auto space-y-6">
  <div>
    <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
    <p className="text-muted-foreground">Last updated: April 20, 2026</p>
  </div>

  {[
    { title: "1. Introduction", content: "Welcome to Weight Loss Buddy. We are committed to protecting your personal information and your right to privacy." },
    { title: "2. Information We Collect", content: "We collect: Name, email, age, gender, height, weight, activity level, daily entries, profile content, and support correspondence." },
    { title: "3. How We Use Your Information", content: "To calculate TDEE/BMR/BMI, provide calorie recommendations, track progress, adjust weekly targets, and display achievements." },
    { title: "4. Data Sharing", content: "We do not sell, trade, rent, or share your personal information with third parties for marketing purposes." },
    { title: "5. Data Storage & Security", content: "We implement industry-standard security measures to protect your information." },
    { title: "6. Data Retention", content: "We retain your data only as long as necessary. You may request deletion at any time." },
    { title: "7. Your Rights", content: "You have the right to access, correct, delete, withdraw consent, and request data portability." },
    { title: "8. Health & Medical Disclaimer", content: "Weight Loss Buddy is NOT a medical device or substitute for professional medical advice. Use at your own risk." },
    { title: "9. Children's Privacy", content: "Not intended for use by individuals under 18. We do not knowingly collect data from children." },
    { title: "10. Changes to This Policy", content: "We may update this policy from time to time. Continued use constitutes acceptance." },
    { title: "11. Contact Us", content: "Contact us through Community & Help or email: alan.tat@hotmail.com" },
  ].map((section) => (
    <div key={section.title} className="border rounded-lg">
      <div className="p-6 pb-2"><h3 className="text-lg font-semibold">{section.title}</h3></div>
      <div className="p-6 pt-2 text-sm text-muted-foreground">{section.content}</div>
    </div>
  ))}
</div>
```

---

## Screen 13: Create a New Profile (Sign-up / Register)

Standalone full-screen layout (no app shell). Single tall card with two-column form on desktop, single-column on mobile. KG/CM vs LBS/INS unit toggle at the top changes the height/weight units inline.

```tsx
{/* === REGISTER / CREATE PROFILE PAGE === */}
<div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-y-auto">
  <div className="w-full max-w-4xl mx-auto py-8">
    <div className="w-full max-w-md mx-auto bg-background border border-border rounded-lg">

      {/* Header */}
      <div className="text-center space-y-4 p-6 pb-2">
        <h2 className="text-2xl font-bold text-foreground">Create a new profile</h2>
        <p className="text-foreground/70 text-sm">Tell us about yourself to get started</p>

        {/* Unit System Toggle */}
        <div className="flex gap-4 justify-center pt-2">
          <button className="px-6 py-2 rounded border-2 border-primary bg-primary/10 text-primary font-medium">
            KG/CM
          </button>
          <button className="px-6 py-2 rounded border-2 border-border text-foreground hover:border-primary/50">
            LBS/INS
          </button>
        </div>
      </div>

      <div className="p-6 pt-4 space-y-6">
        <form className="space-y-4">

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name</label>
              <input type="text" placeholder="John" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name</label>
              <input type="text" placeholder="Doe" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm focus:border-primary" />
            </div>
          </div>

          {/* Age / Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Age</label>
              <input type="number" placeholder="25" min="18" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gender</label>
              <select className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Height / Weight (units controlled by toggle) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Height (cm)</label>
              <input type="number" placeholder="175" min="135" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Weight (kg)</label>
              <input type="number" placeholder="70" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Activity Level + help tooltip (hover on desktop, tap on mobile) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Current Activity Level</label>
              <i className="material-icons text-base text-muted-foreground cursor-help">help_outline</i>
            </div>
            <select className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Select your activity level</option>
              <option value="sedentary">Sedentary (x1.2) — &lt;3,000 steps/day (Desk job)</option>
              <option value="lightly-active">Lightly Active (x1.375) — 3,000–7,000 steps/day</option>
              <option value="moderately-active">Moderately Active (x1.55) — 7,500–9,000 steps/day</option>
              <option value="very-active">Very Active (x1.725) — 10,000–12,000 steps/day</option>
              <option value="super-active">Super Active (x1.9) — 12,500+ steps/day</option>
            </select>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <input type="email" placeholder="john.doe@example.com" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
          </div>

          {/* Mobile (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Mobile (Optional)</label>
            <input type="tel" placeholder="+61 400 000 000" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
          </div>

          {/* Password + help tooltip */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Create a Password</label>
              <i className="material-icons text-base text-muted-foreground cursor-help">help_outline</i>
            </div>
            <input type="password" placeholder="Create a strong password" minLength={8} className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm Password</label>
            <input type="password" placeholder="Confirm your password" className="flex h-10 w-full rounded-md border border-muted bg-background px-3 py-2 text-sm" />
            <p className="text-sm text-secondary">Passwords match</p>
          </div>

          {/* Terms */}
          <div className="flex items-center space-x-2 pt-2">
            <input type="checkbox" className="h-4 w-4 rounded border border-foreground accent-primary" />
            <label className="text-sm text-foreground">
              I agree to the Terms of Service and Privacy Policy
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-12 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Profile
          </button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline">Sign in</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
```

---

## Screen 14: Reset Password

Reached from a magic-link email after the user clicks "Forgot your password?" on the Login screen. Standalone layout (no app shell). Two password fields and an Update button.

```tsx
{/* === RESET PASSWORD PAGE === */}
<div className="min-h-screen flex items-center justify-center p-4 bg-background">
  <div className="w-full max-w-md bg-background border border-border rounded-lg">
    <div className="p-6 space-y-2">
      <h2 className="text-2xl font-bold text-foreground">Set new password</h2>
      <p className="text-sm text-foreground/70">Enter your new password below.</p>
    </div>
    <div className="p-6 pt-2">
      <form className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">New password</label>
          <input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            minLength={8}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
          <input
            id="confirm"
            type="password"
            placeholder="Confirm your password"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="w-full h-10 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Update password
        </button>
      </form>
    </div>
  </div>
</div>
```

### Loading state (while session token is being validated)

```tsx
<div className="min-h-screen flex items-center justify-center bg-background">
  <p className="text-muted-foreground">Loading…</p>
</div>
```

---

## Tooltip Behavior Spec (applies to every `help_outline` icon in this bundle)

Every `?` (`<i className="material-icons">help_outline</i>`) used next to a section heading or input label in this bundle is a **dual-mode** tooltip:

| Device | Trigger | Close |
|---|---|---|
| Desktop (mouse + `hover:hover` media query) | Hover the icon | Move mouse away or press Esc |
| Phone / tablet (touch-only, no hover) | Tap the icon | Tap outside the tooltip body or press Esc |

The tooltip body is identical between modes — only the trigger differs. Stitch designs MUST keep this dual behavior. Do not change to hover-only.

Visually, the tooltip content card uses:
- `bg-background border border-border` background
- `text-foreground` text color
- `max-w-xs` width cap
- `text-sm` body text
- Slight shadow / radius from `--radius` token

---

## Required State Variants for Every Screen

When generating designs, include these visual states for each screen:
- **Default** — normal loaded state with mock data
- **Loading** — skeleton/spinner placeholder
- **Error** — error alert/boundary fallback
- **Empty** — empty state messaging (where relevant, e.g. no achievements, no goals)
- **Disabled controls** — where applicable (e.g. disabled subscribe button, disabled "Create Profile" until terms agreed)
- **Touch-mode tooltip open** — show a help_outline tooltip in its tapped/open state for mobile mocks

---

## Implementation Rule on Return to Cursor

After choosing a Stitch variant, apply **only presentation changes** back in Cursor:
- Layout wrappers and structure
- CSS class names / Tailwind utilities
- Color and spacing tokens from the design system
- Visual component composition

**Keep unchanged:**
- All event handlers, calculations, and data models
- All Supabase persistence calls (`journeys`, `profiles`, `trusted_devices`)
- All Stripe billing logic
- All route paths and field labels
- Tooltip portal rendering behavior (hybrid Tooltip/Popover hover-vs-tap)
- Autosave / blur-save behavior on every editable input
- Device-fingerprint trust check on sign-in
