# Trace coverage: ccip028-activate-mia-fair-redemption

From `simulations/trace-coverage.mjs` on 2026-11-06, source at `contracts/proposals/ccip028-activate-mia-fair-redemption.clar` at commit 37af4b4: 1 simulations, 15 transactions (0 without a trace), every evaluated expression read from the stxer debug traces. Counted by source: only deployments whose code has sha256 `8826bc5d6abe38b7509a6693c1157b3479ecd357c646dddae733d2369dff6130` (the current file).

| metric | value |
|---|---|
| expressions executed / total | 39 / 46 (84.8%) |
| code lines touched / total | 23 / 27 (85.2%) |
| function-body lines touched / total (top-level definitions excluded) | 23 / 23 (100.0%) |
| branch nodes: full / partial / never reached | 16: 0 / 16 / 0 |

Branch nodes are `if` and `match` (two arms) and every guard: `asserts!`, `try!`, `unwrap!`, `unwrap-err!`, `unwrap-panic` (arms = pass and fail). A guard's fail arm counts only when the guard itself produced the error, not when an error from an argument passed through it. Expression totals exclude syntactic lists the evaluator never records (tuple key/value pairs, `let` binding lists, `as-contract?` allowance lists); their atoms count with the enclosing call. These rules are stricter than the Jing copy of the tool (which counted a reached `asserts!` as full), so the numbers are not comparable with the historical report.

## Uncovered branch arms (16)

Fork column: **yes** = a reasonable new stxer scenario on the live fork reaches it; **fixture** = needs a patched contract (`setContractCode`); **no** = unreachable with the live dependencies.

| line | function | kind | arm never taken | reason | fork |
|---|---|---|---|---|---|
| 15 | execute | asserts! | fail | ERR_UNAUTHORIZED: execute never called directly (not via base-dao) | yes |
| 16 | execute | asserts! | fail | ERR_BOOK_ALREADY_INITIALIZED: par already set before execution not exercised | yes |
| 22 | execute | try! | fail | base-dao set-extension: the DAO is the caller, cannot fail | no |
| 24 | execute | try! | fail | treasury set-allowed called by the DAO cannot fail | no |
| 29 | execute | try! | fail | set-window-blocks u288: in range, DAO authorized | no |
| 30 | execute | try! | fail | set-leeway-bps u1000: in range | no |
| 31 | execute | try! | fail | set-slippage-bps u100: in range | no |
| 32 | execute | try! | fail | set-max-chunk-sats u1000000: in range | no |
| 33 | execute | try! | fail | set-maker-spread-bps u1: in range | no |
| 34 | execute | try! | fail | set-dia-band-bps u1000: in range | no |
| 35 | execute | try! | fail | set-router-cooldown u1: in range | no |
| 36 | execute | try! | fail | set-no-pyth-slippage-bps u1000: in range | no |
| 37 | execute | try! | fail | set-pyth-fee-budget u0: in range | no |
| 41 | execute | try! | fail | set-min-deposit u100000000000: > 0 | no |
| 42 | execute | try! | fail | update-par fails only with an empty/dust mining treasury (ERR_PAR_CALCULATION) | yes |
| 43 | execute | try! | fail | set-paused false by the DAO cannot fail | no |

## Uncovered function-body lines (0)

None.

**Top-level definitions** (4 lines: 5, 7, 8, 9): The DAO constant, the two error constants and impl-trait execute only at deploy.

## What a new fork scenario could still reach

- **Direct call** (L15): any wallet calls `execute` directly; expect `ERR_UNAUTHORIZED` (u28000).
- **Par already set** (L16): a sim-dao-proxy proposal enables ccd015 as an extension and runs `update-par` first, then ccip028 executes; expect `ERR_BOOK_ALREADY_INITIALIZED` (u28001).
- **update-par fails inside execute** (L42): drain the mining treasury via a sim-dao-proxy before execution; expect ccd015's ERR_PAR_CALCULATION and a full revert of the activation.

## Unreachable with the live dependencies

The base-dao and treasury calls (L22, L24) and every setter (L29-L37, L41, L43): the DAO is the caller and every literal is inside the setter's bounds, so none of them can fail.

## Per simulation (cumulative executed expressions of ccip028-activate-mia-fair-redemption)

| sim | txs | before | after |
|---|---|---|---|
| `d45fb46d` | 15 | 0 | 64 |

## Provenance and trace diagnostics

source contracts/proposals/ccip028-activate-mia-fair-redemption.clar at 37af4b4, sha256 `8826bc5d6abe38b7509a6693c1157b3479ecd357c646dddae733d2369dff6130`. Only deployments with that exact code are counted.

| item | count |
|---|---|
| transactions | 15 |
| no trace returned by stxer | 0 |
| trace decode errors | 0 |
| calls to a counted instance | 1 |
| ... of which without a trace | 0 |
| ... of which decode errors | 0 |

| sim | counted instances |
|---|---|
| `d45fb46d` | ccip028-activate-mia-fair-redemption |

| excluded deployment (name@hash) | sims |
|---|---|
| ccd015-redemption-book-mia-stx@b3526d4ce89e | 1 |
| ccd016-swap-vault-mia-v2@ac0c305f8bfc | 1 |
