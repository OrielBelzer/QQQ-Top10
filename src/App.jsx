import { useEffect, useMemo, useState } from "react";
import Tabs from "./components/Tabs.jsx";
import InvestmentCalculator from "./components/InvestmentCalculator.jsx";
import Rebalancer from "./components/Rebalancer.jsx";
import HoldingsOverview from "./components/HoldingsOverview.jsx";
import { loadQqqHoldings, topN } from "./lib/holdings.js";
import { loadCustomStocks } from "./lib/storage.js";

export default function App() {
  const [tab, setTab] = useState("calc");
  const [holdingsData, setHoldingsData] = useState({ source: "", asOfClose: "", fetchedAtUtc: "", holdings: [] });
  const [error, setError] = useState("");
  const [customStocks, setCustomStocks] = useState(() => loadCustomStocks());

  useEffect(() => {
    (async () => {
      try {
        const data = await loadQqqHoldings();
        setHoldingsData(data);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, []);

  const qqqTop10 = useMemo(() => topN(holdingsData.holdings, 10), [holdingsData]);

  return (
    <div className="container">
      <h1>QQQ Top 10 Tools</h1>
      <div className="subtle">
        Uses a repo-local holdings snapshot (auto-updated by GitHub Actions).
        {" "}
        As of close: <span className="mono">{holdingsData.asOfClose || "—"}</span>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "#ffd2d2", background: "#fff7f7" }}>
          <div className="subtle">Error loading holdings: <span className="mono">{error}</span></div>
          <div className="subtle">Tip: ensure <span className="mono">public/qqq-holdings.json</span> exists in your repo.</div>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "calc", label: "Investment Calculator" },
          { value: "rebalance", label: "Rebalancer" },
          { value: "overview", label: "QQQ Holdings Overview" }
        ]}
      />

      {tab === "calc" && (
        <InvestmentCalculator
          qqqTop10={qqqTop10}
          customStocks={customStocks}
          setCustomStocks={setCustomStocks}
        />
      )}

      {tab === "rebalance" && (
        <Rebalancer qqqTop10={qqqTop10} customStocks={customStocks} />
      )}

      {tab === "overview" && (
        <HoldingsOverview holdingsData={holdingsData} />
      )}
    </div>
  );
}
