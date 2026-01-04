import { useMemo, useState } from "react";
import { usd, pct, parseNumber } from "../lib/format.js";
import { buildTargets, rebalanceToNewTotal, rebalanceWithAdditionalInvestment } from "../lib/rebalance.js";
import { ocrImageFile, parseHoldingsFromText } from "../lib/ocrParse.js";

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

  const allowedSymbolsSet = useMemo(() => new Set(symbols.map(s => s.symbol)), [symbols]);

  const [current, setCurrent] = useState(() => ({}));

  // OCR state
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRaw, setOcrRaw] = useState("");
  const [ocrError, setOcrError] = useState("");

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

  async function handleScreenshotUpload(file) {
    if (!file) return;

    setOcrError("");
    setOcrRaw("");
    setOcrBusy(true);
    setOcrProgress(0);

    try {
      const text = await ocrImageFile(file, {
        onProgress: p => setOcrProgress(p)
      });

      setOcrRaw(text);

      const parsed = parseHoldingsFromText(text, allowedSymbolsSet);

      if (Object.keys(parsed).length === 0) {
        setOcrError(
          "OCR finished, but I couldn’t confidently extract any symbol/value pairs. Try a clearer screenshot (cropped to the holdings table) with tickers + $ values visible."
        );
        return;
      }

      // Merge parsed values into current
      setCurrent(prev => ({ ...prev, ...parsed }));
    } catch (e) {
      setOcrError(String(e?.message || e));
    } finally {
      setOcrBusy(false);
    }
  }

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
        Enter your current $ value per symbol manually, or import via screenshot OCR below. The tool computes target weights
        using the latest QQQ Top 10 snapshot.
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Import from screenshot (OCR)</h1>

      <div className="row" style={{ alignItems: "center" }}>
        <div className="field" style={{ minWidth: 320 }}>
          <label>Upload brokerage screenshot (PNG/JPG)</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={ocrBusy}
            onChange={e => handleScreenshotUpload(e.target.files?.[0])}
          />
        </div>

        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label>&nbsp;</label>
          <span className="pill">{ocrBusy ? `OCR running… ${ocrProgress}%` : "Tip: crop to holdings table for best results"}</span>
        </div>
      </div>

      {ocrError && (
        <div className="card" style={{ borderColor: "#ffd2d2", background: "#fff7f7" }}>
          <div className="subtle">
            OCR error: <span className="mono">{ocrError}</span>
          </div>
        </div>
      )}

      {ocrRaw && (
        <details className="card">
          <summary className="subtle">Show OCR raw text (debug)</summary>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{ocrRaw}</pre>
        </details>
      )}

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