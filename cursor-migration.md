# Weight Loss Buddy — Cursor migration guide

This document gives a **codebase overview** and a **step-by-step plan** to remove Lovable.dev dependencies and run the app in a local development environment.

---

## 1. Codebase overview

### What this app is

**Weight Loss Buddy** is an AI fitness companion: personalized workout plans, progress tracking, and coaching. It was generated with Lovable.dev and has been migrated to run fully locally and in Cursor.

### Tech stack

| Layer | Technology |
|-------|------------|
| Build | Vite 5 |
| Language | TypeScript |
| UI | React 18 |
| Routing | React Router 6 |
| Components | shadcn/ui (Radix UI + Tailwind) |
| Styling | Tailwind CSS |
| Data | TanStack React Query |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Charts | Recharts |

### Project structure

```
sweat-script-buddy-main/
├── index.html              # Entry HTML
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite config (no Lovable plugins)
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main.tsx            # React entry
│   ├── App.tsx             # Routes and providers
│   ├── index.css           # Global styles
│   ├── pages/              # Route-level pages
│   │   ├── Index.tsx       # Landing
│   │   ├── Register.tsx    # Create profile
│   │   ├── Dashboard.tsx
│   │   ├── Workouts.tsx    # TDEE calculator
│   │   ├── MacroBreakdown.tsx
│   │   ├── Achievements.tsx
│   │   ├── Profile.tsx
│   │   ├── Settings.tsx
│   │   ├── Privacy.tsx
│   │   ├── CommunityHelp.tsx
│   │   ├── AboutUs.tsx
│   │   ├── PaymentDetails.tsx
│   │   ├── Logout.tsx
│   │   └── NotFound.tsx
│   ├── layouts/
│   │   └── AppLayout.tsx   # Shell for authenticated pages
│   ├── components/
│   │   └── ui/             # shadcn components (40+)
│   ├── lib/
│   │   └── utils.ts        # cn() etc.
│   └── hooks/
│       ├── use-toast.ts
│       └── use-mobile.tsx
└── public/                 # Static assets
```

### Routes

| Path | Page | Layout |
|------|------|--------|
| `/` | Index (landing) | — |
| `/create-your-profile` | Register | — |
| `/dashboard` | Dashboard | AppLayout |
| `/tdee-calculator` | Workouts (TDEE) | AppLayout |
| `/macro-breakdown` | MacroBreakdown | AppLayout |
| `/achievements` | Achievements | AppLayout |
| `/profile` | Profile | AppLayout |
| `/settings` | Settings | AppLayout |
| `/privacy` | Privacy | AppLayout |
| `/community-help` | CommunityHelp | AppLayout |
| `/about-us` | AboutUs | AppLayout |
| `/payment-details` | PaymentDetails | AppLayout |
| `/logout` | Logout | — |
| `*` | NotFound | — |

### Entry points

- **HTML:** `index.html` → loads `/src/main.tsx`
- **React:** `main.tsx` → renders `<App />`
- **App:** `App.tsx` → sets up QueryClient, TooltipProvider, Toaster, Sonner, BrowserRouter, and all Routes

---

## 2. Step-by-step: Disconnect Lovable and run locally

These steps assume you are in the **project root** (the folder that contains `package.json`). If you extracted the GitHub ZIP, that root is likely `sweat-script-buddy-main/sweat-script-buddy-main/`.

### Step 1: Extract the project (if needed)

If you only have `sweat-script-buddy-main.zip`:

- Right-click the ZIP → **Extract All** (or use PowerShell: `Expand-Archive -Path "sweat-script-buddy-main.zip" -DestinationPath "."`).
- Open the folder that contains `package.json` in Cursor (often `sweat-script-buddy-main/sweat-script-buddy-main`).

### Step 2: Remove Lovable dependencies (already done)

The following changes have already been applied in this repo:

1. **`vite.config.ts`**
   - Removed: `import { componentTagger } from "lovable-tagger"` and the `componentTagger()` plugin.
   - Result: Vite uses only the React SWC plugin; no Lovable-specific build step.

2. **`package.json`**
   - Removed: `"lovable-tagger": "^1.1.9"` from `devDependencies`.
   - Result: No Lovable packages are installed or used.

3. **`index.html`**
   - Replaced Lovable Open Graph and Twitter meta tags with project-agnostic placeholders:
     - `og:image` and `twitter:image` → `/og-image.png` (add that image to `public/` when you have one).
     - `twitter:site` → `@sweatscriptbuddy` (change if you use a different handle).

4. **`README.md`**
   - Replaced Lovable-focused content with a short project README and local development instructions.

If you are re-applying this on a fresh clone or export, replicate the above edits.

### Step 3: Install dependencies

From the project root (where `package.json` is):

```bash
npm install
```

**Check that it worked:** When `npm install` finishes you should see a line like “added XXX packages” and no red error messages. A `node_modules` folder will appear in the project root. If you see “npm ERR!” or the command exits with an error code, read the message and fix (e.g. Node version, network) before continuing.

If you see audit warnings:

```bash
npm audit fix
```

### Step 4: Environment variables (if any)

- This codebase does **not** ship with `.env` or `.env.example`. If you later add Supabase, Stripe, or other APIs:
  - Add a `.env.local` (and optionally `.env.example` with placeholder keys).
  - Put real keys only in `.env.local` and ensure `.env.local` is in `.gitignore`.
- No env vars are required for the current app to run.

### Step 5: Run the dev server

```bash
npm run dev
```

- Dev server runs at **http://localhost:8080** (see `vite.config.ts`).
- Open that URL in a browser and click through the main flows to confirm everything works.

### Step 6: Optional — lockfile and clean install

After removing `lovable-tagger`, a clean install avoids stale references:

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

On Windows (PowerShell):

```powershell
Remove-Item -Recurse -Force node_modules; Remove-Item package-lock.json; npm install; npm run dev
```

### Step 7: Optional — flatten the folder (if you have a double nest)

If your path is `.../sweat-script-buddy-main/sweat-script-buddy-main/` and you prefer a single folder:

- Move everything inside the inner `sweat-script-buddy-main` (including `src`, `public`, `package.json`, etc.) into the outer `sweat-script-buddy-main`, then delete the now-empty inner folder.
- Open the folder that contains `package.json` in Cursor and run `npm install` and `npm run dev` from there.

---

## 3. Integrate the project with Cursor

Use these steps so the project runs and is fully usable in Cursor.

### 1. Open the project folder in Cursor

- **File → Open Folder** (or **File → Open…** and choose a folder).
- Select the **project root**: the folder that contains `package.json`, `src`, and `index.html`.  
  Example: `...\FitPact - Cursor\sweat-script-buddy-main\sweat-script-buddy-main`
- Click **Select Folder**. Cursor will use this as the workspace; the Explorer will show the project files.

**Why this matters:** Opening the root (not the parent “FitPact - Cursor” or the zip) ensures the integrated terminal starts in the right directory and that Cursor indexes the correct codebase.

### 2. Use the integrated terminal

- **Terminal → New Terminal** (or `` Ctrl+` ``). The shell should open in the project root (your prompt will show `...\sweat-script-buddy-main\sweat-script-buddy-main`).
- If the prompt shows a different folder, go to the project root:
  ```powershell
  cd "C:\Users\Alan's PC\OneDrive\Desktop\FitPact - Cursor\sweat-script-buddy-main\sweat-script-buddy-main"
  ```

### 3. Install dependencies (if you haven’t already)

```powershell
npm install
```

Wait until it finishes without errors. You should see “added XXX packages” and a `node_modules` folder in the Explorer.

### 4. Start the dev server

```powershell
npm run dev
```

You should see something like:

```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:8080/
```

- Open **http://localhost:8080** in your browser to use the app.
- Leave the terminal running while you develop. Use **Ctrl+C** in the terminal to stop the server.

### 5. Optional: PowerShell execution policy (if npm was blocked)

If you previously saw “running scripts is disabled,” ensure you’ve run once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then `npm install` and `npm run dev` will work in Cursor’s terminal.

### 6. Quick recap

| Step | Action |
|------|--------|
| 1 | **File → Open Folder** → select folder that contains `package.json` |
| 2 | **Terminal → New Terminal** (confirm you’re in project root) |
| 3 | Run `npm install` |
| 4 | Run `npm run dev` |
| 5 | Open http://localhost:8080 in your browser |

After this, you can edit code in Cursor; saving will trigger Vite’s hot reload so the browser updates automatically.

---

## 4. What was *not* tied to Lovable

- **Application logic:** All routes, pages, and components are standard React; no Lovable runtime.
- **Backend:** The app is front-end only; there is no Lovable-hosted backend in this repo.
- **Auth / payments:** If you add Supabase, Stripe, etc., configure them yourself via env vars and their own docs; Lovable does not export those for you.

---

## 5. Troubleshooting

### "npm is not recognized"

This means **Node.js** (which includes npm) is not installed or not on your PATH.

1. **Install Node.js**
   - Go to [https://nodejs.org](https://nodejs.org).
   - Download the **LTS** version and run the installer.
   - During setup, leave **"Add to PATH"** checked.
   - Finish the installer, then **close and reopen** your terminal (and Cursor if you use its terminal).

2. **Check it worked**
   - Open a new terminal and run:
     ```bash
     node -v
     npm -v
     ```
   - You should see version numbers (e.g. `v20.x.x` and `10.x.x`). If you still get "not recognized", restart your PC so the updated PATH is picked up.

3. **Run the project**
   - In the terminal, go to the project folder (the one that contains `package.json`).
   - Run **one command at a time** (do not type `and` between commands):
     ```bash
     npm install
     ```
     Wait for it to finish, then:
     ```bash
     npm run dev
     ```

### "Running scripts is disabled on this system" (PowerShell)

PowerShell blocks `.ps1` scripts by default, and npm on Windows uses one. Allow scripts for your user:

1. Open PowerShell (or the terminal in Cursor) **as yourself** (no need for Run as Administrator).
2. Run **once**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. When prompted, type `Y` and press Enter.
4. Then run `npm install` and `npm run dev` as usual.

`RemoteSigned` allows local scripts (like npm) to run; only downloaded scripts need to be signed. This affects only your user account.

### You're already in the right folder

Your prompt shows:
`PS ...\sweat-script-buddy-main\sweat-script-buddy-main>`
That **is** the project root. Do **not** run `cd sweat-script-buddy-main/sweat-script-buddy-main` again (that would try to go into a non-existent nested folder). Just run `npm install` and then `npm run dev` from there.

---

## 6. Quick reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (→ http://localhost:8080) |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
| Lint | `npm run lint` |

---

## 7. Remaining Lovable dependencies

**None.** The project has no Lovable dependencies in code or build.

- **Package:** `lovable-tagger` was removed from `package.json`; it is not installed.
- **Build:** `vite.config.ts` does not import or use any Lovable plugin.
- **Assets / meta:** `index.html` does not reference lovable.dev; the README does not direct users to Lovable.

The word "Lovable" appears only in **documentation** (this file and `BUGS-AND-DEFECTS.md`) to describe the project’s origin and migration. There are no runtime or build-time Lovable dependencies.

---

## 8. Summary

- **Lovable-specific pieces removed:** `lovable-tagger` (from package and Vite config), Lovable meta tags in `index.html`, and Lovable-centric README content.
- **Local workflow:** Open the project root in Cursor → `npm install` → `npm run dev` → work and deploy from your own repo and hosting.

For a high-level map of the app, use the **Codebase overview** and **Routes** sections above; for running and re-applying the migration, follow **Step-by-step** and **Quick reference**. For a list of bugs fixed and remaining items, see **BUGS-AND-DEFECTS.md**.
