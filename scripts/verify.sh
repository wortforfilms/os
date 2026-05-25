#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_DIR="${ROOT_DIR}/migrations/sqlite"

export LC_ALL=C
export LANG=C

section() {
  printf '\n== %s ==\n' "$1"
}

require_file() {
  test -f "$1" || {
    echo "missing required file: $1" >&2
    exit 1
  }
}

assert_no_assets_html_tracking() {
  if git -C "${ROOT_DIR}" ls-files -- 'assets/html/**' | grep -q .; then
    echo "assets/html is tracked; local-only boundary violated" >&2
    exit 1
  fi
}

verify_sqlite_migrations() {
  require_file "${MIGRATION_DIR}/003_data_frames.sql"
  require_file "${MIGRATION_DIR}/004_hsts.sql"
  require_file "${MIGRATION_DIR}/005_evidence.sql"
  require_file "${MIGRATION_DIR}/006_certification.sql"

  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 ':memory:' ".read ${MIGRATION_DIR}/003_data_frames.sql" \
      ".read ${MIGRATION_DIR}/004_hsts.sql" \
      ".read ${MIGRATION_DIR}/005_evidence.sql" \
      ".read ${MIGRATION_DIR}/006_certification.sql" \
      "SELECT 'sqlite-migrations-ok';" >/dev/null
  else
    grep -q "CREATE TABLE IF NOT EXISTS monorepo_stack_registry" "${MIGRATION_DIR}/003_data_frames.sql"
    grep -q "CREATE TABLE IF NOT EXISTS hsts_state_words" "${MIGRATION_DIR}/004_hsts.sql"
    grep -q "CREATE TABLE IF NOT EXISTS evidence_bundles" "${MIGRATION_DIR}/005_evidence.sql"
    grep -q "CREATE TABLE IF NOT EXISTS certification_gates" "${MIGRATION_DIR}/006_certification.sql"
    echo "sqlite3 unavailable; migration table signatures verified by text scan"
  fi
}

cd "${ROOT_DIR}"

section "PHKD local-only boundary"
assert_no_assets_html_tracking
echo "assets/html remains untracked"

section "Hemant monotonic core"
cargo test -p hemant-core

section "Universal runtime type matrix"
npx tsc -p packages/universal-runtime/tsconfig.json --noEmit

section "Maataa UI type matrix"
npm run typecheck:maataa-ui

section "Web production bundle"
npm run build:web

section "Database migration synchronization"
verify_sqlite_migrations

section "Verification replay complete"
echo "SYSTEM_STATE_WORD=0x001B004F"
echo "VERDICT=SCIENTIFIC_CERTIFIED"
