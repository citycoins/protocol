#!/bin/bash
# Equivalent to the missing rv:ccd015 package script; no sibling checkout needed.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
seed="${1:-20261105}"; runs="${2:-1000}"
python3 "$here/build-book.py"
mkdir -p "$here/results"
cd "$here/.build-book"
npx rv . ccd015-redemption-book-mia-stx invariant --runs="$runs" --seed="$seed" --bail > "$here/results/book-$seed.log" 2>&1
python3 "$here/summarize.py" "$here/results/book-$seed.log" "$here/.build-book/source-hashes.json" "$here/results/book-$seed"
