#!/bin/bash
# Build augmented .clar files for Rendezvous fuzzing of the Solution 2 pair:
# ccd015-redemption-book-mia-stx (the STX book) and ccd016-swap-vault-mia-v2
# (the one-way vault on markets v6). Same shape as jing-contracts-v3's
# tests/rv/build.sh: production source, a few fuzz rewrites (mainnet literals
# to local mocks, the DAO gate to the deployer account, defaults RV's small
# naturals can reach), the invariants block appended. Output goes to
# tests/rv/.build/ (gitignored).
#
# The vault target needs the jing v6 fuzz stack (the market's fuzz build, the
# mock Lazer oracle, ladder, core and token): those are built by the jing
# repo's script and copied in. JING_RV points at that repo's tests/rv.
#
# Usage: bash tests/rv/build.sh [ccd015-redemption-book-mia-stx | ccd016-swap-vault-mia-v2 | all]
set -eu

JING_RV="${JING_RV:-../jing-contracts-v3/tests/rv}"
OUT=tests/rv/.build
mkdir -p "$OUT"

declare -A SUTS=(
  ["ccd015-redemption-book-mia-stx"]="contracts/extensions/ccd015-redemption-book-mia-stx.clar"
  ["ccd016-swap-vault-mia-v2"]="contracts/extensions/ccd016-swap-vault-mia-v2.clar"
)

copy_jing_stack() {
  if [ ! -d "$JING_RV" ]; then
    echo "jing repo not found at $JING_RV (set JING_RV)" >&2
    exit 1
  fi
  (cd "$JING_RV/../.." && bash tests/rv/build.sh markets-sbtc-stx-jing-v6 >/dev/null)
  for f in sip-010-trait mock-ft mock-jing-core-v5 mock-lazer-oracle mock-jing-ladder; do
    cp "$JING_RV/$f.clar" "$OUT/$f.clar"
  done
  cp "$JING_RV/.build/markets-sbtc-stx-jing-v6.clar" "$OUT/v6-market.clar"
  echo "Copied the jing v6 fuzz stack into $OUT"
}

build_one() {
  local name="$1"
  local src="${SUTS[$name]:-}"
  local invariants="tests/rv/$name.invariants.clar"
  local out="$OUT/$name.clar"
  if [ -z "$src" ]; then
    echo "Unknown contract: $name (known: ${!SUTS[*]})" >&2
    exit 1
  fi
  python3 - "$src" "$invariants" "$out" <<'PYEOF'
import sys
src_path, inv_path, out_path = sys.argv[1:4]
text = open(src_path).read()

# The extension trait lives at the DAO's mainnet address; no requirements are
# fetched for the RV manifests, and nothing here calls through the trait.
text = text.replace(
    "(impl-trait 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait.extension-trait)",
    ";; (impl-trait extension-trait) dropped for the RV build")

# DAO gate -> the deployer account (one RV sender in ten). The real gate is
# base-dao's is-extension, exercised on the fork through a passed proposal.
text = text.replace(
    """(define-public (is-dao-or-extension)
  (ok (asserts! (or
    (is-eq tx-sender 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao)
    (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao
      is-extension contract-caller
    )) ERR_UNAUTHORIZED
  ))
)""",
    """(define-public (is-dao-or-extension)
  (ok (asserts! (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) ERR_UNAUTHORIZED))
)""")

if "ccd015-redemption-book-mia-stx" in src_path:
    # MIA v2 (transfer, burn, supply) and v1 (supply) -> mocks
    text = text.replace("'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2", ".mock-mia")
    text = text.replace("'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token", ".mock-mia-v1")
    # the STX backing behind par: two funded simnet accounts stand in for the
    # mining treasury and the pox5 stake (both principals only appear in
    # stx-account reads)
    text = text.replace(
        "'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3",
        "'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP")
    text = text.replace(
        "'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia",
        "'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6")
    # 100k MIA is above every natural RV draws; 1000 micro-MIA keeps the gate
    # live (set-min-deposit still moves it)
    text = text.replace(
        "(define-data-var min-deposit uint (* u100000 MICRO_CITYCOINS))",
        "(define-data-var min-deposit uint u1000)")

if "ccd016-swap-vault-mia-v2" in src_path:
    text = text.replace("'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token", ".mock-ft")
    text = text.replace('(define-constant ASSET_SBTC "sbtc-token")', '(define-constant ASSET_SBTC "mock-ft")')
    text = text.replace("'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2", ".mock-ft")
    text = text.replace('(define-constant ASSET_WSTX "wstx")', '(define-constant ASSET_WSTX "mock-ft")')
    text = text.replace("'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3", ".mock-treasury")
    text = text.replace("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6", ".v6-market")
    text = text.replace("'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5", ".mock-router")
    text = text.replace("'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle", ".mock-dia")
    # a two-day window never elapses inside a sweep; 20 burn blocks does
    text = text.replace("(define-data-var window-blocks uint u288)", "(define-data-var window-blocks uint u20)")

text += "\n\n" + open(inv_path).read()
open(out_path, "w").write(text)
PYEOF
  echo "Built $out ($(wc -l < "$out") lines)"
}

target="${1:-all}"
case "$target" in
  all)
    build_one ccd015-redemption-book-mia-stx
    python3 tests/vault/build.py --rv ;;
  ccd016-swap-vault-mia-v2)
    python3 tests/vault/build.py --rv ;;
  *)
    build_one "$target" ;;
esac
