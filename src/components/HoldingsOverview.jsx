import { useEffect, useMemo, useState } from "react";
import { pct } from "../lib/format.js";
import { topN } from "../lib/holdings.js";
import { loadHistoryIndex, loadSnapshot, pickDatesForWindow, normalizeHoldings } from "../lib/history.js";

function svgPath(points, w, h, pad = 10) {
  if (!points.length) return "";
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const sx = (x) => {
    if (maxX === minX) return w / 2;
    return pad + ((x - minX) / (maxX - minX)) * (w - 2 * pad);
  };
  const sy = (y) => {
    if (maxY === minY) return h / 2;
    // higher y should go up on chart
    return pad + (1 - (y - minY) / (maxY - minY)) * (h - 2 * pad);
  };

  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`).join(" ");
}

export default function HoldingsOverview({ holdingsData }) {
  const latestHoldings = useMemo(() => {
    const arr = Array.isArray(holdingsData?.holdings) ? holdingsData.holdings : [];
    return arr;
  }, [holdingsData]);

  const top20 = useMemo(() => topN(latestHoldings || [], 20), [latestHoldings]);

  // --- History state
  const [windowDays, setWindowDays] = useState(7);
  const [historyIndex, setHistoryIndex] = useState([]);
  const [historyErr, setHistoryErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapStart, setSnapStart] = useState(null);
  const [snapEnd, setSnapEnd] = useState(null);

  const [chartSymbol, setChartSymbol] = useState("NVDA");
  const [series, setSeries] = useState([]); // [{date, weightPct}]

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setHistoryErr("");

    loadHistoryIndex()
      .then(idx => {
        if (!alive) return;
        setHistoryIndex(idx);
      })
      .catch(e => {
        if (!alive) return;
        setHistoryErr(String(e?.message || e));
      })
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, []);

  const windowInfo = useMemo(() => pickDatesForWindow(historyIndex, windowDays), [historyIndex, windowDays]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setHistoryErr("");
      setLoading(true);

      try {
        const { start, end, datesInWindow } = windowInfo;

        if (!end || datesInWindow.length === 0) {
          setSnapStart(null);
          setSnapEnd(null);
          setSeries([]);
          setLoading(false);
          return;
        }

        const [startSnap, endSnap] = await Promise.all([
          start ? loadSnapshot(start) : null,
          loadSnapshot(end)
        ]);

        if (!alive) return;
        setSnapStart(startSnap);
        setSnapEnd(endSnap);

        // Load series for chart (all dates in window)
        const snaps = await Promise.all(datesInWindow.map(d => loadSnapshot(d).then(s => ({ d, s }))));

        const out = snaps.map(({ d, s }) => {
          const hs = normalizeHoldings(s);
          const row = hs.find(x => x.symbol === chartSymbol);
          return { date: d, weightPct: row ? row.weightPct : 0 };
        });

        if (!alive) return;
        setSeries(out);
      } catch (e) {
        if (!alive) return;
        setHistoryErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [windowInfo, chartSymbol]);

  const movers = useMemo(() => {
    if (!snapEnd) return [];
    const endH = normalizeHoldings(snapEnd);
    const startH = snapStart ? normalizeHoldings(snapStart) : [];

    const startMap = new Map(startH.map(x => [x.symbol, x.weightPct]));
    const endMap = new Map(endH.map(x => [x.symbol, x.weightPct]));

    const symbols = new Set([...startMap.keys(), ...endMap.keys()]);

    // focus on top holdings "now" for readability (top 20 by end weight)
    const endTop = [...endH].sort((a, b) => b.weightPct - a.weightPct).slice(0, 20);
    const focus = new Set(endTop.map(x => x.symbol));

    const rows = [];
    for (const sym of symbols) {
      if (!focus.has(sym)) continue;
      const now = endMap.get(sym) || 0;
      const then = startMap.get(sym) || 0;
      rows.push({
        symbol: sym,
        name: (endH.find(x => x.symbol === sym)?.name) || (startH.find(x => x.symbol === sym)?.name) || "",
        now,
        then,
        change: now - then
      });
    }
    return rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [snapStart, snapEnd]);

  const chartOptions = useMemo(() => {
    // prefer top 20 from latest snapshot (already in app) for symbol dropdown
    const syms = (top20 || []).map(x => x.symbol);
    // ensure current selected is included
    if (chartSymbol && !syms.includes(chartSymbol)) syms.unshift(chartSymbol);
    return [...new Set(syms)];
  }, [top20, chartSymbol]);

  const chartPoints = useMemo(() => {
    // map dates to x as index, y as weightPct
    return series.map((p, i) => ({ x: i, y: p.weightPct }));
  }, [series]);

  const path = useMemo(() => svgPath(chartPoints, 520, 140, 12), [chartPoints]);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="pill">Source: <span className="mono">{holdingsData?.source || "unknown"}</span></span>
        <span className="pill">As of close: <span className="mono">{holdingsData?.asOfClose || "—"}</span></span>
        <span className="pill">Fetched: <span className="mono">{holdingsData?.fetchedAtUtc ? new Date(holdingsData.fetchedAtUtc).toISOString() : "—"}</span></span>
      </div>

      <h1 style={{ fontSize: 16, marginTop: 14, marginBottom: 8 }}>Top holdings (latest)</h1>

      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {top20.map(h => (
            <tr key={h.symbol}>
              <td className="mono">{h.symbol}</td>
              <td>{h.name}</td>
              <td>{pct(h.weightPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="subtle" style={{ marginTop: 10 }}>
        Showing top 20 of {Array.isArray(holdingsData?.holdings) ? holdingsData.holdings.length : 0}.
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>History (last 3 months stored)</h1>

      <div className="row" style={{ alignItems: "center" }}>
        <div className="field">
          <label>Window</label>
          <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        <div className="field">
          <label>Chart symbol</label>
          <select value={chartSymbol} onChange={e => setChartSymbol(e.target.value)}>
            {chartOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 22 }}>
          <span className="pill">Days stored: <span className="mono">{historyIndex.length}</span></span>
          <span className="pill">Window start: <span className="mono">{windowInfo.start || "—"}</span></span>
          <span className="pill">Window end: <span className="mono">{windowInfo.end || "—"}</span></span>
        </div>
      </div>

      {historyErr && (
        <div className="pill" style={{ borderColor: "#ffd2d2", background: "#fff7f7", marginTop: 10 }}>
          <span className="mono">{historyErr}</span>
        </div>
      )}

      {loading && (
        <div className="subtle" style={{ marginTop: 10 }}>Loading history…</div>
      )}

      <div style={{ marginTop: 12 }}>
        <div className="subtle" style={{ marginBottom: 6 }}>
          {series.length ? `${chartSymbol} weight over time` : "No history data yet (need multiple days)."}
        </div>
        <svg width="100%" viewBox="0 0 520 140" style={{ border: "1px solid #e6e6e6", borderRadius: 8, background: "white" }}>
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {series.length > 0 && (
          <div className="subtle" style={{ marginTop: 6 }}>
            {series[0]?.date} → {series[series.length - 1]?.date} (min {pct(Math.min(...series.map(s => s.weightPct)))} / max {pct(Math.max(...series.map(s => s.weightPct)))})
          </div>
        )}
      </div>

      <hr />

      <h1 style={{ fontSize: 16, marginBottom: 8 }}>Biggest movers (Top 20 today)</h1>

      <table className="table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Now</th>
            <th>Then</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {movers.length === 0 ? (
            <tr>
              <td colSpan="5" className="subtle">
                No comparison available yet. Once you have at least 2 dated snapshots, this will populate.
              </td>
            </tr>
          ) : movers.map(r => (
            <tr key={r.symbol}>
              <td className="mono">{r.symbol}</td>
              <td>{r.name}</td>
              <td>{pct(r.now)}</td>
              <td>{pct(r.then)}</td>
              <td>{r.change >= 0 ? `+${pct(r.change)}` : `-${pct(Math.abs(r.change))}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
