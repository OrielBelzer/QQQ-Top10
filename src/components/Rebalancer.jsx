import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets, rebalanceToNewTotal, rebalanceWithAdditionalInvestment } from "../lib/rebalance.js";

export default function Rebalancer({ qqqTop10, customStocks }) {
  const [useTop10As100Pct, setUseTop10As100Pct] = useState(true);
  const [mode, setMode] = useState("newTotal"); // newTotal | additional
  const [newTotal, setNewTotal] = useState(50000);
  const [additional, setAdditional] = useState(5000);

  const symbols = useMemo(() => {
    const base = qqqTop10.map(h => ({ symbol: h.symbol, name: h.name }));
    const custom = (customStocks || []).map(s => ({ symbol: s.symbol, name: s.name || s.symbol }));
    const all = [...base, ...custom];
    const map = new Map();
    for (const x of all) map.set(x.symbol, x);
    return [...map.values()];
  }, [qqqTop10, customStocks]);

  const [current, setCurrent] = useState(() => ({}));

  const { targets } = useMemo(() => {
    return buildTargets({ qqqTop10, useTop10As100Pct, customStocks });
  }, [qqqTop10, useTop10As100Pct, customStocks]);

  const result = useMemo(() => {
    if (mode === "newTotal") {
      return rebalanceToNewTotal({
        targets,
        currentValuesBySymbol: current,
        newTotal: parseNumber(newTotal)
      });
    }
    return rebalanceWithAdditionalInvestment({
      targets,
      currentValuesBySymbol: current,
      additional: parseNumber(additional)
    });
  }, [mode, targets, current, newTotal, additional]);

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Top-10 weighting mode</label>
          <select value={useTop10As100Pct ? "100" : "actual"} onChange={e => setUseTop10As100Pct(e.target.value === "100")}>
            <option value="100">Use 100% (treat Top 10 as full QQQ allocation)</option>
            <option value="actual">Use actual Top-10 sum (leave remainder as “Other QQQ”)</option>
          </select>
        </div>

        <div className="field">
          <label>Rebalance method</label>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="newTotal">New Total Portfolio Value (buy/sell)</option>
            <option value="additional">Additional Investment Only (buys only)</option>
          </select>
        </div>

        {mode === "newTotal" ? (
          <div className="field">
            <label>New total portfolio value</label>
            <input value={newTotal} onChange={e => setNewTotal(parseNumber(e.target.value))} />
          </div>
        ) : (
          <div className="field">
            <label>Additional investment</label>
            <input value={additional} onChange={e => setAdditional(parseNumber(e.target.value))} />
          </div>
        )}
      </div>

      <div className="subtle" style={{ marginTop: 10 }}>
        Enter your current $ value per symbol. The tool will compute target weights using the latest QQQ Top 10.
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Current value</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map(s => (
            <tr key={s.symbol}>
              <td className="mono">{s.symbol}</td>
              <td>{s.name}</td>
              <td>
                <input
                  value={current[s.symbol] ?? ""}
                  onChange={e => setCurrent(prev => ({ ...prev, [s.symbol]: parseNumber(e.target.value) }))}
                  placeholder="0"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr />

      <div className="row">
        <span className="pill">Current total: <span className="mono">{usd(result.currentTotal)}</span></span>
        <span className="pill">Target total: <span className="mono">{usd(result.newTotal)}</span></span>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Target %</th>
            <th>Current</th>
            <th>Target</th>
            {mode === "newTotal" ? <th>Buy/Sell</th> : <th>Suggested Buy</th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map(r => {
            const buySell = r.delta;
            const buyOnly = r.suggestedBuy || 0;

            return (
              <tr key={r.symbol}>
                <td className="mono">{r.symbol}</td>
                <td>{pct(r.targetPct)}</td>
                <td>{usd(r.current)}</td>
                <td>{usd(r.targetValue)}</td>
                {mode === "newTotal" ? (
                  <td>
                    {buySell >= 0 ? `Buy ${usd(buySell)}` : `Sell ${usd(Math.abs(buySell))}`}
                  </td>
                ) : (
                  <td>{buyOnly > 0 ? `Buy ${usd(buyOnly)}` : "—"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
