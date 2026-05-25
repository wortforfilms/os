#!/bin/bash
set -e

required_paths=(
  "apps/manifest.ts"
  "apps/maataa/index.tsx"
  "apps/tlp/index.tsx"
  "apps/system/index.tsx"
  "assets/runtime/init"
  "core/node-bridge/index.js"
  "core/python-ml/maataa_ml/registry.py"
  "offline-models/model-manifest.json"
  "resources/resource-manifest.json"
  "docs/SCAFFOLD.md"
)

for path in "${required_paths[@]}"; do
  test -e "${path}" || {
    echo "missing scaffold path: ${path}" >&2
    exit 1
  }
done

echo "Scaffold check passed (${#required_paths[@]} paths)"
