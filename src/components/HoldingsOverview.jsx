import { useMemo, useState } from "react";
import { pct } from "../lib/format.js";
import { topN } from "../lib/holdings.js";
import { nextSort, sortRows, sortIndicator } from "../lib/sort.js";

export default function HoldingsOverview({ holdingsData }) {
  const holdings = Array.isArray(holdingsData?.holdings) ? holdingsData.holdings : [];
  const top20 = useMemo(() => topN(holdings, 20), [holdings]);

  const [sort, setSort] = useState({ key: "weightPct", dir: "desc" });

  const rows = useMemo(() => {
    return sortRows(top20, sort, (h, key) => {
      if (key === "symbol") return h.symbol;
      if (key === "name") return h.name;
      if (key === "weightPct") return h.weightPct;
      return h[key];
    });
  }, [top20, sort]);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="pill">Source: <span className="mono">{holdingsData?.source || "—"}</span></span>
        <span className="pill">As of close: <span className="mono">{holdingsData?.asOfClose || "—"}</span></span>
        <span className="pill">Fetched: <span className="mono">{holdingsData?.fetchedAtUtc ? new Date(holdingsData.fetchedAtUtc).toISOString() : "—"}</span></span>
      </div>

      {rows.length === 0 ? (
        <div className="subtle" style={{ marginTop: 12 }}>No holdings data loaded yet.</div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => setSort(s => nextSort(s, "symbol"))}>
                  Symbol{sortIndicator(sort, "symbol")}
                </th>
                <th className="th-sort" onClick={() => setSort(s => nextSort(s, "name"))}>
                  Company{sortIndicator(sort, "name")}
                </th>
                <th className="th-sort" onClick={() => setSort(s => nextSort(s, "weightPct"))}>
                  Weight{sortIndicator(sort, "weightPct")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.symbol}>
                  <td className="mono">{h.symbol}</td>
                  <td>{h.name}</td>
                  <td>{pct(h.weightPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="subtle" style={{ marginTop: 10 }}>
            Showing top 20 of {holdings.length}.
          </div>
        </>
      )}
    </div>
  );
}
