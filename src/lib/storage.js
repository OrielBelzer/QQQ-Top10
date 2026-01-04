const KEY = "qqq_top10_custom_stocks_v1";

export function loadCustomStocks() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(s => ({
        symbol: String(s.symbol || "").toUpperCase().trim(),
        name: String(s.name || "").trim(),
        weightPct: Number(s.weightPct) || 0
      }))
      .filter(s => s.symbol && s.weightPct > 0);
  } catch {
    return [];
  }
}

export function saveCustomStocks(stocks) {
  localStorage.setItem(KEY, JSON.stringify(stocks));
}
