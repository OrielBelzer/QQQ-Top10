import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets, rebalanceToNewTotal, rebalanceWithAdditionalInvestment } from "../lib/rebalance.js";
import { parseHoldingsPaste } from "../lib/pasteHoldings.js";

export default function Rebalancer({ qqqTop10, customStocks = [] }) {
  const [useTop10As100Pct, setUseTop10As100Pct] = useState(true);
  const [mode, setMode] = useState("newTotal"); // newTotal | additional
  const [newTotal, setNewTotal] = useState(50000);
  const [additional, setAdditional] = useState(5000);

  const symbols = useMemo(() => {
    const base = (qqqTop10 || []).map(h => ({ symbol: h.symbol, name: h.name }));
    const custom = (customStocks || []).map(s => ({ symbol: s.symbol, name: s.name || s.symbol }));
    const all = [...base, ...custom];
    const map = new Map();
    for (const x of all) map.set(x.symbol, x);
    return [...map.values()];
  }, [qqqTop10, customStocks]);

  const allowedSymbolsSet = useMemo(() => new Set(symbols.map(s => s.symbol)), [symbols]);

  const [current, setCurrent] = useState(() => ({}));

  // Paste-to-fill state
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

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

  function parseAndFill() {
    setPasteError("");
    const parsed = parseHoldingsPaste(pasteText, allowedSymbolsSet);

    const count = Object.keys(parsed).length;
    if (count === 0) {
      setPasteError("No symbol/value pairs found. Try lines like: NVDA $8.83K or MSFT=7230");
      return;
    }

    setCurrent(prev => ({ ...prev, ...parsed }));
  }

  function clearCurrent() {
    setCurrent({});
  }

  const example = `NVDA $8.83K
MSFT $7.23K
AAPL $6.35K
AMZN $4.60K`;

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Top-10 weighting mode</label>
          <select
            value={useTop10As100Pct ? "100" : "actual"}
            onChange={e => setUseTop10As100Pct(e.target.value === "100")}
          >
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
        Paste your current holdings values (from ChatGPT or anywhere) and click Parse & Fill.
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Paste holdings</h1>

      <div className="subtle" style={{ marginBottom: 8 }}>
        Supported formats per line: <span className="mono">NVDA $8.83K</span>, <span className="mono">MSFT=7230</span>,{" "}
        <span className="mono">AAPL: 6,350</span>, <span className="mono">AMZN 4600</span>.
      </div>

      <textarea
        value={pasteText}
        onChange={e => setPasteText(e.target.value)}
        rows={6}
        style={{ width: "100%", resize: "vertical" }}
        placeholder={example}
      />

      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
        <button onClick={parseAndFill}>Parse & Fill</button>
        <button onClick={() => setPasteText(example)} className="secondary">
          Insert example
        </button>
        <button onClick={clearCurrent} className="secondary">
          Clear current values
        </button>
        {pasteError && (
          <span className="pill" style={{ borderColor: "#ffd2d2", background: "#fff7f7" }}>
            <span className="mono">{pasteError}</span>
          </span>
        )}
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Current holdings</h1>

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
        <span className="pill">
          Current total: <span className="mono">{usd(result.currentTotal)}</span>
        </span>
        <span className="pill">
          Target total: <span className="mono">{usd(result.newTotal)}</span>
        </span>
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
                  <td>{buySell >= 0 ? `Buy ${usd(buySell)}` : `Sell ${usd(Math.abs(buySell))}`}</td>
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
