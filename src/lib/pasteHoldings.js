import { parseNumber } from "./format.js";

function parseAbbrev(token) {
  if (!token) return 0;
  const raw = String(token).trim().toUpperCase().replace(/\s+/g, "");

  // $8.83K / 8.83K / 1.2M / 0.95B
  const m = raw.match(/^\$?(\d+(?:[.,]\d+)?)([KMB])$/i);
  if (m) {
    const num = parseNumber(m[1].replace(",", "."));
    const mult = m[2].toUpperCase() === "K" ? 1e3 : m[2].toUpperCase() === "M" ? 1e6 : 1e9;
    return num * mult;
  }

  // Normal number/currency with commas
  return parseNumber(raw);
}

export function parseHoldingsPaste(text, allowedSymbolsSet) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const out = {};

  for (const line of lines) {
    const up = line.toUpperCase();

    // Find a ticker anywhere in the line
    const symMatch = up.match(/\b[A-Z]{1,6}\b/);
    if (!symMatch) continue;

    const symbol = symMatch[0];
    if (allowedSymbolsSet && !allowedSymbolsSet.has(symbol)) continue;

    // Find a money-ish token (supports $8.83K, 8,830.22, 8830, etc.)
    const numMatch = up.match(/(\$?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[KMB]?\b|\$?\s*\d+(?:[.,]\d+)?\s*[KMB]\b)/);
    if (!numMatch) continue;

    const value = parseAbbrev(numMatch[1]);
    if (value > 0) out[symbol] = value;
  }

  return out;
}
