# Weight Loss Buddy

Your AI Fitness Companion — personalized workout plans, progress tracking, and coaching.

## Tech stack

- **Vite** – build tool
- **TypeScript** – type safety
- **React 18** – UI
- **React Router** – routing
- **shadcn/ui** – components (Radix + Tailwind)
- **Tailwind CSS** – styling
- **React Query** – data fetching
- **React Hook Form + Zod** – forms and validation

## Local development

### Prerequisites

- Node.js 18+ and npm (or [nvm](https://github.com/nvm-sh/nvm))

### Run locally

```sh
# Install dependencies
npm install

# Start dev server (http://localhost:8080)
npm run dev
```

### Other scripts

- `npm run build` – production build
- `npm run preview` – preview production build
- `npm run lint` – run ESLint

## Project structure

- `src/pages/` – route pages (Dashboard, Workouts, Profile, etc.)
- `src/components/` – reusable and UI components
- `src/layouts/` – app layout and shell
- `src/lib/` – utilities
- `src/hooks/` – custom React hooks

See **cursor-migration.md** for a full codebase overview and migration notes.
