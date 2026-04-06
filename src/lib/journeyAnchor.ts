/**
 * Journey anchor = calendar Day 1 of Acclimation (4×7 days). Weight Loss Week 1 begins 28 days later.
 * Legacy rows stored WL Week 1 start in `weight_loss_start_date` with `weight_loss_start_is_anchor = false`.
 */

export function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalIsoDate(dt);
}

/** First day of Weight Loss Week 1 — 28 days after journey anchor (end of 4×7-day Acclimation). */
export function weightLossPhaseStartFromJourneyAnchor(journeyStartIso: string): string {
  return addDaysIso(journeyStartIso, 28);
}

/** Last day of Week 12 — 12 calendar weeks from WL Week 1 start. */
export function lastDayOfWeek12Iso(wlStartIso: string): string {
  const [y, m, d] = wlStartIso.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 12 * 7 - 1);
  return formatLocalIsoDate(dt);
}

/** Maintenance starts the day after the last day of Week 12; end is start + 27 days (4×7 inclusive). */
export function deriveMaintenanceWindowFromJourneyAnchor(journeyAnchorIso: string): { startDate: string; endDate: string } {
  const wlPs = weightLossPhaseStartFromJourneyAnchor(journeyAnchorIso);
  const lastWl = lastDayOfWeek12Iso(wlPs);
  const [ly, lm, ld] = lastWl.split("-").map((x) => parseInt(x, 10));
  const ms = new Date(ly, lm - 1, ld);
  ms.setDate(ms.getDate() + 1);
  const me = new Date(ms);
  me.setDate(me.getDate() + 27);
  return { startDate: formatLocalIsoDate(ms), endDate: formatLocalIsoDate(me) };
}

/** Legacy DB value was WL Week 1 start; convert to journey anchor (Acclimation Day 1). */
export function legacyWlWeek1StartToJourneyAnchor(wlWeek1StartIso: string): string {
  return addDaysIso(wlWeek1StartIso, -28);
}

export function resolveJourneyAnchorFromRow(w: {
  weight_loss_start_date: string | null;
  weight_loss_start_is_anchor?: boolean | null;
}): string | null {
  if (!w.weight_loss_start_date) return null;
  if (w.weight_loss_start_is_anchor !== false) return w.weight_loss_start_date;
  return legacyWlWeek1StartToJourneyAnchor(w.weight_loss_start_date);
}
