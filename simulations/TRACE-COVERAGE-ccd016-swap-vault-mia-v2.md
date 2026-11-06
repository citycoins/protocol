# Trace coverage: ccd016-swap-vault-mia-v2

> The previous (2026-09-15, pre-emergency source `58c3529`, 4 sims) numbers of this file are in git history.

From `simulations/trace-coverage.mjs` on 2026-11-06, source at `contracts/extensions/ccd016-swap-vault-mia-v2.clar` at commit 37af4b4: 19 simulations, 930 transactions (21 without a trace), every evaluated expression read from the stxer debug traces. Counted by source: only deployments whose code has sha256 `ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e` (the current file).

| metric | value |
|---|---|
| expressions executed / total | 565 / 689 (82.0%) |
| code lines touched / total | 441 / 498 (88.6%) |
| function-body lines touched / total (top-level definitions excluded) | 441 / 441 (100.0%) |
| branch nodes: full / partial / never reached | 109: 59 / 50 / 0 |

Branch nodes are `if` and `match` (two arms) and every guard: `asserts!`, `try!`, `unwrap!`, `unwrap-err!`, `unwrap-panic` (arms = pass and fail). A guard's fail arm counts only when the guard itself produced the error, not when an error from an argument passed through it. Expression totals exclude syntactic lists the evaluator never records (tuple key/value pairs, `let` binding lists, `as-contract?` allowance lists); their atoms count with the enclosing call. These rules are stricter than the Jing copy of the tool (which counted a reached `asserts!` as full), so the numbers are not comparable with the historical report.

## Uncovered branch arms (50)

Fork column: **yes** = a reasonable new stxer scenario on the live fork reaches it; **fixture** = needs a patched contract (`setContractCode`); **no** = unreachable with the live dependencies.

| line | function | kind | arm never taken | reason | fork |
|---|---|---|---|---|---|
| 261 | set-no-pyth-slippage-bps | try! | fail | set-no-pyth-slippage-bps never called by a non-DAO sender | yes |
| 287 | set-maker-spread-bps | try! | fail | set-maker-spread-bps never called by a non-DAO sender | yes |
| 288 | set-maker-spread-bps | asserts! | fail | maker spread above MAX_MAKER_SPREAD_BPS (u50) never proposed | yes |
| 316 | set-slippage-bps | try! | fail | set-slippage-bps never called by a non-DAO sender | yes |
| 324 | set-max-chunk-sats | try! | fail | set-max-chunk-sats never called by a non-DAO sender | yes |
| 351 | dao-recall-sbtc | unwrap-panic | fail | sBTC get-balance always returns ok | no |
| 353 | dao-recall-sbtc | asserts! | fail | ERR_NO_FUNDS: dao-recall-sbtc never run on an empty vault | yes |
| 354 | dao-recall-sbtc | try! | fail | as-contract? allowance = balance and the transfer moves exactly balance: defensive | no |
| 355 | dao-recall-sbtc | try! | fail | sBTC transfer of the vault's own full balance (> 0) cannot fail | no |
| 383 | fund-from-treasury | unwrap! | fail | sBTC get-balance always returns ok: ERR_NO_BUDGET here is defensive | no |
| 399 | fund-from-treasury | asserts! | fail | ERR_NO_BUDGET: fund-from-treasury never called with an empty rewards treasury | yes |
| 400 | fund-from-treasury | try! | fail | treasury withdraw-ft refused: vault not yet an enabled extension / sBTC not allowlisted | yes |
| 468 | fuel-fair-book | try! | fail | as-contract? with-stx amount covers the exact transfer: defensive | no |
| 469 | fuel-fair-book | try! | fail | stx-transfer? of 0 < amount <= balance cannot fail | no |
| 501 | jing-place | try! | fail | jing-place never given a bad Lazer update (vault-mid fails elsewhere, not at this call site) | yes |
| 507 | jing-place | try! | fail | as-contract? allowance = amount, the market pulls exactly amount: defensive | no |
| 508 | jing-place | try! | fail | market deposit-token-x refusal (below min-token-x-deposit, ERR_ALREADY_PENDING, paused) not exercised | yes |
| 534 | jing-refloor | try! | fail | jing-refloor never given a bad Lazer update | yes |
| 541 | jing-refloor | asserts! | fail | ERR_NOTHING_RESTING: refloor with nothing resting not exercised | yes |
| 542 | jing-refloor | try! | fail | empty allowance and set-token-x-limit moves no asset: defensive | no |
| 543 | jing-refloor | try! | fail | set-token-x-limit guards (limit > 0, spread < 10000, resting > 0) are all pre-checked by the vault | no |
| 573 | jing-take | try! | fail | check-amount in jing-take (empty vault / zero sweep) not exercised | yes |
| 574 | jing-take | try! | fail | allowance backstop: market pulls <= amount and the Lazer fee is 0 (budget 0) | fixture |
| 577 | jing-take | try! | fail | market swap refusal (u1018 resting position, paused) not exercised | yes |
| 623 | router-swap | try! | fail | check-amount in router-swap (wallet empty while sats rest in Jing after the window) not exercised | yes |
| 625 | router-swap | try! | fail | allowance backstop sized for the router's refunded dust: unreachable with the live v5-5 router | fixture |
| 637 | router-swap | try! | fail | smart-swap only reverts on zero mid/limit (pre-checked) or an AMM stage revert | fixture |
| 645 | router-swap | asserts! | fail | every router leg already enforces the limit: defensive floor re-check | no |
| 682 | router-swap-split | try! | fail | router-swap-split never given a bad Lazer update | yes |
| 694 | router-swap-split | asserts! | fail | ERR_WINDOW_OPEN: split during an open window not exercised | yes |
| 695 | router-swap-split | asserts! | fail | ERR_CHUNK_TOO_BIG: split above max-chunk-sats not exercised | yes |
| 696 | router-swap-split | try! | fail | check-amount in split (amount > balance) not exercised | yes |
| 698 | router-swap-split | try! | fail | allowance backstop: unreachable with the live router | fixture |
| 702 | router-swap-split | try! | fail | router swap-sbtc-for-stx revert (ERR_MIN_OUT on an oversized AMM leg) not exercised | yes |
| 755 | router-swap-split-dia | try! | fail | allowance backstop: unreachable with the live router | fixture |
| 756 | router-swap-split-dia | try! | fail | router revert on an oversized AMM leg in the DIA split not exercised | yes |
| 850 | get-status | unwrap-panic | fail | sBTC get-balance always returns ok | no |
| 894 | get-no-pyth-price | asserts! | fail | limit = mid * (1 - slip) with slip <= 50% is > 0 for any live DIA mid | no |
| 903 | get-no-pyth-price | try! | fail | native fallback: rfq-sbtc-stx-jing-v2-3 get-native-price never errs on the fork state | fixture |
| 922 | get-dia-value | unwrap! | fail | ERR_ORACLE_DIA: DIA get-value for the two fixed keys always returns ok | fixture |
| 929 | get-dia-value | unwrap! | fail | ERR_NO_BLOCK_TIME: the previous block always has a time | no |
| 946 | get-dia-price | try! | fail | BTC/USD failing while STX/USD passes (both share DIA's update cadence) | fixture |
| 949 | get-dia-price | asserts! | fail | btc-usd * 1e8 / stx-usd > 0 for any live prices | no |
| 1008 | sbtc-balance | unwrap-panic | fail | sBTC get-balance always returns ok | no |
| 1035 | current-mid | asserts! | fail | market refresh-mid never returns a zero mid | no |
| 1037 | current-mid | try! | fail | DIA failure while the band is ON (DIA failure only ran with the band off) | fixture |
| 1038 | current-mid | asserts! | fail | ERR_ORACLE_DIVERGED below the band not exercised | yes |
| 1041 | current-mid | asserts! | fail | ERR_ORACLE_DIVERGED above the band not exercised | yes |
| 1125 | reclaim-core | try! | fail | empty allowance on cancel: defensive | no |
| 1126 | reclaim-core | try! | fail | cancel-token-x-deposit's only guard (something to cancel) is mirrored by the vault's if | no |

## Uncovered function-body lines (0)

None.

**Top-level definitions** (57 lines: 98, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 123, 124, 126, 127, 128, 133, 139, 141, 142, 145, 150, 155, 156, 157, 158, 161, 162, 163, 164, 165, 172, 174, 176, 178, 182, 184, 196, 197, 200, 206, 209, 211, 213, 216, 218, 224, 225, 234): Constants, error codes, maps, data vars and trait lines execute only at deploy, and stxer returns no trace for deploy transactions: every one of the top-level expressions listed below is in that class. No function-body line is uncovered.

## What a new fork scenario could still reach

- **Unauthorized setters** (L261, L287, L316, L324): one tx per setter from a plain wallet; expect `ERR_UNAUTHORIZED`.
- **Out-of-range maker spread** (L288): via the sim-dao-proxy, `set-maker-spread-bps u51`.
- **Empty-vault recall** (L353): sim-dao-proxy calls `dao-recall-sbtc` before any funding (or twice in a row).
- **Empty treasury funding** (L399): call `fund-from-treasury` twice in one block; the second sees 0 sBTC.
- **Funding before activation** (L400): deploy book + vault, give the rewards treasury sBTC, call `fund-from-treasury` before ccip028 executes; ccd002 refuses `withdraw-ft`.
- **Bad Lazer update per entry** (L501, L534, L682): pass a truncated / altered update buffer to `jing-place`, `jing-refloor`, `router-swap-split` (the same failure already runs through other entries).
- **Market refuses the deposit** (L508): hold fewer sats than the market's min-token-x-deposit and `jing-place`; or `jing-place`, transfer more sBTC to the vault, `jing-place` again (ERR_ALREADY_PENDING); or impersonate the Jing market owner multisig and `set-paused true`.
- **Refloor with nothing resting** (L541): sim-dao-proxy `jing-refloor` with an empty market position.
- **jing-take with nothing to sell** (L573) and **market refuses the take** (L577): after the window elapses, DAO `jing-take` with an empty wallet; then place, let the window elapse, DAO `jing-take` without reclaiming (market u1018).
- **router-swap with the wallet empty** (L623): place the whole balance into Jing, let the window elapse, call `router-swap` (chunk-amount 0).
- **Split guards** (L694, L695, L696): DAO `router-swap-split` during the open window; with amount > max-chunk-sats; with amount > balance.
- **Router leg revert** (L702, L756): DAO split with an oversized DLMM or XYK leg so the leg misses its min-out (router ERR_MIN_OUT).
- **DIA band divergence** (L1038, L1041): sim-dao-proxy sets `dia-band-bps u1`; whichever side the live Lazer mid sits vs DIA fails. The other side needs either a later fork block where the sign flips or a patched DIA value (fixture).

Only with a patched dependency (`setContractCode` fixture), not on the live fork state:

- **Allowance backstops** (L574, L625, L698, L755): need a router or oracle that moves more than the allowance (a patched router, or a Lazer fee > pyth-fee-budget). They exist precisely so the live code never reaches them.
- **smart-swap revert** (L637): needs an AMM pool that reverts inside its own sizing; patch a pool with `setContractCode`.
- **Oracle failures** (L903 native price erring, L922 DIA get-value erring, L946 BTC/USD alone stale, L1037 DIA failing while the band is on): patch `dia-oracle` / `rfq-sbtc-stx-jing-v2-3` read paths with `setContractCode`. L1037 is the most valuable of these: it is the band-on DIA outage path.

## Unreachable with the live dependencies

sBTC `get-balance` unwraps (L351, L383, L850, L1008), exact-amount allowances and self-transfers (L354, L355, L468, L469, L507, L542, L1125), market guards the vault already pre-checks (L543, L1126), arithmetic that cannot be zero with live prices (L894, L949, L1035), the router floor re-check (L645) and the always-present previous block time (L929).

## Per simulation (cumulative executed expressions of ccd016-swap-vault-mia-v2)

| sim | txs | before | after |
|---|---|---|---|
| `9017e8c8` | 70 | 0 | 763 |
| `7ac6d5a1` | 32 | 763 | 775 |
| `8088c615` | 113 | 775 | 788 |
| `fdcffbde` | 53 | 788 | 793 |
| `d4f78ee7` | 51 | 793 | 801 |
| `6e4eec77` | 37 | 801 | 818 |
| `8633aa7e` | 23 | 818 | 938 |
| `ba125211` | 22 | 938 | 958 |
| `9c25c7c2` | 49 | 958 | 958 |
| `e00190de` | 49 | 958 | 958 |
| `ef50a5d2` | 42 | 958 | 958 |
| `4e0d9a0a` | 42 | 958 | 958 |
| `614c1743` | 67 | 958 | 958 |
| `02c1bd9c` | 67 | 958 | 958 |
| `74834ff6` | 61 | 958 | 958 |
| `fbc89766` | 61 | 958 | 958 |
| `2e09891a` | 38 | 958 | 958 |
| `a707bf89` | 38 | 958 | 958 |
| `d45fb46d` | 15 | 958 | 974 |

## Provenance and trace diagnostics

source contracts/extensions/ccd016-swap-vault-mia-v2.clar at 37af4b4, sha256 `ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e`. Only deployments with that exact code are counted.

| item | count |
|---|---|
| transactions | 930 |
| no trace returned by stxer | 21 |
| trace decode errors | 0 |
| calls to a counted instance | 311 |
| ... of which without a trace | 0 |
| ... of which decode errors | 0 |

| sim | counted instances |
|---|---|
| `9017e8c8` | ccd016-swap-vault-mia-v2 |
| `7ac6d5a1` | ccd016-swap-vault-mia-v2 |
| `8088c615` | ccd016-swap-vault-mia-v2 |
| `fdcffbde` | ccd016-swap-vault-mia-v2 |
| `d4f78ee7` | ccd016-swap-vault-mia-v2 |
| `6e4eec77` | ccd016-swap-vault-mia-v2 |
| `8633aa7e` | ccd016-swap-vault-mia-v2 |
| `ba125211` | ccd016-swap-vault-mia-v2 |
| `9c25c7c2` | ccd016-swap-vault-mia-v2 |
| `e00190de` | ccd016-swap-vault-mia-v2 |
| `ef50a5d2` | ccd016-swap-vault-mia-v2 |
| `4e0d9a0a` | ccd016-swap-vault-mia-v2 |
| `614c1743` | ccd016-swap-vault-mia-v2 |
| `02c1bd9c` | ccd016-swap-vault-mia-v2 |
| `74834ff6` | ccd016-swap-vault-mia-v2 |
| `fbc89766` | ccd016-swap-vault-mia-v2 |
| `2e09891a` | ccd016-swap-vault-mia-v2 |
| `a707bf89` | ccd016-swap-vault-mia-v2 |
| `d45fb46d` | ccd016-swap-vault-mia-v2 |

| excluded deployment (name@hash) | sims |
|---|---|
| ccd015-redemption-book-mia-stx@b3526d4ce89e | 19 |
| ccip-ccd016-dia-band-restore@b64ffa43801f | 1 |
| ccip027-ccd016-dia-band-off@55e783846d18 | 1 |
| ccip028-activate-mia-fair-redemption@8826bc5d6abe | 1 |
| sim-dao-proxy@1cc88a8bee4f | 1 |
| sim-dao-proxy@1e16f8c4c49b | 1 |
| sim-dao-proxy@59ff67ec8067 | 1 |
| sim-dao-proxy@a32448999e20 | 1 |
| sim-dao-proxy@b5060b6ab25a | 1 |
| sim-dao-proxy@cab860a6689a | 1 |
| sim-emergency-dao-proxy@7a11d0854fab | 2 |
| sim-recovery-proposal@08f1cb3cb875 | 10 |
