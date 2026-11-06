# CCIP-028 mainnet-fork simulations (stxer)

Every run forks Stacks mainnet, deploys the exact repository sources (vault `ac0c305f…`, book `b3526d4c…`,
SHA-256 checked) and moves no real funds.

| Scenario | Result | Mainnet fork | Saved report |
| --- | --- | --- | --- |
| CCIP-028 activation + full cycle | 47/47 | [Stxer](https://stxer.xyz/simulations/mainnet/d45fb46db676464d470f9c016a7cf5d4) | [result.json](results/ccip028-activation/result.json) |
| CCD016 maker spread on the live Jing v6-4 market | 55/55 | [Stxer](https://stxer.xyz/simulations/mainnet/423a4aef56bfe9afa6263ece17c1769e) | [maker-spread.json](results/ccd016-v2/maker-spread.json) |
| CCD015 par check (current STX book) | 25/25 | [Stxer](https://stxer.xyz/simulations/mainnet/7b6d5d12d5cf2fc12bf6a14774a6266d) | [stx-par-check.json](results/ccd015/stx-par-check.json) |
| CCD015 coverage, phase 1 (offer lifecycle, par gates, crossing, burn, pause, DAO setters) | 146/146 | [Stxer](https://stxer.xyz/simulations/mainnet/c867b81a1ce2fdd0efbb8a47fb232e74) | [stx-coverage.json](results/ccd015/stx-coverage.json) |
| CCD015 coverage, phase 2 (50-offer book, eviction, cheapest-first fill) | 124/124 | [Stxer](https://stxer.xyz/simulations/mainnet/010ec971fcc5a1b148aba2bfbc3f9d8f) | [stx-coverage.json](results/ccd015/stx-coverage.json) |

## CCIP-028 activation (`stxer-ccip028-activation.mjs`)

- Deploys the book, vault and proposal from one address; checks their SHA-256.
- Reads the live DAO: Direct Execute enabled, threshold 3, all 5 approvers, sunset open.
- Three real approvers signal; the proposal executes only on the third.
- After activation: vault is a DAO extension, sBTC allowed on the rewards treasury,
  leeway 10%, Pyth fee budget 0, par 2,042.49 STX per 1M MIA, book open.
- Full cycle: 100,000 sats reach the rewards treasury, the vault pulls and rests them on
  `markets-sbtc-stx-jing-v6-4`, 289 Bitcoin blocks pass, the vault sells through
  `swap-router-sbtc-stx-jing-v5-5` for 223.17 STX, the book takes a 100,000 MIA offer
  for 100 STX and burns it from the real MIA supply.

Run: `npm ci && node simulations/stxer-ccip028-activation.mjs`

## CCD016 maker spread (`stxer-ccd016-v2-maker-spread.js`)

The vault rests at mid + 1 bp on the live v6-4 book and is filled by a real taker.
Recorded against vault SHA-256 `327af8a1…`; the reviewed vault (`ac0c305f…`) differs
only in comments (identical once `;;` comments are stripped). The scenario relies on a
specific maker resting at the mid on the live book, so a rerun on today's tip can fail
on those live-state preconditions (its STX holder `SP9BP4…` is also empty now); the saved run is the reference.

## CCD015 book (`stxer-ccd015-stx-par-check.mjs`, `stxer-ccd015-stx-coverage.mjs`)

Ported from the oracle book on `feat/ccd015-redemption-book` to the current STX-denominated book.
Par check: `calculate-par` / treasury / supply match independent reads (ccd002 mining-v3 treasury +
ccd014 pox-5 staking `stx-account`, MIA v1 × 10^6 + v2), 2,042.49 STX per 1M MIA. Coverage uses real
MIA holders and real STX; DAO calls go through real approver signals on ccd001-direct-execute (no
base-dao patch, no var-set). Dropped oracle-only scenarios are listed in the script header and report.

## CCD016 vault suite on the live v6-4 market (2026-11-05)

All seven vault harnesses now run against the LIVE `markets-sbtc-stx-jing-v6-4` and
`swap-router-sbtc-stx-jing-v5-5` at their mainnet principals (deployed bytes checked:
market `6b3e6943…`, router `6b65927e…`). No Jing contract is redeployed or aliased, and the
vault deploys unchanged, so its hard-coded `JING_MARKET` / `JING_ROUTER` are the real ones.
Shared setup: `_jing-live-v6-4.mjs`. Forks at the node tip − 3 (~9422232–9422239).

| Scenario | Result | Mainnet fork | Saved report |
| --- | --- | --- | --- |
| coverage | 105/105 | [Stxer](https://stxer.xyz/simulations/mainnet/9017e8c8e0b560241ef4fbd449be2154) | [coverage.json](results/ccd016-v2/coverage.json) |
| happy-path | 59/59 | [Stxer](https://stxer.xyz/simulations/mainnet/7ac6d5a12909b86f926bb7b32d36036c) | [happy-path.json](results/ccd016-v2/happy-path.json) |
| parked | 137/137 | [Stxer](https://stxer.xyz/simulations/mainnet/8088c61566cc3787faac6fb52423885d) | [parked.json](results/ccd016-v2/parked.json) |
| clock-keyless | 102/102 | [Stxer](https://stxer.xyz/simulations/mainnet/fdcffbdeffd45806f1ef70b1246e3848) | [clock-keyless.json](results/ccd016-v2/clock-keyless.json) |
| fixes (L-1, #7, #8) | 97/97 | [Stxer](https://stxer.xyz/simulations/mainnet/d4f78ee7a383ba3a2da89901ba469bbb) | [fixes.json](results/ccd016-v2/fixes.json) |
| pyth-fee | 71/71 | [Stxer](https://stxer.xyz/simulations/mainnet/6e4eec778597fc15d236cc3066690a1e) | [pyth-fee.json](results/ccd016-v2/pyth-fee.json) |
| emergency-dia | 40/40 | [Stxer](https://stxer.xyz/simulations/mainnet/8633aa7e5e9c5a4399f93ff7d31b8fc6) | [emergency-dia.json](results/ccd016-v2/emergency-dia.json) |
| emergency-native | 43/43 | [Stxer](https://stxer.xyz/simulations/mainnet/ba125211c57a1ef836eb7039ab80e7bc) | [emergency-native.json](results/ccd016-v2/emergency-native.json) |
| recovery matrix (`emergency.cjs --recovery`, 5 inventory shapes × public/DAO, 4 modes each) | 1108/1108 | pending [public](https://stxer.xyz/simulations/mainnet/9c25c7c2f65a9e747f10bdc14c6e240c) / [dao](https://stxer.xyz/simulations/mainnet/e00190def8d8f3ef658f3a88a1e67ebc); resting [public](https://stxer.xyz/simulations/mainnet/ef50a5d29eeb8f024448d918e0436625) / [dao](https://stxer.xyz/simulations/mainnet/4e0d9a0a50beb6f6da775e944cfedce2); parked [public](https://stxer.xyz/simulations/mainnet/614c1743d3ed0a757ab7b8674608ad81) / [dao](https://stxer.xyz/simulations/mainnet/02c1bd9c9238d4917645b755b38a1fbb); pending+resting [public](https://stxer.xyz/simulations/mainnet/74834ff6585dcb26fffc6b2a52704839) / [dao](https://stxer.xyz/simulations/mainnet/fbc8976643d936f7cc2b2ba9f3343e27); none [public](https://stxer.xyz/simulations/mainnet/2e09891a78f37b777b62e45ff3ddc2f0) / [dao](https://stxer.xyz/simulations/mainnet/a707bf8982c3a372fbcd415b8bef8701) | [citycoins.json](results/v6-4-recovery/citycoins.json) |

The recovery matrix (`_vault-recovery-v6-4.mjs`) follows the same rules. Its owner-only Jing calls are sent from
the real owners as unsigned simulated senders: market pause from the market operator, and core-v6 pause and
ladder reservation from the owner multisig `SM1N7VX…`.
Fixtures and model changes, all disclosed in each report:
- **Live book cleared first.** The scenarios need the vault as the only maker. Each fork first
  replays steps worked out on a throwaway fork of the same block: a real STX holder takes every
  fillable ask and a real sBTC holder sells into every fillable bid (market `swap`, sized by the
  market's `get-taker-capacity`); a maker still resting outside the mid is cancelled by its own
  owner (today: `yguazu-mm-loop-sell-stx` `cancel-buy-back` by its owner). An S0 check then asserts
  the book is empty. Third-party parked or pending entries are left as they are.
- **Holders.** The old STX holder `SP9BP4…` and emergency sBTC holder `SM2RRFN…` are empty at the
  tip; `SP2XXSW…` (STX) and `SP2C7BC…` (sBTC) replace them.
- **Maker spread.** The vault now pegs at mid + `maker-spread-bps` (default u1). The expectations
  that assumed a zero-spread peg now use the market's own formulas: `ask = mid × 10001 / 10000`; the
  taker's walk fills at the ask (`x = net × 10^10 / ask`, `y = x × ask / 10^10`, 10 bps fee, rebate
  `min(y × 20 / 10^4, pending)`). The order's spread is now asserted as `(some u1)`, not `(some u0)`.
- **Cycle indexes.** On a fresh market the first cycle was u0. On the live market, settlement and
  depositor reads use `(get-current-cycle)` instead.
- **clock-keyless.** The DIA escape-hatch proposal `ccip027-ccd016-dia-band-off.clar` is not on this
  branch, so the sim reads it from `origin/feat/ccd015-redemption-book` with `git show` (`PROP_REF`
  overrides). Its SHA-256 is saved in the report.
- **Unchanged from before:** the base-dao `is-extension` patch (vault + proxy), DIA pushed from its
  real updater with the Lazer prices, and keyless Lazer updates from the public faktory-dao route.
  No freshness widening. Vault and book deploy uncommented and unchanged.

Run from the repo root, after `npm ci` (needs `~/projects/jing-contracts-v3/simulations/_lazer.js`):

```sh
for s in coverage happy-path parked clock-keyless fixes pyth-fee; do node simulations/stxer-ccd016-v2-$s.js; done
node simulations/stxer-ccd016-v2-emergency.cjs; node simulations/stxer-ccd016-v2-emergency.cjs --native
node simulations/stxer-ccd016-v2-emergency.cjs --recovery
```

## Earlier vault verification (history)

`README-ccd016-v2-verification.md`, `README-v6-3-recovery.md`, `TRACE-COVERAGE-ccd016-swap-vault-mia-v2.md`
and `results/ccd016-v2/` record the vault's earlier mainnet-fork runs (coverage, happy path, parked,
clock, emergency DIA/native, fixes, Pyth fee) with their stxer links. Those runs used the Jing
market/router of their day (v6 / v6-3, router v5-3) and earlier vault revisions, each pinned by
SHA-256 in its report. They are kept as the audit trail behind the bounty verdicts in
`contracts/extensions/README-ccd016-swap-vault-v2.md`. The JSON files in `results/ccd016-v2/` now
hold the 2026-11-05 reruns above; the v6-3 recovery matrix stays in `results/v6-3-recovery/`.

## Trace coverage on the fork

`trace-coverage.mjs` reads stxer's debug trace of every simulated transaction and counts which
expressions of the exact deployed source ran (`--by-source`: only byte-identical deployments).
Guard fail arms (`asserts!`, `try!`, `unwrap!`) count separately from pass arms.

| Contract | Function-body lines run | Branch nodes full / partial / never | Report |
| --- | --- | --- | --- |
| ccd016 vault | 441/441 | 59 / 50 / 0 | [TRACE-COVERAGE-ccd016-swap-vault-mia-v2.md](TRACE-COVERAGE-ccd016-swap-vault-mia-v2.md) |
| ccd015 book | 167/185 (missing = read-only reporting functions, not traced) | 29 / 20 / 1 | [TRACE-COVERAGE-ccd015-redemption-book-mia-stx.md](TRACE-COVERAGE-ccd015-redemption-book-mia-stx.md) |
| ccip028 proposal | 23/23 | 0 / 16 / 0 (fail arms covered by `npm run test:ccip028`) | [TRACE-COVERAGE-ccip028-activate-mia-fair-redemption.md](TRACE-COVERAGE-ccip028-activate-mia-fair-redemption.md) |

Partial branches are error exits not triggered on the fork. Each report lists every one with its
reason and whether a new fork scenario could reach it, only a patched dependency could, or the
live contracts make it unreachable.
