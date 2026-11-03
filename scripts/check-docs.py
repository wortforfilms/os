#!/usr/bin/env python3
"""Checks that the docs still say what the code does (drift check).

    ./scripts/check-docs.py                       # docs against the source
    ./scripts/check-docs.py --sizes FILE          # also against sizecheck.sh output

What it compares:
  1. version: Cargo.toml against README, doc/*.md headers and the release notes;
  2. smoke checks: TOTAL in scripts/smoke-alpha.sh against its `pass` calls and
     every "N checks" / "smoke N" in the docs; the number of kernel feature
     sets CI lints against the docs that count them;
  3. SVC ABI: docs/ABI_SVC.md call and error tables, and its limits line,
     against the constants in the source; syscall::error_name against the
     error codes;
  4. sizes: docs/size.md's current table (its own arithmetic, and the limit
     and warning level in scripts/sizecheck.sh); with --sizes, the measured
     sizes must be within SIZE_SLACK bytes of the table.
Exit status 0 if everything matches; otherwise one line per mismatch.
Python 3 standard library only.
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# How far a measured image may be from docs/size.md before the table must be
# updated. Small changes do not need a doc edit; a few KB do.
SIZE_SLACK = 2048

problems = []


def problem(where, text):
    problems.append(f"{where}: {text}")


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def one(pattern, text, where, what):
    m = re.search(pattern, text, re.M)
    if not m:
        problem(where, f"cannot find {what}")
        return None
    return m.group(1)


# 1. Version -----------------------------------------------------------------

def check_version():
    version = one(r'^version = "([^"]+)"', read("Cargo.toml"), "Cargo.toml", "the package version")
    if version is None:
        return
    tag = f"v{version}"
    wanted = {
        "README.md": r"^Release: `(v[^`]+)`",
        "doc/SYSTEM_MANIFEST.md": r"at `(v[^`]+)`",
        "doc/ARCHITECTURE.md": r"at `(v[^`]+)`",
        "doc/BUILD_GUIDE.md": r"at `(v[^`]+)`",
        "doc/ROADMAP.md": r"^Status at `(v[^`]+)`",
    }
    for rel, pattern in wanted.items():
        found = one(pattern, read(rel), rel, "the version it describes")
        if found is not None and found != tag:
            problem(rel, f"says {found}, Cargo.toml is {tag}")
    notes = read("doc/RELEASE_NOTES.md")
    if not re.search(rf"^# .*{re.escape(tag)}\b", notes, re.M):
        problem("doc/RELEASE_NOTES.md", f"no section heading for {tag}")


# 2. Smoke checks ------------------------------------------------------------

def check_smoke():
    smoke = read("scripts/smoke-alpha.sh")
    total = one(r"^TOTAL=(\d+)$", smoke, "scripts/smoke-alpha.sh", "TOTAL=")
    if total is None:
        return
    total = int(total)
    passes = len(re.findall(r"^pass$", smoke, re.M))
    if passes != total:
        problem("scripts/smoke-alpha.sh", f"TOTAL={total} but {passes} `pass` calls")
    for path in [ROOT / "README.md", *sorted((ROOT / "doc").glob("*.md")), *sorted((ROOT / "docs").rglob("*.md"))]:
        rel = path.relative_to(ROOT).as_posix()
        if rel == "doc/RELEASE_NOTES.md":
            continue  # history: older releases had fewer checks
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "smoke" in line.lower():
                for m in re.finditer(r"(?<!smoke )\b(\d+) checks\b", line):
                    if int(m.group(1)) != total:
                        problem(f"{rel}:{n}", f"says {m.group(1)} smoke checks, the script has {total}")
            for m in re.finditer(r"\bsmoke (\d+)\b", line):
                if not 1 <= int(m.group(1)) <= total:
                    problem(f"{rel}:{n}", f"names smoke check {m.group(1)}; there are {total}")


WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
         "nine", "ten", "eleven", "twelve"]


def check_ci():
    ci = read(".github/workflows/verify.yml")
    sets = len(re.findall(r"^\s*cargo clippy --target thumbv7em-none-eabihf", ci, re.M))
    for rel in ["doc/BUILD_GUIDE.md", "docs/EVIDENCE_MATRIX.md"]:
        flat = " ".join(read(rel).split())
        for m in re.finditer(r"\b(\w+) kernel feature sets\b", flat):
            n = WORDS.index(m.group(1)) if m.group(1) in WORDS else int(m.group(1)) if m.group(1).isdigit() else None
            if n != sets:
                problem(rel, f"says {m.group(1)} kernel feature sets, verify.yml lints {sets}")


# 3. SVC ABI -----------------------------------------------------------------

def table_rows(text, header):
    """Rows of the markdown table whose header line starts with `header`."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith(header):
            rows = []
            for row in lines[i + 2:]:
                if not row.startswith("|"):
                    break
                rows.append([c.strip() for c in row.strip("|").split("|")])
            return rows
    return None


def check_abi():
    src = read("src/syscall.rs")
    doc = read("docs/ABI_SVC.md")
    where = "docs/ABI_SVC.md"

    calls = {name: int(n) for name, n in re.findall(r"^pub const SYS_(\w+): u8 = (\d+);", src, re.M)}
    rows = table_rows(doc, "| N | Name")
    if rows is None:
        problem(where, "no call table")
    else:
        documented = {}
        for row in rows:
            m = re.match(r"`(\w+)`", row[1])
            if m:
                documented[m.group(1)] = int(row[0])
        for name, n in calls.items():
            if name not in documented:
                problem(where, f"call SYS_{name} ({n}) is missing")
            elif documented[name] != n:
                problem(where, f"call {name} is {documented[name]}, the source says {n}")
        for name in documented.keys() - calls.keys():
            problem(where, f"call {name} is not in src/syscall.rs")

    codes = {}
    for name, value in re.findall(r"^pub const (E_\w+): u32 = u32::MAX(?: - (\d+))?;", src, re.M):
        codes[name] = int(value or 0)
    rows = table_rows(doc, "| Code | Value")
    if rows is None:
        problem(where, "no error code table")
    else:
        documented = {}
        for row in rows:
            name = row[0].strip("`")
            m = re.fullmatch(r"`(?:u32::MAX|MAX - (\d+))`", row[1])
            if not m:
                problem(where, f"cannot read the value of {name}: {row[1]}")
                continue
            documented[name] = int(m.group(1) or 0)
        for name, value in codes.items():
            if name not in documented:
                problem(where, f"error {name} (MAX - {value}) is missing")
            elif documented[name] != value:
                problem(where, f"error {name} is MAX - {documented[name]}, the source says MAX - {value}")
        for name in documented.keys() - codes.keys():
            problem(where, f"error {name} is not in src/syscall.rs")

    m = re.search(r"pub const fn error_name\(code: u32\) -> &'static str \{(.*?)\n\}", src, re.S)
    if m is None:
        problem("src/syscall.rs", "cannot find error_name")
    else:
        named = set(re.findall(r"^\s*(E_\w+) =>", m.group(1), re.M))
        for name in codes.keys() - named:
            problem("src/syscall.rs", f"error_name has no name for {name}")

    limits = {
        "MAX_MESSAGE": ("src/ipc/mailbox.rs", r"^pub const MAX_MESSAGE: usize = (\d+);", r"`MAX_MESSAGE` = (\d+) bytes"),
        "mailbox SLOTS": ("src/ipc/mailbox.rs", r"^pub const SLOTS: usize = (\d+);", r"and (\d+) queue slots"),
        "MAX_MUTEXES": ("src/sched/mod.rs", r"^pub const MAX_MUTEXES: usize = (\d+);", r"`MAX_MUTEXES` = (?:`MAX_SEMAPHORES` = )?(\d+)"),
        "MAX_SEMAPHORES": ("src/sched/mod.rs", r"^pub const MAX_SEMAPHORES: usize = (\d+);", r"`MAX_SEMAPHORES` = (\d+)"),
        "MAX_UART_TRANSFER": ("src/syscall.rs", r"^pub const MAX_UART_TRANSFER: usize = (\d+);", r"`MAX_UART_TRANSFER` = (\d+)"),
        "store KEYS": ("crates/maataa-store/src/lib.rs", r"^pub const KEYS: usize = (\d+);", r"store `KEYS` = (\d+)"),
        "store MAX_VALUE": ("crates/maataa-store/src/lib.rs", r"^pub const MAX_VALUE: usize = (\d+);", r"`MAX_VALUE` = (\d+) bytes"),
        "FIRST_TASK_KEY": ("src/storage/persist.rs", r"^pub const FIRST_TASK_KEY: u8 = (\d+);", r"`FIRST_TASK_KEY` = (\d+)"),
    }
    flat = " ".join(doc.split())  # the limits paragraph wraps
    for what, (rel, src_pattern, doc_pattern) in limits.items():
        in_src = one(src_pattern, read(rel), rel, what)
        in_doc = one(doc_pattern, flat, where, f"the {what} limit")
        if in_src is not None and in_doc is not None and in_src != in_doc:
            problem(where, f"{what} is {in_doc}, {rel} says {in_src}")


# 4. Sizes -------------------------------------------------------------------

SIZE_ROW = re.compile(r"^\| (F411 release|F411 debug|QEMU release|QEMU debug) \| ([\d,]+) \| ([\d.]+)%[^|]*\| ([\d,]+) \|$")


def check_sizes(measured_file):
    where = "docs/size.md"
    script = read("scripts/sizecheck.sh")
    limit = one(r"^MAX_SIZE=(\d+)$", script, "scripts/sizecheck.sh", "MAX_SIZE")
    warn = one(r"^WARN_SIZE=\$\(\(MAX_SIZE \* (\d+) / 100\)\)$", script, "scripts/sizecheck.sh", "WARN_SIZE")
    if limit is None or warn is None:
        return
    limit = int(limit)
    doc = read(where)
    if f"{limit // 1024} KiB" not in doc:
        problem(where, f"does not state the {limit // 1024} KiB limit of scripts/sizecheck.sh")
    if not re.search(rf"warns above {warn}%", " ".join(doc.split())):
        problem(where, f"does not say it warns above {warn}% (scripts/sizecheck.sh)")

    # The first table after "## Where it stands" is the current one.
    section = doc.split("## Where it stands", 1)
    if len(section) != 2:
        problem(where, 'no "## Where it stands" section')
        return
    table = {}
    for line in section[1].splitlines():
        m = SIZE_ROW.match(line)
        if m:
            table[m.group(1)] = int(m.group(2).replace(",", ""))
            used, pct, free = table[m.group(1)], float(m.group(3)), int(m.group(4).replace(",", ""))
            if free != limit - used:
                problem(where, f"{m.group(1)}: {free:,} free, but {limit:,} - {used:,} = {limit - used:,}")
            if abs(pct - used * 100 / limit) > 0.06:
                problem(where, f"{m.group(1)}: {pct}%, but {used:,} bytes is {used * 100 / limit:.1f}%")
        elif table and not line.startswith("|"):
            break
    if len(table) != 4:
        problem(where, f"the current table has {len(table)} of the 4 builds")

    if measured_file is None:
        return
    text = Path(measured_file).read_text(encoding="utf-8")
    seen = 0
    for name, used in re.findall(r"^(?:\w+\s+)?(F411 release|F411 debug|QEMU release|QEMU debug)\s+(\d+) bytes", text, re.M):
        seen += 1
        if name in table and abs(int(used) - table[name]) > SIZE_SLACK:
            problem(where, f"{name} is {int(used):,} bytes now, the table says {table[name]:,}; update the table")
    if seen == 0:
        problem(measured_file, "no size lines from scripts/sizecheck.sh")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sizes", help="output of scripts/sizecheck.sh to compare with docs/size.md")
    args = parser.parse_args()
    check_version()
    check_smoke()
    check_ci()
    check_abi()
    check_sizes(args.sizes)
    for line in problems:
        print(f"DRIFT: {line}")
    if problems:
        print(f"FAIL: check-docs ({len(problems)} mismatches)")
        return 1
    print("PASS: check-docs (version, smoke checks, CI lint sets, SVC ABI, sizes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
