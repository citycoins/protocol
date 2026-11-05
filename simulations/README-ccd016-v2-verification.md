# CityCoins MIA vault v2: current-source verification

> Current 2026-09-23 v6-3 recovery and regression results: [cancel-only recovery verification](README-v6-3-recovery.md). The notes below describe the earlier verification; linked JSON artifacts now contain the current reruns.

Verified on **2026-09-18**, after the zero-block window and emergency AMM-only
changes: **423/423 Stxer checks passed** across six forks. The local runtime
suite passed **259 assertions** and reached **97/97 instrumented branch outcomes**
and **293/295 line counters** in `ccd016-swap-vault-mia-v2.clar`. Two Rendezvous
seeds passed **2,000/2,000 invariant checks**, with **zero runtime exceptions**,
**zero falsified invariants**, and **72 completed emergency batch round trips**.
No contract bug was found in these runs. Finite fuzzing and branch coverage do
not prove correctness for every input or every dependency state.

The verified vault SHA-256 is
`e2c05bf3238290a0644685654cda3d040382afe7d7e858530ddd04bcfd8b3573`.
The companion fair-book source hash is
`b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`.
The contract amendments were already committed by the owner in `392f1d4`; this
verification adds tests/docs without modifying or deploying production contracts.

## Saved mainnet-fork runs

| Scenario | Passed checks | Mainnet fork | Saved report |
| --- | --- | --- | --- |
| coverage | 96/96 | [Stxer](https://stxer.xyz/simulations/mainnet/bb914c4dcfbe02143f82254f6ba073f6) | [coverage.json](results/ccd016-v2/coverage.json) |
| happy-path | 52/52 | [Stxer](https://stxer.xyz/simulations/mainnet/05618f27dc5ceda022694c0232b65e6f) | [happy-path.json](results/ccd016-v2/happy-path.json) |
| parked | 129/129 | [Stxer](https://stxer.xyz/simulations/mainnet/36b39179ed6cee3f3caaefa8de515e45) | [parked.json](results/ccd016-v2/parked.json) |
| clock-keyless | 67/67 | [Stxer](https://stxer.xyz/simulations/mainnet/663a7679b8fb090745363ee2c843de2e) | [clock-keyless.json](results/ccd016-v2/clock-keyless.json) |
| emergency-dia | 38/38 | [Stxer](https://stxer.xyz/simulations/mainnet/4767ae9cd65169e1a3f71aac94954fc0) | [emergency-dia.json](results/ccd016-v2/emergency-dia.json) |
| emergency-native | 41/41 | [Stxer](https://stxer.xyz/simulations/mainnet/f542f550de16afa96c94bcba2239d368) | [emergency-native.json](results/ccd016-v2/emergency-native.json) |


All simulations deploy the vault at the beginning. They submit no production
transaction and move no real funds. The four legacy scenarios also deploy a
fresh Jing core/ladder/market/router using `sim-city-*` aliases: their source and
the vault dependency references are renamed only in the simulation. This avoids
duplicate-contract failures now that the original Jing names exist on mainnet.
Comment-only lines are stripped to meet deployment limits. In the three priced
legacy scenarios, the market's `MAX_STALENESS` is widened so one authentic signed
Pyth update remains usable after synthetic block advances. Those scenarios are
not evidence for the market's normal freshness deadline. DAO extension predicates
are patched only to recognize the simulated vault and passed-proposal proxy;
the vault's real DAO gate stays intact. DIA updates are seeded from the same
signed feed values to isolate vault behavior.

The two emergency scenarios deploy **exact unchanged vault and fair-book source**
and use the **real deployed Jing router, RFQ native-price getter, and AMMs**.
A real whale balance funds the real rewards treasury on the fork; the vault pulls
through `fund-from-treasury`. The DAO proxy changes window/config settings. No
Pyth update is fetched or supplied. Committed router events verify Jing allocation
and output are zero, `jing-ok` has decoded boolean type `"false"`, and unsold is zero.
The native scenario deliberately makes DIA stale/zero and the RFQ coinbase zero
using fork-only state overrides. These faults isolate fallback and fail-closed paths.

Both emergency scenarios cover unauthorized direct calls, window 0/288 transitions,
window cap, patience rejection, allocation mismatch, zero amount, over-balance,
chunk cap and tolerance cap. The DIA scenario also checks shared-burn cooldown,
full balance drain, automatic clock closure, and public forwarding of all STX to
the fair book. The keyless-clock scenario executes the real `base-dao` proposal
path and replay protection. The parked scenario checks parked/resting recovery;
the other scenarios cover maker fills, taking, reflooring, oracle gates and treasury recall.

## Numerical emergency examples

The DIA fork reads STX/USD `u28417010` (**$0.28417010**) and BTC/USD
`u8111338286200` (**$81,113.38286200**). Both feeds use eight decimals.

```clarity
price = btc-usd * 100000000 / stx-usd
```

The ratio is `u28543954083135`, or **285,439.54083135 STX/BTC**.
At the default 10% emergency tolerance, the limit is `u25689558674821`.
For 10,000 sats (0.0001 BTC), minimum output is **25.689558 STX**;
the real DLMM paid **28.664438 STX**. The next 90,000-sat sale drained the vault;
**286.644387 STX** total was forwarded to the fair book and its clock cleared.

The stale-DIA native fork returns `u30179204114029`, or
**301,792.04114029 STX/BTC**. Its lower band edge is integer floor(native / 2),
`u15089602057014`. For 10,000 sats, minimum output is **15.089602 STX**.
The real DLMM/XYK/Velar split (4,000/3,000/3,000 sats) paid **28.579370 STX**.
DIA stale by one second over the two-hour limit gives `u16036`; zero DIA gives
`u16013`; either selects native. With native coinbase also zero, the quote and
swap reject with `u16013`, keeping the unsold vault balance.

`get-dia-value` returns the positive raw feed integer after checking the timestamp.
Timestamp milliseconds are divided by 1,000; age is compared with the previous
Stacks block timestamp, not wall-clock time. Exactly 7,200 seconds old is accepted,
7,201 seconds old is stale. The local suite tests both endpoints. `get-no-pyth-price`
uses native fallback on DIA response errors; VM runtime panics are not catchable
response errors. If native returns an error or its half-price rounds to zero, it fails closed.

## Replay and local/RV coverage

Run from the repo root:

```bash
npm ci
npm run test:vault
npm run rv:vault:build
npm run rv:vault -- --seed=20260918 --bail
npm run rv:vault -- --seed=20260919 --bail

# Set JING_SRC to a checkout containing the four Jing sources.
JING_SRC=/path/to/jing/contracts node simulations/stxer-ccd016-v2-coverage.js
JING_SRC=/path/to/jing/contracts node simulations/stxer-ccd016-v2-happy-path.js
JING_SRC=/path/to/jing/contracts node simulations/stxer-ccd016-v2-parked.js
JING_SRC=/path/to/jing/contracts node simulations/stxer-ccd016-v2-clock-keyless.js
node simulations/stxer-ccd016-v2-emergency.cjs
node simulations/stxer-ccd016-v2-emergency.cjs --native
```

Priced fork scenarios accept `PYTH_API_KEY`, or obtain the same authentic signed
payload from the public Jing backend. Endpoint overrides are `STACKS_API_URL`,
`STXER_API_URL` (emergency harness), `FAKTORY_API_URL`, and `FAKTORY_API_KEY`.

See the [local suite README](../tests/vault/README.md) for every dependency rewrite,
coverage artifacts, RV seeds, invariants and limitations. The old
[2026-09-15 trace report](TRACE-COVERAGE-ccd016-swap-vault-mia-v2.md) describes the
pre-emergency source; its 35 branch nodes are a different metric from today's
97 SDK-instrumented outcomes. Do not apply that old report to the current source.

## Rerun on the current sources, and the vault fixes (L-1, #7)

ccd016 v2 vault `858b098a` (`6c6075f`), Jing market `d1e3bbad`, router
`dfc8165b`, core `67242f19`.

| sim | stxer | checks |
|---|---|---|
| coverage | [fb0fb8c0](https://stxer.xyz/simulations/mainnet/fb0fb8c0b019750dbb5a8a2e9cb458eb) | 104/104 |
| happy-path | [2c94c13c](https://stxer.xyz/simulations/mainnet/2c94c13c6ec0ef1201a3cd6de166d11d) | 58/58 |
| parked | [b35bb5b4](https://stxer.xyz/simulations/mainnet/b35bb5b487e0fef026a1568d87abe7e4) | 136/136 |
| clock-keyless | [57b32d84](https://stxer.xyz/simulations/mainnet/57b32d84db6754299df121619ce05f96) | 68/68 |
| emergency-dia | [9e3835e3](https://stxer.xyz/simulations/mainnet/9e3835e33e2c7e959b14ffc2406a36d1) | 45/45 |
| emergency-native | [f33ef902](https://stxer.xyz/simulations/mainnet/f33ef902798adec97fcc101440062594) | 48/48 |
| recovery matrix (10 forks) | see `results/v6-3-recovery/citycoins.json` | 1128/1128 |
| **vault fixes** (`stxer-ccd016-v2-fixes.js`) | [48558d46](https://stxer.xyz/simulations/mainnet/48558d46415c733aafe5e4d944495600) | 92/92 |

Expectations changed, all from the L-1 fix (a partial `router-swap` used to
revert u3002, it now sells what fits inside the floor):
- `stxer-ccd016-v2-coverage.js` S7: the 300k-cap sale asserts `sold > 8` and
  `out >= floor-out(sold - 8)` instead of the whole 300,000; the balance checks
  use `sold`; the 1,000-sat chunk is checked against a direct router probe
  from the same pool state (u16047 exactly when 8 sats or less fit); S7b
  asserts the floor on what sold and the vault's STX gain = `out`. S8b raises
  `set-slippage-bps` to 500 for the DAO split and restores 100 (S7's partial
  sale leaves the DLMM at the floor).
- `stxer-ccd016-v2-happy-path.js` B2: a partial sale is allowed; a 300 STX bid
  then rests and the next call sells the rest through the book; residual
  wallet sBTC at most 2 dust sats; the bidder cancels what is left.

The vault-fixes sim: #7 (a 1-sat pending escrow after an exact sell-out:
`close-batch` moves 1 sat home and closes with the window still open; 3 sats
still refused u16043); L-1 (3- and 8-sat sales revert u16047 without burning
the cooldown; with the pools pushed to mid - 0.5%, 2,367,338 sold and
7,632,665 kept, the next call reverts u16047, and after a bid rests 114,866
more sell). L-2 and #6 do not apply to ccd016 (its window cap stays 1008; 1009
refused u16033). #8 cannot be built since the market's M-1 fix.

The regenerated `results/ccd016-v2/coverage.json` and `happy-path.json` for
these runs are not committed here (those two files hold other uncommitted
work in this checkout).


## Rerun on the exact-rebate market (2026-09-30)

What changed:
- **Market** (jing-contracts-v3 `34bbe18`): `swap` sizes the rebate on the net,
  `net = floor(amount*10000/(10000+bps))`, `rebate = amount - net`. The unused rebate
  refunded is now only rounding. `gross-cap = net-cap==0 ? 0 : floor(((net-cap+1)*10020-1)/10000)`.
- **Router** (`6a84e02`): `jing-size` estimates `net = size*BPS/(BPS+20)`.
- **Vault** (`1cc6f23`): the `router-swap` allowance is `amount + min-x + JING_REBATE_DUST_SATS` (u51).

Fork setup:
- `ccd016-swap-vault-mia-v2` and `ccd015-redemption-book-mia-stx` are not on mainnet, so they keep their names.
- The sims already forked at the tip. `FORK_BLOCK` now pins the whole set to one height: **9093167**.

Model updates, all derived from the formulas above:
- coverage, happy-path and parked: the taker's `NET = TAKE*BPS/(BPS+20)`, `REB = TAKE - NET` (was `REB = TAKE*20/BPS`).
- fixes:
  - `takeFor` sizes the taker with the same net;
  - the source guard looks for `JING_REBATE_DUST_SATS u51`;
  - #8 checks the gross outflow against `amount + min-x + 51`.

No other expectation changed.

| sim | stxer | checks |
|---|---|---|
| coverage | [a3e5effa4d7b4691b14e4f2161234fc8](https://stxer.xyz/simulations/mainnet/a3e5effa4d7b4691b14e4f2161234fc8) | 104/104 |
| happy-path | [c24238efa0e539e007d5d4f114d5da4e](https://stxer.xyz/simulations/mainnet/c24238efa0e539e007d5d4f114d5da4e) | 58/58 |
| parked | [42b73c75ef30f192972ac63d08b7ac55](https://stxer.xyz/simulations/mainnet/42b73c75ef30f192972ac63d08b7ac55) | 136/136 |
| clock-keyless | [36dc5d5c2032ab7c31ba6613c8b90635](https://stxer.xyz/simulations/mainnet/36dc5d5c2032ab7c31ba6613c8b90635) | 68/68 |
| emergency-dia | [086ea6296ca766eaa856a3e3a6e2a4d2](https://stxer.xyz/simulations/mainnet/086ea6296ca766eaa856a3e3a6e2a4d2) | 45/45 |
| emergency-native | [56cc1338510431115d818655691eabb4](https://stxer.xyz/simulations/mainnet/56cc1338510431115d818655691eabb4) | 48/48 |
| vault fixes | [bc40377f4a84e3355434c8c67f0d7900](https://stxer.xyz/simulations/mainnet/bc40377f4a84e3355434c8c67f0d7900) | 92/92 |
| recovery matrix: pending, public / dao | [4738be2f10184c5aa1bf03e5f17e15a7](https://stxer.xyz/simulations/mainnet/4738be2f10184c5aa1bf03e5f17e15a7) / [f588c624c26329015b49cd5fc9d5033d](https://stxer.xyz/simulations/mainnet/f588c624c26329015b49cd5fc9d5033d) | 1128/1128 in total |
| recovery matrix: resting, public / dao | [0aaae19418b1d7ab2c2a4c5a0dafebb4](https://stxer.xyz/simulations/mainnet/0aaae19418b1d7ab2c2a4c5a0dafebb4) / [1fcfdd0c0e067c85e338f5fcb3535dd3](https://stxer.xyz/simulations/mainnet/1fcfdd0c0e067c85e338f5fcb3535dd3) | |
| recovery matrix: parked, public / dao | [1345f43845e204eb9a4a0640fd3cbf76](https://stxer.xyz/simulations/mainnet/1345f43845e204eb9a4a0640fd3cbf76) / [702440f3ed5e8dd9e70ef7983951ecf8](https://stxer.xyz/simulations/mainnet/702440f3ed5e8dd9e70ef7983951ecf8) | |
| recovery matrix: pending+resting, public / dao | [ced56d645b4aaabdafb361322640f839](https://stxer.xyz/simulations/mainnet/ced56d645b4aaabdafb361322640f839) / [b7897fe64a252185c5c607345ce22b78](https://stxer.xyz/simulations/mainnet/b7897fe64a252185c5c607345ce22b78) | |
| recovery matrix: none, public / dao | [0eb2cafda3c8b7d7be4e11318999ac7a](https://stxer.xyz/simulations/mainnet/0eb2cafda3c8b7d7be4e11318999ac7a) / [6dd02ced090a2a55ed49aaaa715a75fe](https://stxer.xyz/simulations/mainnet/6dd02ced090a2a55ed49aaaa715a75fe) | |

Vault-fixes numbers at this fork:
- L-1: 2,594,512 sold and 7,405,491 kept. The next call sold 115,078 more through the book.
- #8: that book-leg sale moved 115,078 sats gross with 0 refunded, against an allowance of 7,406,542.

As before, the regenerated `coverage.json` and `happy-path.json` are not committed,
because those files hold other uncommitted work in this checkout.

SHA-256 of the deployed sources:
- `ccd016-swap-vault-mia-v2`: `5b5d99c0c16f11e6f08e26dd42d591a5ad81b2920c56912986b52d251c70813e`
- `ccd015-redemption-book-mia-stx`: `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`
- `markets-sbtc-stx-jing-v6-3`: `5c08412fc5990a8bf0db3a0cbbec3fa4c859d4185d0caf1cd16ae0c78f851bfb`
- `swap-router-sbtc-stx-jing-v5-3`: `882374f40bfdf8270b3ea18ba2d7e68fce4431ee17c60f70b00bb2670240fe58`
- `jing-core-v6`: `88a689affb23f13030953e891336af42a3f5cb275f13b3c54c79d8cd4de50697`
- `jing-ladder-v1`: `0f1e08b023272ed96a2653f727292626d4b0325dcf4e42963104d977860ec786`

Run the set on one fork with `FORK_BLOCK=<height>`. The recovery matrix is `stxer-ccd016-v2-emergency.cjs --recovery`.
