import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets, rebalanceToNewTotal, rebalanceWithAdditionalInvestment } from "../lib/rebalance.js";
import { parseHoldingsPaste } from "../lib/pasteHoldings.js";
import { nextSort, sortRows, sortIndicator } from "../lib/sort.js";

export default function Rebalancer({ qqqTop10, customStocks = [] }) {
  const [useTop10As100Pct, setUseTop10As100Pct] = useState(true);
  const [mode, setMode] = useState("newTotal"); // newTotal | additional
  const [newTotal, setNewTotal] = useState(50000);
  const [additional, setAdditional] = useState(5000);

  const [current, setCurrent] = useState(() => ({}));

  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");

  const baseSymbols = useMemo(() => {
    const base = (qqqTop10 || []).map(h => ({ symbol: h.symbol, name: h.name }));
    const custom = (customStocks || []).map(s => ({ symbol: s.symbol, name: s.name || s.symbol }));
    const all = [...base, ...custom];
    const map = new Map();
    for (const x of all) map.set(x.symbol, x);
    return [...map.values()];
  }, [qqqTop10, customStocks]);

  const baseAllowedSymbolsSet = useMemo(() => new Set(baseSymbols.map(s => s.symbol)), [baseSymbols]);
  const hasCombinedAlphabet = baseAllowedSymbolsSet.has("GOOG+GOOGL");

  const symbols = useMemo(() => {
    const map = new Map(baseSymbols.map(s => [s.symbol, s]));
    for (const sym of Object.keys(current || {})) {
      if (hasCombinedAlphabet && (sym === "GOOG" || sym === "GOOGL")) continue;
      if (!map.has(sym)) map.set(sym, { symbol: sym, name: `${sym} (not in target)` });
    }
    return [...map.values()];
  }, [baseSymbols, current, hasCombinedAlphabet]);

  const allowedSymbolsSet = useMemo(() => new Set(symbols.map(s => s.symbol)), [symbols]);

  const { targets } = useMemo(() => {
    return buildTargets({ qqqTop10, useTop10As100Pct, customStocks });
  }, [qqqTop10, useTop10As100Pct, customStocks]);

  const extendedTargets = useMemo(() => {
    const tMap = new Map((targets || []).map(t => [t.symbol, t]));
    for (const sym of Object.keys(current || {})) {
      if (hasCombinedAlphabet && (sym === "GOOG" || sym === "GOOGL")) continue;
      if (!tMap.has(sym)) tMap.set(sym, { symbol: sym, name: `${sym} (not in target)`, targetPct: 0 });
    }
    return [...tMap.values()];
  }, [targets, current, hasCombinedAlphabet]);

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

    const parsedKnown = parseHoldingsPaste(pasteText, allowedSymbolsSet);
    const parsedAll = parseHoldingsPaste(pasteText, null);
    const parsed = { ...parsedAll, ...parsedKnown };
    const count = Object.keys(parsed).length;

    if (count === 0) {
      setPasteError("No symbol/value pairs found. Try lines like: NVDA $8.83K or MSFT=7230");
      return;
    }

    if (hasCombinedAlphabet) {
      const g = (parsed.GOOG || 0) + (parsed.GOOGL || 0);
      if (g > 0) parsed["GOOG+GOOGL"] = (parsed["GOOG+GOOGL"] || 0) + g;
      delete parsed.GOOG;
      delete parsed.GOOGL;
    }

    setCurrent(prev => {
      const next = { ...prev, ...parsed };
      if (hasCombinedAlphabet) {
        delete next.GOOG;
        delete next.GOOGL;
      }
      return next;
    });
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

  // Sorting state for both tables
  const [sortCurrent, setSortCurrent] = useState({ key: "symbol", dir: "asc" });
  const [sortPlan, setSortPlan] = useState({ key: "targetPct", dir: "desc" });

  const currentRows = useMemo(() => {
    return sortRows(symbols, sortCurrent, (s, key) => {
      if (key === "symbol") return s.symbol;
      if (key === "name") return s.name;
      if (key === "current") return Number(current[s.symbol] || 0);
      return s[key];
    });
  }, [symbols, sortCurrent, current]);

  const planRows = useMemo(() => {
    return sortRows(result.rows || [], sortPlan, (r, key) => {
      if (key === "symbol") return r.symbol;
      if (key === "targetPct") return r.targetPct;
      if (key === "current") return r.current;
      if (key === "targetValue") return r.targetValue;
      if (key === "delta") return r.delta;
      return r[key];
    });
  }, [result.rows, sortPlan]);

  const currentSum = useMemo(() => {
    return symbols.reduce((acc, s) => acc + (Number(current[s.symbol]) || 0), 0);
  }, [symbols, current]);

  const planSums = useMemo(() => {
    const rows = result.rows || [];
    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return {
      targetPct: sum("targetPct"),
      current: sum("current"),
      targetValue: sum("targetValue"),
      delta: sum("delta")
    };
  }, [result.rows]);

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label>Top-10 weighting mode</label>
          <select value={useTop10As100Pct ? "100" : "actual"} onChange={e => setUseTop10As100Pct(e.target.value === "100")}>
            <option value="100">Use 100% (Top-10-only portfolio)</option>
            <option value="actual">Use actual QQQ weights (includes QQQ_OTHER)</option>
          </select>
        </div>

        <div className="field">
          <label>Rebalance method</label>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="newTotal">New Total Portfolio Value (buy/sell)</option>
            <option value="additional">Additional Investment (full rebalance)</option>
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
        Paste holdings values (from ChatGPT). Symbols you own that are not in today’s target list will still be included and get a 0% target.
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Paste holdings</h1>

      <textarea
        value={pasteText}
        onChange={e => setPasteText(e.target.value)}
        rows={7}
        style={{ width: "100%", resize: "vertical" }}
        placeholder={example}
      />

      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
        <button onClick={parseAndFill}>Parse & Fill</button>
        <button onClick={() => setPasteText(example)} className="secondary">Insert example</button>
        <button onClick={clearCurrent} className="secondary">Clear current values</button>
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
            <th className="th-sort" onClick={() => setSortCurrent(s => nextSort(s, "symbol"))}>
              Symbol{sortIndicator(sortCurrent, "symbol")}
            </th>
            <th className="th-sort" onClick={() => setSortCurrent(s => nextSort(s, "name"))}>
              Company{sortIndicator(sortCurrent, "name")}
            </th>
            <th className="th-sort" onClick={() => setSortCurrent(s => nextSort(s, "current"))}>
              Current value{sortIndicator(sortCurrent, "current")}
            </th>
          </tr>
        </thead>
        <tbody>
          {currentRows.map(s => (
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
        <tfoot>
          <tr>
            <td className="mono"><strong>Total</strong></td>
            <td className="subtle"> </td>
            <td><strong>{usd(currentSum)}</strong></td>
          </tr>
        </tfoot>
      </table>

      <hr />

      <div className="row">
        <span className="pill">Current total: <span className="mono">{usd(result.currentTotal)}</span></span>
        <span className="pill">Target total: <span className="mono">{usd(result.newTotal)}</span></span>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th className="th-sort" onClick={() => setSortPlan(s => nextSort(s, "symbol"))}>Symbol{sortIndicator(sortPlan, "symbol")}</th>
            <th className="th-sort" onClick={() => setSortPlan(s => nextSort(s, "targetPct"))}>Target %{sortIndicator(sortPlan, "targetPct")}</th>
            <th className="th-sort" onClick={() => setSortPlan(s => nextSort(s, "current"))}>Current{sortIndicator(sortPlan, "current")}</th>
            <th className="th-sort" onClick={() => setSortPlan(s => nextSort(s, "targetValue"))}>Target{sortIndicator(sortPlan, "targetValue")}</th>
            <th className="th-sort" onClick={() => setSortPlan(s => nextSort(s, "delta"))}>Buy/Sell{sortIndicator(sortPlan, "delta")}</th>
          </tr>
        </thead>
        <tbody>
          {planRows.map(r => {
            const buySell = r.delta || 0;
            return (
              <tr key={r.symbol}>
                <td className="mono">{r.symbol}</td>
                <td>{pct(r.targetPct)}</td>
                <td>{usd(r.current)}</td>
                <td>{usd(r.targetValue)}</td>
                <td>{buySell >= 0 ? `Buy ${usd(buySell)}` : `Sell ${usd(Math.abs(buySell))}`}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="mono"><strong>Total</strong></td>
            <td><strong>{pct(planSums.targetPct)}</strong></td>
            <td><strong>{usd(planSums.current)}</strong></td>
            <td><strong>{usd(planSums.targetValue)}</strong></td>
            <td>
              <strong>
                {planSums.delta >= 0 ? `Net Buy ${usd(planSums.delta)}` : `Net Sell ${usd(Math.abs(planSums.delta))}`}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
