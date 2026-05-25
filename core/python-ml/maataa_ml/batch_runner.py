"""Local batch compiler for Maataa OS script matrices."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict
from pathlib import Path

from maataa_ml.frames import encode_mabs, encode_magv, fixed_confidence
from maataa_ml.script_matrices import parse_script_batches, summarize_tokens


ROOT = Path(__file__).resolve().parents[3]
INPUT_DIR = ROOT / "data" / "script-batches"
OUTPUT_DIR = ROOT / "build" / "script-datasets"
SCRIPTS = ("brahmi", "kharosthi", "siddham")


def read_jobs() -> list[tuple[str, str]]:
    jobs: list[tuple[str, str]] = []
    for script in SCRIPTS:
        path = INPUT_DIR / f"{script}.txt"
        if not path.exists():
            raise FileNotFoundError(f"missing script batch: {path}")
        jobs.append((script, path.read_text(encoding="utf-8")))
    return jobs


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs = read_jobs()
    started = time.perf_counter_ns()
    batches = parse_script_batches(jobs, workers=len(SCRIPTS))
    duration_ms = (time.perf_counter_ns() - started) // 1_000_000
    sums: list[str] = []
    total_known = 0
    total_tokens = 0

    print("Maataa OS script batch runner")
    print(f"input: {INPUT_DIR}")
    print(f"output: {OUTPUT_DIR}")

    for (script, _text), tokens in zip(jobs, batches):
        summary = summarize_tokens(tokens)
        output_path = OUTPUT_DIR / f"{script}.tokens.json"
        payload = {
            "script": script,
            "summary": summary,
            "tokens": [asdict(token) for token in tokens],
        }
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        magv_path = OUTPUT_DIR / f"{script}.magv.bin"
        magv_path.write_bytes(b"".join(encode_magv(token, index) for index, token in enumerate(tokens)))
        sums.append(f"{sha256_file(output_path)}  {output_path.name}")
        sums.append(f"{sha256_file(magv_path)}  {magv_path.name}")
        total_known += summary["known"]
        total_tokens += len(tokens)
        print(
            f"{script}: tokens={len(tokens)} known={summary['known']} "
            f"unknown={summary['unknown']} weight={summary['weight']} -> {output_path}"
        )
        print(f"{script}: magv_frames={len(tokens)} bytes={magv_path.stat().st_size} -> {magv_path}")

    sums_path = OUTPUT_DIR / "SHA256SUMS"
    sums_path.write_text("\n".join(sums) + "\n", encoding="utf-8")
    mabs_path = OUTPUT_DIR / "batch.mabs.bin"
    mabs_path.write_bytes(
        encode_mabs(
            total_glyphs=total_tokens,
            confidence_fixed=fixed_confidence(total_known, total_tokens),
            duration_ms=duration_ms,
            sha256sums_path=sums_path,
        )
    )
    sums.append(f"{sha256_file(mabs_path)}  {mabs_path.name}")
    sums_path.write_text("\n".join(sums) + "\n", encoding="utf-8")
    print(
        f"mabs: total_glyphs={total_tokens} confidence_fixed={fixed_confidence(total_known, total_tokens)} "
        f"duration_ms={duration_ms} bytes={mabs_path.stat().st_size} -> {mabs_path}"
    )
    print(f"sha256: {sums_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
