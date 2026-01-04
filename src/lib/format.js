export function usd(n) {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function pct(n) {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(2)}%`;
}

export function parseNumber(v) {
  const x = Number(String(v).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(x) ? x : 0;
}
