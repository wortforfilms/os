#!/usr/bin/env python3
"""Render an HTML preview of the dashboard figures: LIVE vs ILLUSTRATIVE tiles."""
import json, html
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
m = json.load(open(ROOT / "data" / "dashboard-figures.json"))
figs = m["figures"]
by_uni = defaultdict(list)
for f in figs:
    by_uni[f["universe"]].append(f)

def tile(f):
    if f["live"]:
        return f"""<div class="tile live">
          <div class="badge live">● LIVE</div>
          <div class="val">{html.escape(str(f['value']))}</div>
          <div class="lbl">{html.escape(f['text'][:48])}</div>
          <div class="src">from {html.escape(f['source'])}</div>
        </div>"""
    val = html.escape(str(f.get('value') or '—'))
    return f"""<div class="tile rep">
      <div class="badge rep">ILLUSTRATIVE · not live</div>
      <div class="val">{val}</div>
      <div class="lbl">{html.escape(f['text'][:48])}</div>
      <div class="src">aspirational target — not measured</div>
    </div>"""

sections = ""
for uni in sorted(by_uni):
    items = by_uni[uni]
    live_n = sum(1 for x in items if x["live"])
    tiles = "".join(tile(f) for f in items)
    sections += f"""<section><h2>{html.escape(uni)} <span class="cnt">{len(items)} figures · {live_n} live</span></h2>
      <div class="grid">{tiles}</div></section>"""

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard Figures — Live vs Illustrative</title>
<style>
  :root{{color-scheme:dark}}
  body{{margin:0;background:#0b101c;color:#e2e8f0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}}
  .wrap{{max-width:1100px;margin:0 auto;padding:32px 22px 80px}}
  h1{{font-size:24px;margin:0 0 4px}}
  .sub{{color:#8c98ac;margin:0 0 18px}}
  .legend{{display:flex;gap:18px;margin:0 0 26px;flex-wrap:wrap}}
  .key{{display:flex;align-items:center;gap:8px;font-size:13px;color:#aab4c5}}
  .dot{{width:12px;height:12px;border-radius:3px}}
  .dot.l{{background:#40c478}} .dot.r{{background:#3a4760}}
  h2{{font-size:15px;margin:26px 0 10px;color:#c7d2e2;text-transform:capitalize}}
  h2 .cnt{{color:#8c98ac;font-size:12px;font-weight:400;margin-left:8px}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}}
  .tile{{border-radius:12px;padding:14px 16px;position:relative;min-height:96px}}
  .tile.live{{background:#10261b;border:1px solid #1e7a34}}
  .tile.rep{{background:#141c2e;border:1px dashed #3a4760;opacity:.92}}
  .val{{font-size:30px;font-weight:700;margin:6px 0 2px}}
  .tile.rep .val{{color:#9aa6ba}}
  .tile.live .val{{color:#5fe39a}}
  .lbl{{font-size:12px;color:#aab4c5;line-height:1.3}}
  .src{{font-size:10px;color:#6b7689;margin-top:8px}}
  .badge{{font-size:9px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:20px;display:inline-block}}
  .badge.live{{background:#1e7a34;color:#dff7e6}}
  .badge.rep{{background:#26324a;color:#9fb0c8}}
</style></head><body><div class="wrap">
  <h1>Dashboard Figures — Live vs Illustrative</h1>
  <p class="sub">Generated from <code>data/dashboard-figures.json</code> · {m['summary']['total']} figures · {m['summary']['live']} live · {m['summary']['representative']} illustrative</p>
  <div class="legend">
    <div class="key"><span class="dot l"></span> LIVE — bound to a real runtime/evidence source</div>
    <div class="key"><span class="dot r"></span> ILLUSTRATIVE — board target, shown but never claimed as measured</div>
  </div>
  {sections}
</div></body></html>"""
out = ROOT / "release" / "evidence" / "dashboard-figures-preview.html"
out.write_text(doc, encoding="utf-8")
print(f"PREVIEW {out.relative_to(ROOT)} ({len(figs)} tiles)")
