import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { runFitpactToNumiMigration } from './lib/storageMigration'

// Rename legacy fitpact* keys to numi* before React mounts so every component
// that reads storage on first render sees the new names. Idempotent.
runFitpactToNumiMigration();

createRoot(document.getElementById("root")!).render(<App />);
