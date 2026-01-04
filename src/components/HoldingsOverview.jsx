import { useEffect, useMemo, useState } from "react";
import { pct } from "../lib/format.js";
import { topN } from "../lib/holdings.js";
import { loadHistoryIndex, loadSnapshot, pickDatesForWindow, normalizeHoldings } from "../lib/history.js";

/* ---------- small sortable helper ---------- */
function useSortable(rows, initialKey, initialDir = "desc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  function toggle(key) {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function indicator(key) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return { rows: sorted, toggle, indicator };
}

/* ---------- tiny SVG line helper ---------- */
function svgPath(points, w, h, pad = 10) {
  if (!points.length) return "";
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const sx = x => pad + (maxX === minX ? 0 : ((x - minX) / (maxX - minX)) * (w - 2 * pad));
  const sy = y => pad + (1 - (maxY === minY ? 0 : ((y - minY) / (maxY - minY)))) * (h - 2 * pad);

  return points.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`
  ).join(" ");
}

export default function HoldingsOverview({ holdingsData }) {
  const latestHoldings = holdingsData?.holdings || [];
  const top20Raw = useMemo(() => topN(latestHoldings, 20), [latestHoldings]);
  const top20 = useSortable(top20Raw, "weightPct");

  /* ---------- history ---------- */
  const [windowDays, setWindowDays] = useState(7);
  const [historyIndex, setHistoryIndex] = useState([]);
  const [snapStart, setSnapStart] = useState(null);
  const [snapEnd, setSnapEnd] = useState(null);
  const [chartSymbol, setChartSymbol] = useState("NVDA");
  const [series, setSeries] = useState([]);

  useEffect(() => {
    loadHistoryIndex().then(setHistoryIndex).catch(() => setHistoryIndex([]));
  }, []);

  const windowInfo = useMemo(
    () => pickDatesForWindow(historyIndex, windowDays),
    [historyIndex, windowDays]
  );

  useEffect(() => {
    async function run() {
      if (!windowInfo.end) return;
      const [start, end] = await Promise.all([
        windowInfo.start ? loadSnapshot(windowInfo.start) : null,
        loadSnapshot(windowInfo.end)
      ]);
      setSnapStart(start);
      setSnapEnd(end);

      const snaps = await Promise.all(
        windowInfo.datesInWindow.map(d => loadSnapshot(d))
      );

      const out = snaps.map((s, i) => {
        const h = normalizeHoldings(s).find(x => x.symbol === chartSymbol);
        return { x: i, y: h ? h.weightPct : 0 };
      });
      setSeries(out);
    }
    run();
  }, [windowInfo, chartSymbol]);

  const moversRaw = useMemo(() => {
    if (!snapEnd) return [];
    const endH = normalizeHoldings(snapEnd);
    const startH = snapStart ? normalizeHoldings(snapStart) : [];
    const startMap = new Map(startH.map(x => [x.symbol, x.weightPct]));

    return endH.map(h => ({
      symbol: h.symbol,
      name: h.name,
      now: h.weightPct,
      then: startMap.get(h.symbol) || 0,
      change: h.weightPct - (startMap.get(h.symbol) || 0)
    }));
  }, [snapStart, snapEnd]);

  const movers = useSortable(moversRaw, "change");

  const path = svgPath(series, 520, 140, 12);

  return (
    <div className="card">
      <h1 style={{ fontSize: 16 }}>Top holdings (latest)</h1>

      <table className="table">
        <thead>
          <tr>
            <th onClick={() => top20.toggle("symbol")}>Symbol{top20.indicator("symbol")}</th>
            <th onClick={() => top20.toggle("name")}>Company{top20.indicator("name")}</th>
            <th onClick={() => top20.toggle("weightPct")}>Weight{top20.indicator("weightPct")}</th>
          </tr>
        </thead>
        <tbody>
          {top20.rows.map(h => (
            <tr key={h.symbol}>
              <td className="mono">{h.symbol}</td>
              <td>{h.name}</td>
              <td>{pct(h.weightPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr />

      <h1 style={{ fontSize: 16 }}>History (last 3 months stored)</h1>

      <div className="row">
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
            {top20Raw.map(x => <option key={x.symbol}>{x.symbol}</option>)}
          </select>
        </div>
      </div>

      <svg width="100%" viewBox="0 0 520 140" style={{ border: "1px solid #ddd", borderRadius: 8 }}>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      <hr />

      <h1 style={{ fontSize: 16 }}>Biggest movers</h1>

      <table className="table">
        <thead>
          <tr>
            <th onClick={() => movers.toggle("symbol")}>Symbol{movers.indicator("symbol")}</th>
            <th onClick={() => movers.toggle("name")}>Company{movers.indicator("name")}</th>
            <th onClick={() => movers.toggle("now")}>Now{movers.indicator("now")}</th>
            <th onClick={() => movers.toggle("then")}>Then{movers.indicator("then")}</th>
            <th onClick={() => movers.toggle("change")}>Change{movers.indicator("change")}</th>
          </tr>
        </thead>
        <tbody>
          {movers.rows.map(r => (
            <tr key={r.symbol}>
              <td className="mono">{r.symbol}</td>
              <td>{r.name}</td>
              <td>{pct(r.now)}</td>
              <td>{pct(r.then)}</td>
              <td>{r.change >= 0 ? "+" : ""}{pct(r.change)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
