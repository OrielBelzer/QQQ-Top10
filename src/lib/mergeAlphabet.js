export function mergeAlphabet(holdings) {
  const out = [];
  let goog = null;
  let googl = null;

  for (const h of holdings) {
    if (h.symbol === "GOOG") goog = h;
    else if (h.symbol === "GOOGL") googl = h;
    else out.push(h);
  }

  if (goog || googl) {
    const weightPct =
      (Number(goog?.weightPct) || 0) +
      (Number(googl?.weightPct) || 0);

    out.push({
      symbol: "GOOG+GOOGL",
      name: "Alphabet (GOOG + GOOGL)",
      weightPct
    });
  }

  return out;
}
