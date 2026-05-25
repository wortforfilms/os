#!/bin/bash
set -e

echo "Maataa OS alpha smoke test"
echo "=========================="

echo ""
echo "1/5 cargo check"
cargo check

echo ""
echo "2/5 host unit tests"
./scripts/test-host.sh

echo ""
echo "3/5 release build"
cargo build --release

echo ""
echo "4/5 size check"
./scripts/sizecheck.sh

echo ""
echo "5/5 QEMU boot"
./scripts/run.sh

echo ""
echo "Alpha smoke test passed"
