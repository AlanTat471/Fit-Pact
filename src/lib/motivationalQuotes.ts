/**
 * Short motivational lines for the Dashboard. Wording here is original to this
 * project (not copied from published quotation databases) to avoid third-party
 * copyright claims in the app. Session storage picks one index per sign-in
 * session; see getMotivationalQuoteForSession().
 */
export const MOTIVATIONAL_QUOTES: { quote: string; author?: string }[] = [
  { quote: "Show up for yourself today — consistency beats perfection." },
  { quote: "One mindful choice now is a gift to your future self." },
  { quote: "Progress is built in reps, not in single heroic days." },
  { quote: "You don't need to feel ready; you only need to begin." },
  { quote: "Small wins stack. Celebrate moving forward, not being flawless." },
  { quote: "Fuel your body like you respect the work it does for you." },
  { quote: "Rest is part of the plan; recovery is how strength grows." },
  { quote: "Track the trend, not just today — patience is data-friendly." },
  { quote: "Choose the next right step, even when motivation is quiet." },
  { quote: "Your habits are louder than your mood — lean on the routine." },
  { quote: "Strength is showing up again after an ordinary day." },
  { quote: "Drink your water, take your walk, log your truth — basics count." },
  { quote: "You are allowed to adjust the pace; you are not allowed to quit on yourself." },
  { quote: "What you do most days matters more than what you do once." },
  { quote: "Breathe, reset, and take the next rep — you are still in the game." },
  { quote: "Discipline is self-respect in action." },
  { quote: "Comparison fades when you focus on your own line graph." },
  { quote: "Every log entry is a promise you kept to yourself." },
  { quote: "Health is a direction you travel, not a finish line you sprint to." },
  { quote: "Be kind to yourself and firm about your standards — both can coexist." },
];

/** Cleared on sign-out so the next login picks a fresh quote. */
export const MOTIV_QUOTE_SESSION_KEY = "numiMotivQuoteIndex";

export function getMotivationalQuoteForSession(): { quote: string; author?: string } {
  const n = MOTIVATIONAL_QUOTES.length;
  if (n === 0) return { quote: "Keep going.", author: undefined };

  const raw = sessionStorage.getItem(MOTIV_QUOTE_SESSION_KEY);
  if (raw != null) {
    const idx = parseInt(raw, 10);
    if (!Number.isNaN(idx) && idx >= 0) {
      return MOTIVATIONAL_QUOTES[idx % n];
    }
  }

  const idx = Math.floor(Math.random() * n);
  try {
    sessionStorage.setItem(MOTIV_QUOTE_SESSION_KEY, String(idx));
  } catch {
    /* private mode / storage full — still return quote for this render */
  }
  return MOTIVATIONAL_QUOTES[idx];
}
