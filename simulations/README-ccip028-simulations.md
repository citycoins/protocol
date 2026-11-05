# CCIP-028 mainnet-fork simulations (stxer)

Both runs fork Stacks mainnet, deploy the exact repository sources and move no real funds.

| Scenario | Result | Mainnet fork | Saved report |
| --- | --- | --- | --- |
| CCIP-028 activation + full cycle | 47/47 | [Stxer](https://stxer.xyz/simulations/mainnet/d45fb46db676464d470f9c016a7cf5d4) | [result.json](results/ccip028-activation/result.json) |
| CCD016 maker spread on the live Jing v6-4 market | 55/55 | [Stxer](https://stxer.xyz/simulations/mainnet/423a4aef56bfe9afa6263ece17c1769e) | [maker-spread.json](results/ccd016-v2/maker-spread.json) |

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
on those live-state preconditions; the saved run is the reference.
