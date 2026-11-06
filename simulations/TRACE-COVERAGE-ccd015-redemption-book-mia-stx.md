# Trace coverage: ccd015-redemption-book-mia-stx

From `simulations/trace-coverage.mjs` on 2026-11-06, source at `contracts/extensions/ccd015-redemption-book-mia-stx.clar` at commit 37af4b4: 4 simulations, 211 transactions (12 without a trace), every evaluated expression read from the stxer debug traces. Counted by source: only deployments whose code has sha256 `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f` (the current file).

| metric | value |
|---|---|
| expressions executed / total | 312 / 433 (72.1%) |
| code lines touched / total | 167 / 216 (77.3%) |
| function-body lines touched / total (top-level definitions excluded) | 167 / 185 (90.3%) |
| branch nodes: full / partial / never reached | 50: 29 / 20 / 1 |

Branch nodes are `if` and `match` (two arms) and every guard: `asserts!`, `try!`, `unwrap!`, `unwrap-err!`, `unwrap-panic` (arms = pass and fail). A guard's fail arm counts only when the guard itself produced the error, not when an error from an argument passed through it. Expression totals exclude syntactic lists the evaluator never records (tuple key/value pairs, `let` binding lists, `as-contract?` allowance lists); their atoms count with the enclosing call. These rules are stricter than the Jing copy of the tool (which counted a reached `asserts!` as full), so the numbers are not comparable with the historical report.

## Uncovered branch arms (21)

Fork column: **yes** = a reasonable new stxer scenario on the live fork reaches it; **fixture** = needs a patched contract (`setContractCode`); **no** = unreachable with the live dependencies.

| line | function | kind | arm never taken | reason | fork |
|---|---|---|---|---|---|
| 151 | update-par | unwrap! | fail | calculate-par returns none only with zero supply or an empty mining treasury | yes |
| 153 | update-par | asserts! | fail | snapshot = treasury * 1e8 / supply is 0 only with a dust treasury | yes |
| 179 | place-offer | try! | fail | place-offer with more MIA than the seller holds not exercised | yes |
| 182 | place-offer | unwrap-panic | fail | element-at? on a full book (len = MAX_OFFERS > 0) is always some | no |
| 187 | place-offer | try! | fail | refund of the evicted offer: the book always holds that escrow | no |
| 219 | change-offer | asserts! | fail | ERR_BELOW_MIN_DEPOSIT in change-offer needs min-deposit raised after the offer was placed | yes |
| 223 | change-offer | try! | fail | change-offer adding more MIA than the seller holds not exercised | yes |
| 226 | change-offer | if | else | change-offer always re-inserted the offer; never appended at the end (only offer, or the worst price) | yes |
| 239 | cancel-offer | try! | fail | cancel refund: the book always holds the offer's escrow | no |
| 239 | cancel-offer | unwrap-panic | fail | element-at? mine u0 after (> (len mine) u0) is always some | no |
| 265 | cross-book | try! | fail | with-stx budget backstop: settle-step pays at most `remaining` | no |
| 278 | cross-book | try! | fail | with-ft allowance = acquired, burn moves exactly acquired | no |
| 279 | cross-book | try! | fail | burn of MIA the book holds cannot fail | no |
| 338 | calculate-par | if | then | calculate-par's none arm (zero supply or empty treasury) | yes |
| 372 | get-mia-total-supply | unwrap-panic | fail | MIA v1 get-total-supply always returns ok | no |
| 374 | get-mia-total-supply | unwrap-panic | fail | MIA v2 get-total-supply always returns ok | no |
| 399 | push-rec | unwrap-panic | fail | the book is capped at MAX_OFFERS <= 50 before every append | no |
| 411 | find-owner-step | if | both (node never reached) | find-owner-step only runs from get-offer, a read-only never called inside a traced tx | yes |
| 426 | refund-rec | try! | fail | refund of MIA the book holds cannot fail | no |
| 481 | settle-step | unwrap-panic | fail | STX payout inside the with-stx budget, to a non-contract owner, cannot fail | no |
| 492 | settle-step | unwrap-panic | fail | partial-fill STX payout, same as above | no |

## Uncovered function-body lines (18)

| function | lines | reason |
|---|---|---|
| callback | 125 | public no-op `(ok true)`; nothing calls it |
| get-par-ustx | 308 | read-only, not called inside any traced tx |
| get-par-ustx-per-1m-mia | 313 | read-only, not called inside any traced tx |
| get-offer | 325 | read-only, not called inside any traced tx |
| get-book-totals | 328 | read-only, not called inside any traced tx |
| get-info | 380, 381, 382, 383, 384, 385, 387, 388, 389 | read-only, not called inside any traced tx |
| find-owner-step | 411, 412, 413 | only called from get-offer (read-only, untraced) |
| sum-step | 421 | only called from get-book-totals (read-only, untraced) |

**Top-level definitions** (31 lines: 47, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 73, 78, 83, 85, 94, 98, 99, 102, 104, 105, 106, 108, 110, 111): Constants, error codes, data vars and trait lines execute only at deploy (no trace).

## What a new fork scenario could still reach

- **Par cannot be computed** (L151, L153, L338 then-arm): a sim-dao-proxy withdraws the MIA mining treasury's STX (all of it for L151/L338, all but dust for L153), then `update-par`.
- **Seller lacks the MIA** (L179, L223): `place-offer` / `change-offer` with an amount above the seller's balance.
- **Min deposit raised under an offer** (L219): place at the 100,000 MIA min, sim-dao-proxy `set-min-deposit` higher, `change-offer none <ask>`.
- **Offer re-appended** (L226 else-arm): `change-offer` on the only offer in the book, or to an ask worse than every other offer.
- **get-offer and the other read-onlys** (L411 and the uncovered body lines): call them inside a tx (a sim-only wrapper contract), since stxer traces transactions, not read-only evaluations. Pure reporting code, low value.

## Unreachable with the live dependencies

Unwraps on SIP-010 `get-total-supply` (L372, L374), escrow refunds and burns of MIA the book holds (L187, L239 try!, L279, L426), exact-amount / budget allowances (L265, L278), STX payouts inside the budget (L481, L492), `element-at?` after a length check (L182, L239 unwrap-panic) and the 50-cap append (L399).

## Per simulation (cumulative executed expressions of ccd015-redemption-book-mia-stx)

| sim | txs | before | after |
|---|---|---|---|
| `7b6d5d12` | 6 | 0 | 67 |
| `c867b81a` | 80 | 67 | 526 |
| `010ec971` | 110 | 526 | 553 |
| `d45fb46d` | 15 | 553 | 554 |

## Provenance and trace diagnostics

source contracts/extensions/ccd015-redemption-book-mia-stx.clar at 37af4b4, sha256 `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`. Only deployments with that exact code are counted.

| item | count |
|---|---|
| transactions | 211 |
| no trace returned by stxer | 12 |
| trace decode errors | 0 |
| calls to a counted instance | 102 |
| ... of which without a trace | 0 |
| ... of which decode errors | 0 |

| sim | counted instances |
|---|---|
| `7b6d5d12` | ccd015-redemption-book-mia-stx |
| `c867b81a` | ccd015-redemption-book-mia-stx |
| `010ec971` | ccd015-redemption-book-mia-stx |
| `d45fb46d` | ccd015-redemption-book-mia-stx |

| excluded deployment (name@hash) | sims |
|---|---|
| ccd016-swap-vault-mia-v2@ac0c305f8bfc | 1 |
| ccip028-activate-mia-fair-redemption@8826bc5d6abe | 1 |
| sim-ccd015-update-par@1c5bb282b8ff | 1 |
| sim-p-min-100k@41548ba2174e | 1 |
| sim-p-min-200k@7cd2a98aedfc | 1 |
| sim-p-min-zero@46f422a84e3d | 1 |
| sim-p-par1@1c5bb282b8ff | 2 |
| sim-p-par2@1c5bb282b8ff | 1 |
| sim-p-pause@ab043a9c2a12 | 1 |
| sim-p-unpause@9a9084e8e297 | 1 |
| sim-p-withdraw-par3@39883a96e862 | 1 |
| sim-stx-send@312add0774bb | 2 |
