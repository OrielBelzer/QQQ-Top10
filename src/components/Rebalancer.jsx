import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets, rebalanceToNewTotal, rebalanceWithAdditionalInvestment } from "../lib/rebalance.js";
import { parseHoldingsPaste } from "../lib/pasteHoldings.js";

export default function Rebalancer({ qqqTop10, customStocks = [] }) {
  const [useTop10As100Pct, setUseTop10As100Pct] = useState(true);
  const [mode, setMode] = useState("newTotal"); // newTotal | additional
  const [newTotal, setNewTotal] = useState(50000);
  const [additional, setAdditional] = useState(5000);

  const [current, setCurrent] = useState(() => ({}));

  // Paste-to-fill state
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

  // Base (target) symbols: Top10 + custom
  const baseSymbols = useMemo(() => {
    const base = (qqqTop10 || []).map(h => ({ symbol: h.symbol, name: h.name }));
    const custom = (customStocks || []).map(s => ({ symbol: s.symbol, name: s.name || s.symbol }));
    const all = [...base, ...custom];
    const map = new Map();
    for (const x of all) map.set(x.symbol, x);
    return [...map.values()];
  }, [qqqTop10, customStocks]);

  // Include any symbols that exist in CURRENT holdings (even if not in today's Top10)
  const symbols = useMemo(() => {
    const map = new Map(baseSymbols.map(s => [s.symbol, s]));
    for (const sym of Object.keys(current || {})) {
      if (!map.has(sym)) {
        map.set(sym, { symbol: sym, name: `${sym} (not in target)` });
      }
    }
    return [...map.values()];
  }, [baseSymbols, current]);

  const allowedSymbolsSet = useMemo(() => new Set(symbols.map(s => s.symbol)), [symbols]);

  const { targets } = useMemo(() => {
    return buildTargets({ qqqTop10, useTop10As100Pct, customStocks });
  }, [qqqTop10, useTop10As100Pct, customStocks]);

  // Extend targets with any current-only symbols => targetPct 0
  const extendedTargets = useMemo(() => {
    const tMap = new Map((targets || []).map(t => [t.symbol, t]));
    for (const sym of Object.keys(current || {})) {
      if (!tMap.has(sym)) {
        tMap.set(sym, { symbol: sym, name: `${sym} (not in target)`, targetPct: 0 });
      }
    }
    return [...tMap.values()];
  }, [targets, current]);

  const result = useMemo(() => {
    if (mode === "newTotal") {
      return rebalanceToNewTotal({
        targets: extendedTargets,
        currentValuesBySymbol: current,
        newTotal: parseNumber(newTotal)
      });
    }
    return rebalanceWithAdditionalInvestment({
      targets: extendedTargets,
      currentValuesBySymbol: current,
      additional: parseNumber(additional)
    });
  }, [mode, extendedTargets, current, newTotal, additional]);

  function parseAndFill() {
    setPasteError("");

    // Pass 1: parse using allowedSymbolsSet (so GOOG/GOOGL alias mapping works when GOOG+GOOGL exists)
    const parsedKnown = parseHoldingsPaste(pasteText, allowedSymbolsSet);

    // Pass 2: parse without allowedSymbolsSet (captures "old" holdings like COST that aren’t in today’s targets)
    const parsedAll = parseHoldingsPaste(pasteText, null);

    const parsed = { ...parsedAll, ...parsedKnown }; // known wins if overlap
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
AMZN $4.60K
AVGO $4.74K
META $3.82K
GOOGL $3.36K
NFLX $2.18K
TSLA $2.59K
COST $1.91K`;

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Top-10 weighting mode</label>
          <select
            value={useTop10As100Pct ? "100" : "actual"}
            onChange={e => setUseTop10As100Pct(e.target.value === "100")}
          >
            <option value="100">Use 100% (Top-10-only portfolio)</option>
            <option value="actual">Use actual QQQ weights (Top-10 slice of QQQ)</option>
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
        Paste holdings values (from ChatGPT). Any symbols you own that are not in today’s target list will still be included
        and will get a 0% target (so the plan will tell you to sell them in “New Total” mode).
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Paste holdings</h1>

      <div className="subtle" style={{ marginBottom: 8 }}>
        Supported formats: <span className="mono">NVDA $8.83K</span>, <span className="mono">MSFT=7230</span>,{" "}
        <span className="mono">AAPL: 6,350</span>, <span className="mono">AMZN 4600</span>.
      </div>

      <textarea
        value={pasteText}
        onChange={e => setPasteText(e.target.value)}
        rows={7}
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
