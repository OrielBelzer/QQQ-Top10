import { parseNumber } from "./format.js";

function parseAbbrev(token) {
  if (!token) return 0;
  const raw = String(token).trim().toUpperCase().replace(/\s+/g, "");

  const m = raw.match(/^\$?(\d+(?:[.,]\d+)?)([KMB])$/i);
  if (m) {
    const num = parseNumber(m[1].replace(",", "."));
    const mult = m[2].toUpperCase() === "K" ? 1e3 : m[2].toUpperCase() === "M" ? 1e6 : 1e9;
    return num * mult;
  }

  return parseNumber(raw);
}

export function parseHoldingsPaste(text, allowedSymbolsSet) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const out = {};

  // If the rebalancer list contains the combined Alphabet row, treat GOOG/GOOGL as aliases.
  const hasCombinedAlphabet = allowedSymbolsSet?.has?.("GOOG+GOOGL");

  for (const line of lines) {
    const up = line.toUpperCase();

    const symMatch = up.match(/\b[A-Z]{1,6}\b/);
    if (!symMatch) continue;

    let symbol = symMatch[0];

    // Alias mapping: if app uses GOOG+GOOGL, accept GOOG or GOOGL from paste
    if (hasCombinedAlphabet && (symbol === "GOOG" || symbol === "GOOGL")) {
      symbol = "GOOG+GOOGL";
    }

    // If we have an allowed set, enforce it (after alias mapping)
    if (allowedSymbolsSet && !allowedSymbolsSet.has(symbol)) continue;

    const numMatch = up.match(/(\$?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*[KMB]?\b|\$?\s*\d+(?:[.,]\d+)?\s*[KMB]\b)/);
    if (!numMatch) continue;

    const value = parseAbbrev(numMatch[1]);
    if (value <= 0) continue;

    // If both GOOG and GOOGL appear, sum them into GOOG+GOOGL
    if (symbol === "GOOG+GOOGL" && out[symbol]) {
      out[symbol] += value;
    } else {
      out[symbol] = value;
    }
  }

  return out;
}
