export async function loadHistoryIndex() {
  const res = await fetch(`${import.meta.env.BASE_URL}history/index.json`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load history/index.json");
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

export async function loadSnapshot(dateStr) {
  const res = await fetch(`${import.meta.env.BASE_URL}history/${dateStr}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load history/${dateStr}.json`);
  return await res.json();
}

function daysBetween(a, b) {
  // a,b are YYYY-MM-DD
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.floor((db - da) / (24 * 3600 * 1000));
}

export function pickDatesForWindow(indexDatesAsc, windowDays) {
  if (!indexDatesAsc.length) return { start: null, end: null, datesInWindow: [] };
  const end = indexDatesAsc[indexDatesAsc.length - 1];
  const datesInWindow = indexDatesAsc.filter(d => daysBetween(d, end) <= windowDays);
  const start = datesInWindow.length ? datesInWindow[0] : null;
  return { start, end, datesInWindow };
}

export function normalizeHoldings(snapshot) {
  const holdings = Array.isArray(snapshot?.holdings) ? snapshot.holdings : [];
  return holdings
    .map(h => ({
      symbol: String(h.symbol || "").toUpperCase().trim(),
      name: String(h.name || "").trim(),
      weightPct: Number(h.weightPct) || 0
    }))
    .filter(h => h.symbol && h.weightPct > 0);
}
