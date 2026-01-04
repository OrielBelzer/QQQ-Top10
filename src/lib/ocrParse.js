import Tesseract from "tesseract.js";
import { parseNumber } from "./format.js";

// Ticker detection: 1–6 letters (NVDA, MSFT, GOOGL, etc.)
const TICKER_RE = /\b[A-Z]{1,6}\b/g;

// Money patterns including abbreviations like $8.83K, 7.23K, 1.2M, etc.
// Also supports plain numbers with commas.
const MONEY_TOKEN_RE =
  /(\$?\s*\d+(?:[.,]\d+)?\s*[KMB]\b|\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$?\s*\d+(?:\.\d{1,2})?)/i;

function parseAbbrevMoney(token) {
  if (!token) return 0;

  const raw = String(token).trim().toUpperCase().replace(/\s+/g, "");

  // Handle K/M/B suffixes
  const m = raw.match(/^\$?(\d+(?:[.,]\d+)?)([KMB])$/i);
  if (m) {
    const num = parseNumber(m[1].replace(",", ".")); // if OCR used comma as decimal
    const suffix = m[2].toUpperCase();
    const mult = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : 1_000_000_000;
    return num * mult;
  }

  // Otherwise normal currency/number
  return parseNumber(raw);
}

export async function ocrImageFile(file, { onProgress } = {}) {
  // These OCR options help for “list/table” screenshots like yours
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: m => {
      if (m.status === "recognizing text" && typeof onProgress === "function") {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
    // tesseract config
    tessedit_pageseg_mode: 6, // assume a uniform block of text (good for lists)
    preserve_interword_spaces: 1
  });

  return data?.text || "";
}

/**
 * Optimized for screenshots like:
 * NVDA ... $8.83K
 * MSFT ... $7.23K
 *
 * OCR often splits ticker/value across lines. Strategy:
 * - find a ticker line
 * - scan that line and the next N lines for a money token
 * - prefer tokens with K/M/B suffix (often your UI uses K)
 * - fill only allowed symbols (top10 + custom)
 */
export function parseHoldingsFromText(text, allowedSymbolsSet) {
  const lines = String(text || "")
    .split("\n")
    .map(l => l.trim().toUpperCase())
    .filter(Boolean);

  const results = {};

  // helper: find best money token within a small window of lines
  function findMoneyNear(index, lookahead = 5) {
    const window = [];
    for (let j = index; j < Math.min(lines.length, index + lookahead); j++) {
      window.push(lines[j]);
    }

    // Prefer tokens with K/M/B because that’s your screenshot format
    let bestToken = null;

    for (const w of window) {
      const m = w.match(MONEY_TOKEN_RE);
      if (!m) continue;

      const token = m[1];
      if (/[KMB]\b/i.test(token)) return token; // best case: abbreviated money
      if (!bestToken) bestToken = token; // fallback: first numeric token
    }

    return bestToken;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const tickers = line.match(TICKER_RE) || [];
    const ticker = tickers.find(t => allowedSymbolsSet.has(t));
    if (!ticker) continue;

    const token = findMoneyNear(i, 6);
    const value = parseAbbrevMoney(token);

    // Filter out tiny values that are probably share counts (e.g. 46.73 shares)
    // Your portfolio values are usually in the thousands, so this helps.
    if (value >= 100) {
      results[ticker] = value;
    }
  }

  return results;
}