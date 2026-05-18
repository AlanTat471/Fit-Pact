import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { runFitpactToNumiMigration } from './lib/storageMigration'
import { installCapacitorLifecycleHooks } from './lib/capacitorLifecycle'

// Rename legacy fitpact* keys to numi* before React mounts so every component
// that reads storage on first render sees the new names. Idempotent.
runFitpactToNumiMigration();

// Subscribe to Capacitor's `pause` / `appStateChange` events so backgrounding
// the Android app (Home button, app switcher, OS reclaim) still flushes any
// pending Dashboard saves to Supabase. On the web this is a no-op because
// Capacitor.isNativePlatform() returns false. Fire-and-forget – we don't want
// app startup to wait on plugin registration.
void installCapacitorLifecycleHooks();

createRoot(document.getElementById("root")!).render(<App />);
