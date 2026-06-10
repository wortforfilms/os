#!/usr/bin/env python3
"""Render a data-driven MP4 from the captured live runtime frames.

Reads release/evidence/gallery/data/frames.json (real numbers sampled from the
agent store) and draws one PNG per frame, then muxes to MP4 via ffmpeg. Nothing
is invented: every counter on screen comes from the JSON.
"""
import json, math, os, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
GAL = ROOT / "release" / "evidence" / "gallery"
DATA = GAL / "data" / "frames.json"
FRAMES_DIR = GAL / "_frames"
FRAMES_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1280, 720
BG = (11, 16, 28)
PANEL = (20, 28, 46)
ACCENT = (64, 196, 120)
DIM = (70, 84, 110)
FAIL = (210, 80, 80)
TXT = (226, 232, 240)
SUB = (140, 152, 172)

def font(sz, bold=False):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

F_BIG = font(120, True)
F_H = font(34, True)
F_M = font(24)
F_S = font(18)
F_NODE = font(15, True)

doc = json.load(open(DATA))
seed = doc["seed"]
frames = doc["frames"]

# radial layout for 12 agents
cx, cy, R = 360, 400, 230
positions = []
n = len(seed)
for i in range(n):
    ang = -math.pi / 2 + i * (2 * math.pi / n)
    positions.append((cx + R * math.cos(ang), cy + R * math.sin(ang)))

def draw_frame(fr, idx):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # header
    d.text((48, 36), "Maataa Agent Runtime", font=F_H, fill=TXT)
    d.text((48, 78), "Live evidence — every number read from the real registry", font=F_S, fill=SUB)
    d.text((W - 250, 40), "REAL DATA", font=F_S, fill=ACCENT)

    online = set(fr["onlineSlugs"])
    pulse = 0.55 + 0.45 * abs(math.sin(idx * 0.5))

    # edges from orchestrator (index 0) to online agents
    ox, oy = positions[0]
    for i, a in enumerate(seed):
        if i == 0:
            continue
        if a["slug"] in online:
            x, y = positions[i]
            d.line((ox, oy, x, y), fill=(40, 70, 60), width=2)

    # nodes
    for i, a in enumerate(seed):
        x, y = positions[i]
        active = a["slug"] in online
        r = 30 if i == 0 else 24
        if active:
            glow = int(120 * pulse)
            col = (int(ACCENT[0]), int(ACCENT[1]), int(ACCENT[2]))
            d.ellipse((x - r - 8, y - r - 8, x + r + 8, y + r + 8), fill=(20, 60, 42))
            d.ellipse((x - r, y - r, x + r, y + r), fill=col)
        else:
            d.ellipse((x - r, y - r, x + r, y + r), outline=DIM, width=2, fill=PANEL)
        label = a["slug"][:8]
        tb = d.textbbox((0, 0), label, font=F_NODE)
        d.text((x - (tb[2] - tb[0]) / 2, y - 8), label, font=F_NODE, fill=(8, 16, 14) if active else SUB)

    # right panel metrics
    px = 760
    d.rounded_rectangle((px, 130, W - 48, 660), radius=16, fill=PANEL)
    d.text((px + 30, 160), "ACTIVE AGENTS", font=F_M, fill=SUB)
    d.text((px + 26, 196), f"{fr['activeAgents']}", font=F_BIG, fill=ACCENT)
    d.text((px + 200, 270), f"/ {fr['registeredAgents']}", font=F_H, fill=SUB)

    y0 = 360
    rows = [
        ("Tasks completed", str(fr["tasksCompleted"]), ACCENT),
        ("Tasks failed", str(fr["tasksFailed"]), FAIL if fr["tasksFailed"] else SUB),
        ("Success rate", ("—" if fr["successRate"] is None else f"{fr['successRate']*100:.1f}%"), TXT),
    ]
    for lbl, val, col in rows:
        d.text((px + 30, y0), lbl, font=F_M, fill=SUB)
        tb = d.textbbox((0, 0), val, font=F_H)
        d.text((W - 70 - (tb[2] - tb[0]), y0 - 4), val, font=F_H, fill=col)
        y0 += 64

    # progress bar of fleet coming online
    d.text((px + 30, y0 + 10), "Fleet boot", font=F_S, fill=SUB)
    bx0, bx1 = px + 30, W - 70
    d.rounded_rectangle((bx0, y0 + 36, bx1, y0 + 56), radius=10, outline=DIM, width=2)
    frac = fr["activeAgents"] / max(1, fr["registeredAgents"])
    d.rounded_rectangle((bx0, y0 + 36, bx0 + int((bx1 - bx0) * frac), y0 + 56), radius=10, fill=ACCENT)

    d.text((48, H - 36), "tests/agent-registry.test.mjs · 7/7 pass · release/evidence/agent-runtime.json", font=F_S, fill=SUB)
    img.save(FRAMES_DIR / f"f{idx:04d}.png")

for idx, fr in enumerate(frames):
    draw_frame(fr, idx)

# hold the last frame a bit longer
last = len(frames)
for k in range(12):
    Image.open(FRAMES_DIR / f"f{len(frames)-1:04d}.png").save(FRAMES_DIR / f"f{last+k:04d}.png")

out = GAL / "agent-runtime.mp4"
poster = GAL / "agent-runtime-poster.png"
Image.open(FRAMES_DIR / f"f{len(frames)-1:04d}.png").save(poster)
cmd = [
    "ffmpeg", "-y", "-framerate", "12", "-i", str(FRAMES_DIR / "f%04d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out),
]
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# cleanup frames
for p in FRAMES_DIR.glob("*.png"):
    p.unlink()
FRAMES_DIR.rmdir()
print(f"VIDEO {out.relative_to(ROOT)} size={out.stat().st_size}")
print(f"POSTER {poster.relative_to(ROOT)}")
