import { sumWeightsPct } from "./holdings.js";

/**
 * Target model:
 * - QQQ top10 portion:
 *    - if useTop10As100Pct = true -> treat top10 as 100% of the "QQQ portion"
 *    - else -> treat top10 as its real summed weight (e.g. ~53%), leaving remainder as “Other QQQ” (not modeled)
 * - custom stocks are additional target weights (user-defined), in % of total portfolio
 *
 * We normalize so that:
 *   totalTargetPct = qqqTop10PctUsed + customPct
 * and targets are scaled to the portfolio total.
 */

export function buildTargets({ qqqTop10, useTop10As100Pct, customStocks }) {
  const top10Sum = sumWeightsPct(qqqTop10); // e.g. 53.x
  const qqqPortionPct = useTop10As100Pct ? 100 : top10Sum;

  const customSum = (customStocks || []).reduce((a, s) => a + (Number(s.weightPct) || 0), 0);
  const totalTargetPct = qqqPortionPct + customSum;

  const targets = [];

  for (const h of qqqTop10) {
    const withinQqq = (h.weightPct / top10Sum) * qqqPortionPct; // within qqq slice
    const pctOfTotal = (withinQqq / totalTargetPct) * 100;
    targets.push({ symbol: h.symbol, name: h.name, targetPct: pctOfTotal });
  }

  for (const c of customStocks || []) {
    const pctOfTotal = ((Number(c.weightPct) || 0) / totalTargetPct) * 100;
    targets.push({ symbol: c.symbol, name: c.name || c.symbol, targetPct: pctOfTotal });
  }

  return {
    meta: { top10Sum, qqqPortionPct, customSum, totalTargetPct },
    targets: targets.sort((a, b) => b.targetPct - a.targetPct)
  };
}

export function rebalanceToNewTotal({ targets, currentValuesBySymbol, newTotal }) {
  const rows = targets.map(t => {
    const current = Number(currentValuesBySymbol[t.symbol] || 0);
    const targetValue = (t.targetPct / 100) * newTotal;
    const delta = targetValue - current; // + buy, - sell
    return { ...t, current, targetValue, delta };
  });

  const currentTotal = Object.values(currentValuesBySymbol).reduce((a, v) => a + (Number(v) || 0), 0);

  return {
    currentTotal,
    newTotal,
    rows: rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  };
}

/**
 * Additional investment only:
 * - We only allocate additional cash to underweight positions (delta > 0)
 * - If there are no underweights, we allocate nothing.
 */
export function rebalanceWithAdditionalInvestment({ targets, currentValuesBySymbol, additional }) {
  const currentTotal = Object.values(currentValuesBySymbol).reduce((a, v) => a + (Number(v) || 0), 0);
  const newTotal = currentTotal + additional;

  const desired = targets.map(t => {
    const current = Number(currentValuesBySymbol[t.symbol] || 0);
    const targetValue = (t.targetPct / 100) * newTotal;
    const delta = targetValue - current;
    return { ...t, current, targetValue, delta };
  });

  const buys = desired.filter(r => r.delta > 0);
  const totalBuyNeed = buys.reduce((a, r) => a + r.delta, 0);

  const rows = desired.map(r => {
    if (r.delta <= 0) return { ...r, suggestedBuy: 0, suggestedSell: 0 };
    if (totalBuyNeed <= 0) return { ...r, suggestedBuy: 0, suggestedSell: 0 };

    const buy = (r.delta / totalBuyNeed) * additional;
    return { ...r, suggestedBuy: buy, suggestedSell: 0 };
  });

  return {
    currentTotal,
    newTotal,
    additional,
    rows: rows.sort((a, b) => (b.suggestedBuy || 0) - (a.suggestedBuy || 0))
  };
}
