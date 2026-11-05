# Rendezvous property testing

## Final vault harness: `tests/rv/ccd016-final/` (2026-10-14)

Target: `contracts/extensions/ccd016-swap-vault-mia-v2.clar` as of commit
8bfbb5f (Super Orb fix: the vault pays every Lazer verify), unchanged from
8bfbb5f to HEAD. There is no v3 contract on this branch;
`simulations/stxer-ccd016-v3-keyless.js` is an untracked file from another
session. `build.py` refuses to build if the source sha256 is not
`e3437fcf...1720` (the 8bfbb5f bytes; `--any-source` overrides).

```bash
npm run rv:final:invariant -- 20261014        # build + 1000 invariant runs, seed 20261014
npm run rv:final:test -- 20261014             # build + 1000 property runs
RV_NO_BUILD=1 bash tests/rv/ccd016-final/run.sh invariant <seed> [runs]   # reuse .build (parallel seeds)
```

`run.sh` writes the RV statistics block to `results/<mode>-<seed>.txt` and,
for invariant runs, the dialer tallies (`stats-dialer.cjs`: vault print
notifications, sales with `out > 0`, STX into the book, sBTC out of the vault)
to `results/<mode>-<seed>.stats.json`. The full log stays in `.build/logs`
(gitignored) or `$RV_LOG_DIR`.

### What the build does (test-only, generated copies only)

Production `contracts/*.clar`, `Clarinet.toml`, `deployments/` and
`tests/vault/fixtures/` are only read. `build.py` writes
`tests/rv/ccd016-final/.build/` (gitignored) with:

- The address rewrites of `tests/vault/build.py` (Jing v6-3 market, router
  v5-3, sBTC/wSTX, DIA, RFQ native, base-dao, treasury, MIA) and the same v6-3
  compatibility shims on the fixture market (pending-escrow getter,
  update-less `deposit-token-x` / `set-token-x-limit`).
- Vault rewrite 1: `is-dao-or-extension` becomes
  `(or (is-eq tx-sender deployer) (var-get rv-dao))`. `rv-dao` is a harness
  flag that only the `rv-dao-*` wrappers and `test-*` functions raise and drop
  in the same call (`invariant-dao-flag-down`). DAO authentication itself is
  not under test here (runtime suite and forks cover it).
- Vault rewrite 2: the `window-blocks` default 288 -> 400 burn blocks, so a
  window survives a few RV runs (RV mines <= 100 burn blocks per run at 1000
  runs); `rv-dao-config` moves it to 0-40 or 60-300.
- `harness.clar` appended (ghosts, wrappers, invariants, properties).
- Three fixtures overridden by `mocks/`:
  - `mock-router`: ADVERSARIAL. Fills `fill-bps` of the amount at
    `quality-bps` of the Lazer mid, ignores the limit price and per-leg mins,
    honours only the overall `min-stx-out` (u3002). `router-swap` passes
    min-out u0, so the vault's own post-trade check is the only floor guard on
    that path. With an update it verifies once (the real book leg verifies in
    the market), charging the Lazer fee to tx-sender.
  - `mock-lazer-oracle`: the fixture feeds plus a verify fee in STX charged to
    tx-sender for a non-empty update, with ghost totals split vault / other.
  - `mock-ft`: strict ledger plus a ghost that classifies every transfer whose
    sender is the vault by recipient (treasury / market / router / bad).

### Invariants (16; transition checks run in the private `update-context`)

RV 1.0.3 calls `update-context` after every successful public call. The
harness compares the snapshot taken after the previous successful call with
the state now and counts violations per category; the counters persist across
runs, so every check covers the whole history of the sweep.

| invariant | what |
|---|---|
| never-below-floor | router-swap: proceeds >= floor-out(sold - 8, mid*(1-slippage)); split: >= floor-out(sold, min(slippage floor, Velar 0.6% floor)); split-dia: >= floor-out(sold, DIA/native emergency limit); jing-take: >= floor of sold net of 10 bps fee + 20 bps rebate; any other sale (maker fill of the peg): >= the order's floor net of 10 bps |
| no-sale-in-patience | no vault-initiated sale (router-swap*, jing-take) unless the window had elapsed |
| stx-only-to-book-or-fee | no proceeds without a sale, none on a recall, the vault's STX never drops except to the book or the oracle fee |
| only-vault-pays-fee | inside a vault entry the caller never pays the Lazer fee; the vault pays only in its own entries, at most 2 x budget per call |
| fuel-keeps-budget | fuel-fair-book sends balance - min(balance, budget) and keeps min(balance, budget); the book receives through nothing else ("finish returns balance - min(balance, budget)") |
| clock-transitions | the clock is set only by funding, at the current height, only from empty / no clock / elapsed-with-dust (<= 8 sats); cleared only on an empty vault by an exit or close-batch; an exit that empties the vault clears it |
| treasury-flows | the treasury gets sBTC back only by a recall, exactly what left the vault; it loses sBTC only to funding |
| sbtc-destinations | every sBTC transfer out of the vault goes to the treasury, the market or the router |
| sbtc-conservation | FT supply = vault + treasury + market + router + the 10 wallets |
| stx-conservation | STX over vault, book, oracle, router, market and the 10 wallets is constant |
| window-exclusive, no-clock-no-window, clock-not-future, config-bounded, resting-peg, dao-flag-down | static state checks (open and elapsed never both; caps; a resting position is a zero-spread peg with a positive floor) |

### Properties (10 private `test-*`)

test-router-swap-floor (exact sale or a genuine sub-floor refusal),
test-split-floor, test-split-dia-floor (emergency limit formula, no sale
without a price), test-jing-take-floor, test-place-peg (whole balance rests,
floor = ask-of(mid), spread 0), test-recall, test-fund-clock (opens only from
empty / no clock / elapsed dust), test-fee-payer (caller pays nothing, vault
pays 2 x fee, fee over budget fails and moves nothing), test-fuel-fair-book,
test-patience-no-sale (every take / router / reclaim path is u16031 while
open). A run is discarded in place (`(ok false)`) only when the action could
not be exercised (nothing to sell, market refused).

### Results

Rendezvous 1.0.3, Clarinet SDK from this repo, 1000 runs per suite per seed,
two seeds. **No invariant or property falsified, zero runtime errors logged,
no counterexample.** Files: `ccd016-final/results/`.

| suite | seed | result | real movement (successful calls / committed sales with out > 0) |
|---|---|---|---|
| invariant | 20261014 | 1000/1000 passed, 16 invariants (52-77 checks each) | sales: router-swap 19, split 19, split-dia 24, jing-take 8; maker fills (rv-cross-vault) 4; jing-place 20, jing-refloor 14, fund 130 (71 direct), fuel 92, recall 110, reclaim with refund 18; 126,169 STX to the book, 10.9e9 sats out of the vault |
| invariant | 20261015 | 1000/1000 passed | sales: router-swap 30, split 8, split-dia 17, jing-take 8; maker fills 23 (rv-cross-vault 22, rv-settle-vault 1); jing-place 56, jing-refloor 37, fund 140, fuel 83, recall 121, reclaim with refund 49; 148,289 STX to the book |
| property | 20261014 | 1000/1000 passed (11 discarded: jing-take had no fill) | router-swap 119, split 31, split-dia 62, jing-take 94, jing-place 105, fuel 109, recall 263, windows opened 227 |
| property | 20261015 | 1000/1000 passed (9 discarded: same) | router-swap 119, split 37, split-dia 51, jing-take 80, jing-place 85, fuel 100, recall 257, windows opened 225 |

Sensitivity check (scratch copies of the generated build, not committed):
deleting router-swap's post-trade floor assert makes
`invariant-never-below-floor` fail after 53 runs (seed 11); restoring the
pre-8bfbb5f fee path (`vault-mid` calls `current-mid` outside its
`as-contract?` scope, so the caller pays the Lazer verify) makes
`test-fee-payer` fail (u801) and `invariant-only-vault-pays-fee` fail after
42 runs (seed 12).

Gaps: the router and the market are fixtures (the adversarial router models
only the overall min-out guarantee; per-AMM legs and the real Jing v6-3
market run on the stxer forks). The fixture market predates v6-3 (adapters
as in `tests/vault/build.py`; pending escrow is never populated, so the
settle-escrow path is not fuzzed). STX destinations are checked by
conservation plus exact book / fee accounting: an STX outflow from the vault
to a wallet hidden inside a sale with matching inflow would not be
attributed. RV naturals are folded through `rv-r`, not drawn over full
uint128. DAO authentication is stubbed (see rewrite 1).

## Earlier vault verification (2026-09-18)

Vault verification of 2026-09-18 uses the self-contained
[full-source vault harness](../vault/README.md), replacing the older vault build
below. Run `npm run rv:ccd016 -- --seed=20260918 --bail` or build with
`npm run rv:vault:build` and run `npm run rv:vault -- --seed=20260918 --bail`.
`rv:build` builds the old book target and the new vault target. The vault no longer
needs a sibling Jing checkout. Rendezvous is now 1.0.3; its `update-context`
callback is private. The old root vault-only manifest is historical.

## Historical results and harness (2026-09-15)

### Previous Solution 2 harness

`@stacks/rendezvous@1.0.0-rc.1` harness for the STX book
(`ccd015-redemption-book-mia-stx`) and the keeperless vault
(`ccd016-swap-vault-mia-v2`). Same shape as jing-contracts-v3's
`tests/rv`: production source, a few fuzz rewrites, an invariants block
appended, one RV-only manifest per target at the repo root.

## Status (2026-09-15, zero falsified invariants)

| target | runs | invariants (checks) | real movement (successful calls) |
|---|---|---|---|
| ccd015-redemption-book-mia-stx | 500 | 7 (500) | place-offer x74 + rv-place x117, change-offer x16, cancel-offer x22, cross-book x89, update-par x29, set-min-deposit x30, set-paused x22, rv-fund x245 |
| ccd016-swap-vault-mia-v2 | 500 | 6 (500) | fund-from-treasury x60, dao-recall-sbtc x13, fuel-fair-book x7, router-swap x8, jing-place x1, dao-reclaim x1, setters x1-6, rv-bid x87, rv-cancel-bid x39, DIA skew / stale x109 / x103. Thin on the vault's own book paths (jing-place, take, reclaim, refloor): the 20-block window elapses inside most runs (one block per call) and DIA / staleness switches persist across RV's shared simnet; the fork harnesses (`simulations/stxer-ccd016-v2-*.js`) cover those paths end to end |

## Build

`tests/rv/build.sh` rewrites, for both: the DAO gate (`is-dao-or-extension`)
to the deployer account, one RV sender in ten, and drops the extension
trait line (no requirements are fetched for these manifests).

For the book: MIA v2 (transfer, burn, supply) and v1 (supply) become
`mock-mia` (real ledger under the name `miamicoin`, auto-mint for RV's
random sellers, burn counted) and `mock-mia-v1`; the par formula's two STX
accounts (mining treasury, pox5 stake) become two funded simnet wallets;
the minimum deposit is 1000 micro-MIA (100k MIA is above every natural RV
draws). Wrappers: `rv-fund` (STX in, the vault's push, counted),
`rv-place` (an offer sized over the minimum), `rv-reset-min` (a random
DAO `set-min-deposit` up to 2^31 would otherwise refuse every later offer
for the rest of the sweep).

For the vault: the jing v6 fuzz stack is copied in from
`../jing-contracts-v3/tests/rv` (set `JING_RV` otherwise): the market's
fuzz build with settle live through the mock Lazer oracle, the mock
ladder, the v5 mock core, one `mock-ft` for sBTC and wstx. The rewards
treasury is `mock-treasury` (withdraw-ft, no gate), the router is
`mock-router` (one venue that buys at the mid with the STX it holds, or
reports everything unsold; u3002 on min-out), DIA is `mock-dia` (echoes
the Lazer mid times a skew, staleness switchable), the STX destination is
the book's fuzz build, the window is 20 burn blocks. Wrappers: sBTC into
the treasury and by plain transfer, STX into the router, bids resting on
the market and cancelling, settlements, the mid, the mid onto the vault's
floor, DIA skew (85..115%, the band is 10%) and staleness (one call in
eight).

## Invariants

Book, 7: sorted ascending by price (cross-multiplied), MIA conservation
(book balance = sum of the amounts on the book), STX conservation (balance
= funded minus spent), burned equals what the token burned, one offer per
owner, bounded, every entry positive and inside the per-offer caps.

Vault, 6: open and elapsed never both, no clock means neither, every dial
inside its cap and the window never zero, the cooldown stamp never in the
future, whatever rests on the book is a zero-spread peg with a guard, a
clock is never in the future. The vault keeps no ledger of its own
(balance-driven by design); the market's 25 invariants cover the funds
while they sit on the book (fuzzed in the jing repo).

## Run

```bash
npm i -D @stacks/rendezvous@1.0.0-rc.1      # once
npm run rv:build                            # both targets (needs the jing repo next door)
npm run rv:ccd015
npm run rv:ccd016
npx rv . ccd015-redemption-book-mia-stx invariant --seed=<n>   # replay
```

Runtime panics only log in RV (`(runtime)` in the call log); a false
invariant is the finding. `.build/` and `.rendezvous-regressions/` are
gitignored.
