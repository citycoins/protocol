#!/bin/bash
# RV ccd016-final runner: bash tests/rv/ccd016-final/run.sh <invariant|test> <seed> [runs]
# Builds, runs Rendezvous on the generated project, keeps the full log in
# $RV_LOG_DIR (default .build/logs, gitignored) and writes the statistics
# block (+ dialer tallies for invariant runs) to results/<mode>-<seed>.txt.
# RV_NO_BUILD=1 reuses .build (needed when several seeds run in parallel).
set -eu
mode="$1"; seed="$2"; runs="${3:-1000}"
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
cd "$root"
[ -n "${RV_NO_BUILD:-}" ] || python3 "$here/build.py" >/dev/null
logdir="${RV_LOG_DIR:-$here/.build/logs}"; mkdir -p "$logdir" "$here/results"
log="$logdir/$mode-$seed.log"; stats="$here/results/$mode-$seed.stats.json"
dial=(); [ "$mode" = invariant ] && dial=(--dial="$here/stats-dialer.cjs")
set +e
RV_STATS="$stats" npx rv "$here/.build" ccd016-swap-vault-mia-v2 "$mode" --runs="$runs" --seed="$seed" "${dial[@]}" > "$log" 2>&1
code=$?
set -e
clean="$(sed 's/\x1b\[[0-9;]*m//g' "$log")"
{
  echo "rv $mode seed=$seed runs=$runs exit=$code vault-sha256=$(python3 -c "import json;print(json.load(open('$here/.build/source-hashes.json'))['ccd016-swap-vault-mia-v2'])")"
  echo "runtime errors logged: $(grep -c '(runtime)' <<<"$clean" || true)"
  echo "$clean" | grep -E '^(OK,|Error:|Counterexample)' | head -5
  echo "$clean" | sed -n '/EXECUTION STATISTICS/,/LEGEND/p'
} > "$here/results/$mode-$seed.txt"
echo "$mode seed=$seed exit=$code -> results/$mode-$seed.txt"
exit $code
