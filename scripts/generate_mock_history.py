#!/usr/bin/env python3
import json, os, random
from datetime import datetime, timedelta, timezone

HOLDINGS_PATH = "public/qqq-holdings.json"
HISTORY_DIR = "public/history"
INDEX_PATH = os.path.join(HISTORY_DIR, "index.json")

DAYS = 7              # how many days back to generate (including today)
JITTER_BPS = 35       # +/- jitter in basis points (35 bps = 0.35%) on weights
SEED = 42             # deterministic output so you can reproduce

def load_json(path, default):
  if not os.path.exists(path): return default
  with open(path, "r", encoding="utf-8") as f:
    return json.load(f)

def save_json(path, obj):
  with open(path, "w", encoding="utf-8") as f:
    json.dump(obj, f, indent=2)
    f.write("\n")

def iso_date(d): return d.strftime("%Y-%m-%d")

def main():
  if not os.path.exists(HOLDINGS_PATH):
    raise SystemExit(f"Missing {HOLDINGS_PATH}. Run fetch_holdings.py first.")

  os.makedirs(HISTORY_DIR, exist_ok=True)

  base = load_json(HOLDINGS_PATH, None)
  if not isinstance(base, dict) or not isinstance(base.get("holdings"), list):
    raise SystemExit("qqq-holdings.json is not in expected format")

  random.seed(SEED)

  # Keep existing index entries (if any)
  index = load_json(INDEX_PATH, [])
  if not isinstance(index, list): index = []
  index_set = set(index)

  # Use last close date if present, else today UTC
  today = datetime.now(timezone.utc).date()
  # Generate DAYS dates ending today (UTC)
  dates = [today - timedelta(days=i) for i in reversed(range(DAYS))]

  created = []
  for d in dates:
    day = iso_date(d)
    out_path = os.path.join(HISTORY_DIR, f"{day}.json")

    # Build a simulated snapshot
    snap = dict(base)  # shallow copy
    snap["source"] = (base.get("source") or "unknown") + " (simulated)"
    snap["asOfClose"] = day
    snap["fetchedAtUtc"] = datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    snap["mock"] = True

    # Jitter weights slightly but keep them positive
    holdings = []
    for h in base["holdings"]:
      w = float(h.get("weightPct") or 0)
      jitter = random.uniform(-JITTER_BPS, JITTER_BPS) / 100.0  # bps -> pct
      w2 = max(0.0001, w + jitter)
      hh = dict(h)
      hh["weightPct"] = round(w2, 4)
      holdings.append(hh)

    # (Optional) renormalize top-level weights roughly by scaling to base sum
    base_sum = sum(float(x.get("weightPct") or 0) for x in base["holdings"])
    new_sum = sum(x["weightPct"] for x in holdings)
    if base_sum > 0 and new_sum > 0:
      scale = base_sum / new_sum
      for x in holdings:
        x["weightPct"] = round(x["weightPct"] * scale, 4)

    snap["holdings"] = holdings
    save_json(out_path, snap)

    if day not in index_set:
      index_set.add(day)
      created.append(day)

  index_out = sorted(index_set)
  save_json(INDEX_PATH, index_out)

  print(f"Generated/updated {DAYS} simulated snapshots in {HISTORY_DIR}")
  print("Added to index:", created if created else "(none; dates already existed)")
  print("To delete mocks later: python scripts/generate_mock_history.py -- (see delete steps in chat)")

if __name__ == "__main__":
  main()
