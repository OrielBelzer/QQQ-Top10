import { useEffect, useMemo, useState } from "react";
import { loadQqqHoldings, topN } from "./lib/holdings.js";
import { mergeAlphabet } from "./lib/mergeAlphabet.js";

import InvestmentCalculator from "./components/InvestmentCalculator.jsx";
import Rebalancer from "./components/Rebalancer.jsx";
import HoldingsOverview from "./components/HoldingsOverview.jsx";

export default function App() {
  const [qqq, setQqq] = useState(null);
  const [tab, setTab] = useState("calc");
  const [err, setErr] = useState("");

  useEffect(() => {
    loadQqqHoldings()
      .then(setQqq)
      .catch(e => {
        console.error(e);
        setErr(String(e?.message || e));
      });
  }, []);

  const qqqTop10 = useMemo(() => {
    if (!qqq?.holdings) return [];
    const merged = mergeAlphabet(qqq.holdings);
    return topN(merged, 10);
  }, [qqq]);

  return (
    <div className="container">
      <h1>QQQ Top-10 Tool</h1>

      {err && (
        <div className="card" style={{ borderColor: "#ffd2d2", background: "#fff7f7" }}>
          <div className="subtle">Error loading holdings: <span className="mono">{err}</span></div>
        </div>
      )}

      <div className="tabs">
        <button onClick={() => setTab("calc")} className={tab === "calc" ? "active" : ""}>
          Calculator
        </button>
        <button onClick={() => setTab("rebalance")} className={tab === "rebalance" ? "active" : ""}>
          Rebalancer
        </button>
        <button onClick={() => setTab("overview")} className={tab === "overview" ? "active" : ""}>
          Holdings
        </button>
      </div>

      {!qqq ? (
        <div className="card">Loading QQQ holdings…</div>
      ) : tab === "calc" ? (
        <InvestmentCalculator qqqTop10={qqqTop10} />
      ) : tab === "rebalance" ? (
        <Rebalancer qqqTop10={qqqTop10} />
      ) : (
        <HoldingsOverview qqq={qqq} />
      )}
    </div>
  );
}
