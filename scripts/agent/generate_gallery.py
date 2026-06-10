#!/usr/bin/env python3
"""Assemble the evidence gallery index.html from the sweep results."""
import json, html
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2]
GAL = ROOT / "release" / "evidence" / "gallery"
sweep = json.load(open(GAL / "data" / "sweep.json"))

BADGE = {
    "VERIFIED":   ("#1e7a34", "#d6f5df", "VERIFIED"),
    "PARTIAL":    ("#9a6a00", "#fdf0d0", "PARTIAL"),
    "UNVERIFIED": ("#9a1b2e", "#fbdfe4", "UNVERIFIED"),
}
counts = sweep["counts"]
fleet = sweep.get("fleetSnapshot", {})

rows = ""
for r in sorted(sweep["results"], key=lambda x: ["VERIFIED","PARTIAL","UNVERIFIED"].index(x["status"])):
    fg, bg, label = BADGE[r["status"]]
    rows += f"""<tr>
      <td><code>{html.escape(r['path'])}</code></td>
      <td><span class="badge" style="color:{fg};background:{bg}">{label}</span></td>
      <td class="num">{r.get('sourceFiles','—')}</td>
      <td>{html.escape(r['detail'])}</td>
    </tr>"""

doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maataa Runtime Evidence Gallery</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; background:#0b101c; color:#e2e8f0; }}
  .wrap {{ max-width:1040px; margin:0 auto; padding:36px 24px 80px; }}
  h1 {{ font-size:26px; margin:0 0 6px; }}
  .sub {{ color:#8c98ac; margin:0 0 26px; }}
  .note {{ background:#15203a; border-left:4px solid #40c478; padding:14px 18px; border-radius:8px; margin:0 0 28px; line-height:1.5; }}
  .grid {{ display:flex; gap:14px; flex-wrap:wrap; margin:0 0 28px; }}
  .stat {{ background:#141c2e; border-radius:12px; padding:16px 20px; flex:1; min-width:150px; }}
  .stat .n {{ font-size:34px; font-weight:700; }}
  .stat .l {{ color:#8c98ac; font-size:13px; text-transform:uppercase; letter-spacing:.04em; }}
  video {{ width:100%; border-radius:12px; background:#000; }}
  .vidcap {{ color:#8c98ac; font-size:13px; margin:8px 0 30px; }}
  table {{ width:100%; border-collapse:collapse; font-size:14px; }}
  th,td {{ text-align:left; padding:10px 12px; border-bottom:1px solid #1e2940; vertical-align:top; }}
  th {{ color:#8c98ac; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }}
  td.num {{ text-align:right; color:#8c98ac; }}
  code {{ color:#cdd7e6; }}
  .badge {{ padding:2px 9px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:.03em; }}
  h2 {{ font-size:18px; margin:34px 0 12px; }}
</style></head>
<body><div class="wrap">
  <h1>Maataa Runtime Evidence Gallery</h1>
  <p class="sub">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} · swept by the Evidence Agent · {len(sweep['results'])} runtimes</p>

  <div class="note">
    <strong>This gallery shows real evidence, not advertisements.</strong> A runtime is marked
    <b>VERIFIED</b> only when a command actually ran and passed here. <b>PARTIAL</b> means real source/build
    exists but could not be executed in this environment. <b>UNVERIFIED</b> means there is nothing runnable to
    back it (most are partial backups with no <code>package.json</code>). No demo videos were fabricated for
    things that do not run — that would just be the “advertisement stats” problem at higher resolution.
  </div>

  <div class="grid">
    <div class="stat"><div class="n" style="color:#40c478">{counts.get('VERIFIED',0)}</div><div class="l">Verified</div></div>
    <div class="stat"><div class="n" style="color:#d6a23a">{counts.get('PARTIAL',0)}</div><div class="l">Partial</div></div>
    <div class="stat"><div class="n" style="color:#d2506a">{counts.get('UNVERIFIED',0)}</div><div class="l">Unverified</div></div>
    <div class="stat"><div class="n">{fleet.get('activeAgents','—')}</div><div class="l">Live agents</div></div>
  </div>

  <h2>Video evidence — Agent Runtime (VERIFIED)</h2>
  <video controls poster="agent-runtime-poster.png"><source src="agent-runtime.mp4" type="video/mp4"></video>
  <p class="vidcap">Every counter in this clip is read live from the agent registry as 12 agents come online and the
  orchestrator delegates real tasks. Backed by <code>tests/agent-registry.test.mjs</code> (7/7 pass) and
  <code>release/evidence/agent-runtime.json</code>.</p>

  <h2>All runtimes swept</h2>
  <table>
    <thead><tr><th>Runtime</th><th>Status</th><th>Src files</th><th>Evidence / why</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <h2>How to get more green</h2>
  <p class="sub" style="line-height:1.6">UNVERIFIED runtimes are partial backups missing <code>package.json</code>, so they can't build or run.
  Restore each project's full tree (with manifest, lockfile, and tests), declare a <code>verifyCmd</code> in the
  Evidence Agent's runtime list, and re-run <code>scripts/agent/build-runtime-evidence-gallery.mjs</code> — anything
  whose tests actually pass will flip to VERIFIED with its own video.</p>
</div></body></html>
"""
out = GAL / "index.html"
out.write_text(doc, encoding="utf-8")
print(f"GALLERY {out.relative_to(ROOT)}")
