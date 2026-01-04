import json
import re
import sys
from datetime import datetime, timezone
import urllib.request

SCHWAB_URL = "https://www.schwab.wallst.com/schwab/Prospect/research/etfs/schwabETF/index.asp?symbol=QQQ&type=holdings"

def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; qqq-top10-bot/1.0)"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")

def parse_as_of_close(html: str) -> str:
    m = re.search(r"As of close\s+(\d{2}/\d{2}/\d{4})", html)
    return m.group(1) if m else ""

def parse_holdings(html: str):
    pattern = re.compile(r"\b([A-Z]{1,6})\s+(.+?)\s+(\d+\.\d+)%")
    results = []

    idx = html.find("Symbol")
    if idx == -1:
        return results

    body = html[idx:]
    for sym, name, weight in pattern.findall(body):
        w = float(weight)
        if w <= 0 or w > 25:
            continue
        results.append({
            "symbol": sym,
            "name": " ".join(name.split()),
            "weightPct": w
        })

    seen = set()
    uniq = []
    for r in results:
        if r["symbol"] in seen:
            continue
        seen.add(r["symbol"])
        uniq.append(r)

    return uniq

def main():
    html = fetch(SCHWAB_URL)
    as_of = parse_as_of_close(html)
    holdings = parse_holdings(html)

    if len(holdings) < 20:
        print("ERROR: parsed too few holdings. Page format may have changed.", file=sys.stderr)
        sys.exit(1)

    payload = {
        "source": "schwab",
        "asOfClose": as_of,
        "fetchedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "holdings": holdings
    }

    out_path = "public/qqq-holdings.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote {out_path} with {len(holdings)} holdings (asOfClose={as_of})")

if __name__ == "__main__":
    main()
