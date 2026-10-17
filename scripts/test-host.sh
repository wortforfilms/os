#!/bin/bash
set -e

HOST_TARGET=$(rustc -vV | awk '/host:/ { print $2 }')

echo "Running host unit tests on ${HOST_TARGET}"
cargo test --lib --target "${HOST_TARGET}"
