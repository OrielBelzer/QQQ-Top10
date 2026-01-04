import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets } from "../lib/rebalance.js";
import { saveCustomStocks } from "../lib/storage.js";

export default function InvestmentCalculator({ qqqTop10, customStocks, setCustomStocks }) {
  const [amount, setAmount] = useState(10000);
  const [useTop10As100Pct, setUseTop10As100Pct] = useState(true);

  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState(5);

  const { meta, targets } = useMemo(() => {
    return buildTargets({
      qqqTop10,
      useTop10As100Pct,
      customStocks
    });
  }, [qqqTop10, useTop10As100Pct, customStocks]);

  const allocations = useMemo(() => {
    const total = parseNumber(amount);
    return targets.map(t => ({
      ...t,
      dollars: (t.targetPct / 100) * total
    }));
  }, [targets, amount]);

  function addCustom() {
    const symbol = String(newSymbol || "").toUpperCase().trim();
    const name = String(newName || "").trim();
    const weightPct = parseNumber(newWeight);

    if (!symbol || weightPct <= 0) return;

    const next = [
      ...customStocks.filter(s => s.symbol !== symbol),
      { symbol, name: name || symbol, weightPct }
    ].sort((a, b) => b.weightPct - a.weightPct);

    setCustomStocks(next);
    saveCustomStocks(next);

    setNewSymbol("");
    setNewName("");
    setNewWeight(5);
  }

  function removeCustom(symbol) {
    const next = customStocks.filter(s => s.symbol !== symbol);
    setCustomStocks(next);
    saveCustomStocks(next);
  }

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Total investment amount</label>
          <input value={amount} onChange={e => setAmount(parseNumber(e.target.value))} />
        </div>

        <div className="field">
          <label>Top-10 weighting mode</label>
          <select value={useTop10As100Pct ? "100" : "actual"} onChange={e => setUseTop10As100Pct(e.target.value === "100")}>
            <option value="100">Use 100% (treat Top 10 as full QQQ allocation)</option>
            <option value="actual">Use actual Top-10 sum (leave remainder as “Other QQQ”)</option>
          </select>
        </div>
      </div>

      <div className="subtle" style={{ marginTop: 10 }}>
        Top-10 sum currently: <span className="mono">{meta.top10Sum.toFixed(2)}%</span>
        {" · "}
        Using as QQQ slice: <span className="mono">{meta.qqqPortionPct.toFixed(2)}%</span>
        {" · "}
        Custom sum: <span className="mono">{meta.customSum.toFixed(2)}%</span>
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Add custom stocks</h1>
      <div className="row">
        <div className="field">
          <label>Symbol</label>
          <input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="e.g. VOO" />
        </div>
        <div className="field">
          <label>Company name (optional)</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Vanguard S&P 500 ETF" />
        </div>
        <div className="field">
          <label>Weight %</label>
          <input value={newWeight} onChange={e => setNewWeight(parseNumber(e.target.value))} />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <button className="primary" onClick={addCustom} type="button">
            Add / Update
          </button>
        </div>
      </div>

      {customStocks.length > 0 && (
        <>
          <div className="subtle" style={{ marginTop: 10 }}>Custom stocks (saved in your browser)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Weight</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customStocks.map(s => (
                <tr key={s.symbol}>
                  <td className="mono">{s.symbol}</td>
                  <td>{s.name}</td>
                  <td>{pct(s.weightPct)}</td>
                  <td>
                    <button className="danger" type="button" onClick={() => removeCustom(s.symbol)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Allocation</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Target %</th>
            <th>Dollar amount</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map(a => (
            <tr key={a.symbol}>
              <td className="mono">{a.symbol}</td>
              <td>{a.name}</td>
              <td>{pct(a.targetPct)}</td>
              <td>{usd(a.dollars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
