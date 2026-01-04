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

def html_to_text(html: str) -> str:
    # remove scripts/styles (helps a lot)
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    # drop tags
    html = re.sub(r"<[^>]+>", " ", html)
    # common entities
    html = html.replace("&nbsp;", " ").replace("&amp;", "&")
    # normalize whitespace
    html = re.sub(r"\s+", " ", html).strip()
    return html

def parse_as_of_close(text: str) -> str:
    m = re.search(r"As of close\s+(\d{2}/\d{2}/\d{4})", text)
    return m.group(1) if m else ""

def parse_holdings(text: str):
    # Matches lines like: "NVDA NVIDIA Corp 9.01%"
    # (The Schwab page often concatenates after %, so we stop at the %.)
    pattern = re.compile(r"\b([A-Z]{1,6})\s+(.+?)\s+(\d{1,2}\.\d{1,2})%")
    results = []

    # Start around where the holdings table begins
    idx = text.find("Symbol Description % Portfolio Weight")
    if idx == -1:
        idx = text.find("Symbol Description % Portfolio")  # fallback
    body = text[idx:] if idx != -1 else text

    for sym, name, weight in pattern.findall(body):
        w = float(weight)
        if w <= 0 or w > 25:
            continue
        results.append({
            "symbol": sym,
            "name": " ".join(name.split()),
            "weightPct": w
        })

    # de-dupe by symbol, keep first occurrence
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
    text = html_to_text(html)

    as_of = parse_as_of_close(text)
    holdings = parse_holdings(text)

    # IMPORTANT: Schwab may only show ~20 per page in the HTML.
    # We only need Top 10, so require >=10 (not 20).
    if len(holdings) < 10:
        print("ERROR: parsed too few holdings (<10). Page format may have changed.", file=sys.stderr)
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