import { pct } from "../lib/format.js";
import { topN } from "../lib/holdings.js";

export default function HoldingsOverview({ holdingsData }) {
  const holdings = Array.isArray(holdingsData?.holdings) ? holdingsData.holdings : [];
  const top20 = topN(holdings, 20);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="pill">
          Source: <span className="mono">{holdingsData?.source || "—"}</span>
        </span>
        <span className="pill">
          As of close: <span className="mono">{holdingsData?.asOfClose || "—"}</span>
        </span>
        <span className="pill">
          Fetched:{" "}
          <span className="mono">
            {holdingsData?.fetchedAtUtc ? new Date(holdingsData.fetchedAtUtc).toISOString() : "—"}
          </span>
        </span>
      </div>

      {holdings.length === 0 ? (
        <div className="subtle" style={{ marginTop: 12 }}>
          No holdings data loaded yet.
        </div>
      ) : (
        <>
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
            Showing top 20 of {holdings.length}.
          </div>
        </>
      )}
    </div>
  );
}
