# CCD016 v2: cancel-only recovery against Jing v6-3

Verified 2026-09-23: **1576/1576 checks green** — recovery matrix **1128/1128**, existing regression suites **448/448**. No production contract edits; fork transactions only.

## Recovery matrix

Each inventory shape runs in four modes: normal, no oracle update supplied, market paused, and core-v6 paused. The normal mode also omits the update; the separately labelled no-update mode repeats the case explicitly. Signed Lazer data is used only to create or settle fixture orders, never during recovery.

The fixtures create pending escrow by calling `jing-place` with a nonempty opposite book. Resting, parked, pending plus resting, and no market position are tested separately. Every recovery checks exact returned sBTC, zero vault balance, empty pending/live/parked state, and `u1030` on a later settle. Pending refunds must emit the committed core event with reason `cancel` and the exact escrow amount. Paused cases also assert the pause remains set.

Both paths run the complete matrix: a stranger calls `jing-reclaim none` after the window; a sender-guarded enabled DAO proposal extension calls `dao-reclaim none`. Direct unauthorized DAO reclaim is refused. Recovery first returns all sBTC to the vault, then the extension invokes `dao-recall-sbtc` and the exact treasury increase is checked.

| Inventory | Recovery caller | N/M, including setup | Fork |
| --- | --- | ---: | --- |
| pending | public | 112/112 | [stxer](https://stxer.xyz/simulations/mainnet/0204f2af61a09a0c021df465f7ff5341) |
| pending | dao | 112/112 | [stxer](https://stxer.xyz/simulations/mainnet/952ff6b81762f8c3a5b523fdf59099b5) |
| resting | public | 101/101 | [stxer](https://stxer.xyz/simulations/mainnet/70fc0ab7c25d50fb77fe1018223f38c2) |
| resting | dao | 101/101 | [stxer](https://stxer.xyz/simulations/mainnet/d29e5f6750a3aa644f22affd7365eec5) |
| parked | public | 130/130 | [stxer](https://stxer.xyz/simulations/mainnet/501d7620d2dece0ad8a0a7b7a2bdfd2e) |
| parked | dao | 130/130 | [stxer](https://stxer.xyz/simulations/mainnet/7eb52617edbc85061e80d98a32d9cd60) |
| pending+resting | public | 124/124 | [stxer](https://stxer.xyz/simulations/mainnet/f9f3b79002561e5bcbf394f662f829c5) |
| pending+resting | dao | 124/124 | [stxer](https://stxer.xyz/simulations/mainnet/df9410281744b901b6f7503a2b7eeedf) |
| none | public | 97/97 | [stxer](https://stxer.xyz/simulations/mainnet/83c127fdbb9b723140e4f53b897e3b32) |
| none | dao | 97/97 | [stxer](https://stxer.xyz/simulations/mainnet/3bfbc1ddeb35d0879f6dcd420d5c23d7) |

[Machine-checked recovery report](results/v6-3-recovery/citycoins.json).

## Existing regression reruns

| Harness / mode | N/M | Fork | Saved evidence |
| --- | ---: | --- | --- |
| clock-keyless | 68/68 | [stxer](https://stxer.xyz/simulations/mainnet/3e4eab14b29162327f09536e46405aad) | [JSON](results/ccd016-v2/clock-keyless.json) |
| coverage | 98/98 | [stxer](https://stxer.xyz/simulations/mainnet/10f0169123b4d93e8635bc27c6e7c3c4) | [JSON](results/ccd016-v2/coverage.json) |
| emergency-dia | 45/45 | [stxer](https://stxer.xyz/simulations/mainnet/2f7bada3a2234420258dab395aba51e0) | [JSON](results/ccd016-v2/emergency-dia.json) |
| emergency-native | 48/48 | [stxer](https://stxer.xyz/simulations/mainnet/5dad47cc84d8ed6d0eb145f37c88f05f) | [JSON](results/ccd016-v2/emergency-native.json) |
| happy-path | 53/53 | [stxer](https://stxer.xyz/simulations/mainnet/61bea2beacba7ff47f9fae52dd35db02) | [JSON](results/ccd016-v2/happy-path.json) |
| parked | 136/136 | [stxer](https://stxer.xyz/simulations/mainnet/b2caf36a54bce00fb8714589118b07b8) | [JSON](results/ccd016-v2/parked.json) |

## Fork setup and limits

Every recovery fork deploys the unmodified sibling Jing sources under `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22`: `jing-core-v6` → `jing-ladder-v1` → `markets-sbtc-stx-jing-v6-3` → `swap-router-sbtc-stx-jing-v5-3`. It syncs the ladder seats, verifies the market in core, then initializes it with sBTC/STX traits, minimums 1,000 sats / 1,000,000 µSTX, and feed IDs 1 / 45. Market initialization registers with core. The vault and pool (CCD016: book and vault) are then deployed from this repository.

The primary matrix uses real fork token transfers. PoX earned rewards and mirrored pool shares are seeded in storage; creating locks and signer registration are outside this test. The vault funding clock is aged with an explicit Eval (433 burn blocks for the pools, 288 for CCD016); Fastpool’s settlement deadline is also aged. This tests the recovery gate on elapsed state without expiring the signed update needed for fixture creation. It does not simulate days of independent market activity.

Parking is reached through the public ladder seat-reservation setter and a larger publicly submitted and settled entrant. The primary matrix does not rewrite market balances or order maps. CCD016’s DAO Extensions map enables only the actual vault and a sender-guarded proposal extension; this tests extension authorization and treasury flow, not governance voting.

Legacy regression fixtures retain their stated scope: earned rewards/shares, compressed burn-block intervals, and DAO/DIA fixtures. Juice’s upgrade suite also uses deliberately altered candidate authority and injected tranche/order state. The four legacy CCD016 scripts strip comments only from deployed Jing/vault sources, use canonical dependency names, and retain their simulated DAO implementation. The old oracle-staleness widening has been removed. Source hashes and fixture disclosures are saved with the reports.

Migration adjustments preserve scenario intent: deposit calls use submit’s current ABI; full-side placement/readmit tests explicitly settle; empty reclaim is idempotent. Two-chunk liquidation explicitly caps a chunk, because current `sweep-amount` drains a smaller balance in one call. Maker fills close the batch before finishing. Recovery continuity uses the current 432-block emergency delay. No recovery failure was hidden by changing a contract.

## Run

Requires the sibling `~/projects/jing-contracts-v3` checkout and its installed Node dependencies. `JING_SRC` can override its contracts directory. The Lazer helper uses the public route without `PYTH_API_KEY`. The default node is `http://77.42.3.101/stacks-api`; `STACKS_API_URL` overrides it.

```sh
node simulations/stxer-ccd016-v2-emergency.cjs --recovery
node simulations/stxer-ccd016-v2-coverage.js
node simulations/stxer-ccd016-v2-happy-path.js
node simulations/stxer-ccd016-v2-parked.js
node simulations/stxer-ccd016-v2-clock-keyless.js
node simulations/stxer-ccd016-v2-emergency.cjs
node simulations/stxer-ccd016-v2-emergency.cjs --native
```

Vault recovery source base: `d753101`; Jing source checkout: `24f3e23`.

## Exact recovery-matrix source hashes

| Contract | SHA-256 |
| --- | --- |
| `jing-core-v6` | `53c9b38a46196f777b3c76f76152c172aa50c220e4e8e449d47cb6cd3fe9ab32` |
| `jing-ladder-v1` | `99a6e9f6db9305ebb29d938e69439c720e497bd38c53ec8b447c8c34c528a902` |
| `markets-sbtc-stx-jing-v6-3` | `04b0a7df781aec46124d40d3c73c68169aeed919fed155ec5bf12153bb0bfb85` |
| `swap-router-sbtc-stx-jing-v5-3` | `dfc8165bb846c1e6bb2a95f1e3ac87d3a22bce0e5f2a8f6618a499c8a03f8cae` |
| `ccd015-redemption-book-mia-stx` | `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f` |
| `ccd016-swap-vault-mia-v2` | `84b6435449e83e123f2589801451ab441009c903165a9383eee96780c3f35814` |
