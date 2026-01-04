#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone

HOLDINGS_PATH = "public/qqq-holdings.json"
HISTORY_DIR = "public/history"
INDEX_PATH = os.path.join(HISTORY_DIR, "index.json")
KEEP_DAYS = 90  # keep last 90 snapshots

def parse_date_from_snapshot(data: dict) -> str:
    """
    Returns YYYY-MM-DD.
    Preference:
      1) asOfClose (often MM/DD/YYYY)
      2) fetchedAtUtc (ISO)
      3) today (UTC)
    """
    as_of = (data.get("asOfClose") or "").strip()
    if as_of:
        for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
            try:
                return datetime.strptime(as_of, fmt).date().isoformat()
            except ValueError:
                pass

    fetched = (data.get("fetchedAtUtc") or "").strip()
    if fetched:
        try:
            # Handle Z suffix
            if fetched.endswith("Z"):
                fetched = fetched[:-1] + "+00:00"
            dt = datetime.fromisoformat(fetched)
            return dt.astimezone(timezone.utc).date().isoformat()
        except Exception:
            pass

    return datetime.now(timezone.utc).date().isoformat()

def load_json(path: str, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path: str, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, sort_keys=False)
        f.write("\n")

def main():
    if not os.path.exists(HOLDINGS_PATH):
        raise SystemExit(f"Missing {HOLDINGS_PATH}. Run fetch_holdings.py first.")

    os.makedirs(HISTORY_DIR, exist_ok=True)

    data = load_json(HOLDINGS_PATH, None)
    if not isinstance(data, dict):
        raise SystemExit("qqq-holdings.json is not an object")

    day = parse_date_from_snapshot(data)
    dated_path = os.path.join(HISTORY_DIR, f"{day}.json")

    # Write dated snapshot (overwrite ok)
    save_json(dated_path, data)

    # Update index.json
    index = load_json(INDEX_PATH, [])
    if not isinstance(index, list):
        index = []

    if day not in index:
        index.append(day)

    # Sort ascending
    index = sorted(set(index))

    # Keep only last KEEP_DAYS
    if len(index) > KEEP_DAYS:
        index = index[-KEEP_DAYS:]

    # Remove old snapshot files not in index
    keep_set = set(index)
    for fn in os.listdir(HISTORY_DIR):
        if fn == "index.json":
            continue
        if fn.endswith(".json"):
            d = fn[:-5]
            if d not in keep_set:
                try:
                    os.remove(os.path.join(HISTORY_DIR, fn))
                except Exception:
                    pass

    save_json(INDEX_PATH, index)

    print(f"Wrote history snapshot: {dated_path}")
    print(f"Index now has {len(index)} days")

if __name__ == "__main__":
    main()
