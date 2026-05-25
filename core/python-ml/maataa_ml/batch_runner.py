"""Local batch compiler for Maataa OS script matrices."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from pathlib import Path

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
    batches = parse_script_batches(jobs, workers=len(SCRIPTS))
    sums: list[str] = []

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
        sums.append(f"{sha256_file(output_path)}  {output_path.name}")
        print(
            f"{script}: tokens={len(tokens)} known={summary['known']} "
            f"unknown={summary['unknown']} weight={summary['weight']} -> {output_path}"
        )

    sums_path = OUTPUT_DIR / "SHA256SUMS"
    sums_path.write_text("\n".join(sums) + "\n", encoding="utf-8")
    print(f"sha256: {sums_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
