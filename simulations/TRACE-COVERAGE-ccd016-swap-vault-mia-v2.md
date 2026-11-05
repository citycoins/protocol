# Historical trace coverage: ccd016-swap-vault-mia-v2

**Superseded for current-source validation by the [2026-09-18 verification](README-ccd016-v2-verification.md): 423 fork checks, 97/97 local branch outcomes and 2,000 RV checks.** The measurements below remain the archived pre-emergency source report.

From `simulations/trace-coverage.mjs` on 2026-09-15, source at /home/raphastacks/projects/citycoins-protocol/contracts/extensions/ccd016-swap-vault-mia-v2.clar at 58c3529: 4 simulations, 247 transactions (6 without a trace), every evaluated expression read from the stxer debug traces.

| metric | value |
|---|---|
| expressions executed / total | 394 / 641 (61.5%) |
| code lines touched / total | 201 / 273 (73.6%) |
| function body lines touched / total (top-level definitions excluded) | 201 / 228 (88.2%) |
| branch nodes (if / match / asserts!) | 35: 35 full, 0 partial, 0 never reached |

## Branches with one arm never taken (0)

| line | function | kind | state |
|---|---|---|---|

## Branch nodes never reached (0)

| line | function | kind |
|---|---|---|

## Uncovered code lines by function

| function | lines |
|---|---|
| (top) | 96, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 119, 120, 121, 123, 124, 127, 132, 137, 138, 139, 140, 143, 144, 145, 146, 147, 148, 150, 152, 157, 159, 161, 164, 166, 172, 173, 182 |
| ERR_UNAUTHORIZED | 101 |
| ERR_NO_FUNDS | 102 |
| ERR_NO_BUDGET | 103 |
| ERR_INVALID_PRICE | 104 |
| ERR_WINDOW_CLOSED | 105 |
| ERR_WINDOW_OPEN | 106 |
| ERR_NO_CLOCK | 107 |
| ERR_OUT_OF_RANGE | 108 |
| ERR_NOTHING_RESTING | 109 |
| ERR_ORACLE_DIA | 110 |
| ERR_ORACLE_STALE | 111 |
| ERR_ORACLE_DIVERGED | 112 |
| ERR_NO_BLOCK_TIME | 113 |
| ERR_CHUNK_TOO_BIG | 114 |
| ERR_SPLIT_MISMATCH | 115 |
| ERR_SOME_FUNDS | 116 |
| ERR_COOLDOWN | 117 |
| batch-start | 182 |

## Per simulation (cumulative executed expressions of ccd016-swap-vault-mia-v2)

| sim | txs | before | after |
|---|---|---|---|
| `32235e8c` | 67 | 0 | 662 |
| `0f7a68fd` | 31 | 662 | 672 |
| `d1213248` | 109 | 672 | 676 |
| `214f5e18` | 40 | 676 | 676 |

## Notes

- The four simulations are the current runs of the four `ccd016` harnesses on the vault at 58c3529 (the cooldown build): coverage (`32235e8c`, 96/96), happy path (`0f7a68fd`, 52/52), parked (`d1213248`, 129/129) and the keyless clock with the ccip027 proposal (`214f5e18`, 67/67).
- Every branch node is full. The lines left are top-level definitions (constants, data vars: they run at deploy, which has no trace) and `batch-start`'s definition.
- Read-only functions leave no trace when called through `addEvalCode`; the coverage harness calls `get-clock`, `get-config` and `get-status` through the sim-only proxy contract inside a transaction, so their arms are traced.
- Generated from the jing-contracts-v3 checkout: `node simulations/trace-coverage.mjs --contract ccd016-swap-vault-mia-v2 --alias '^ccd016-swap-vault-mia-v2' --source ../citycoins-protocol/contracts/extensions/ccd016-swap-vault-mia-v2.clar --sims <the four ids> --md`.
