# CCIP-028: Direct Execute activation

This package connects MiamiCoin's sBTC rewards to an STX-denominated redemption book that burns the MIA it purchases.
Deploy the book, vault and activation proposal from the same address, then have the existing DAO approvers signal the proposal through Direct Execute.
The proposal requires no tokenholder ballot and preserves Direct Execute's approval threshold and sunset.
It initializes a formula-based par, enables treasury funding for the vault, and fixes the launch configuration with a zero Pyth fee budget.
After activation, anyone can submit the funding, conversion and redemption calls; recurring execution still needs a caller or runner.

## Review and deployment artifacts

| Deploy order | Source | Purpose |
| --- | --- | --- |
| Book | `contracts/extensions/ccd015-redemption-book-mia-stx.clar` | Pays STX for MIA offers at or below par, cheapest first, and burns the acquired MIA |
| Vault | `contracts/extensions/ccd016-swap-vault-mia-v2.clar` | Converts treasury sBTC through Jing and forwards STX only to the book |
| Proposal | `contracts/proposals/ccip028-activate-mia-fair-redemption.clar` | Activates the book and vault through the existing DAO |

All three must use the **same deployer**, retaining these contract names.
Relative references bind the vault's destination and the proposal's targets to that deployer.
The DAO and rewards treasury are fully qualified mainnet references at
`SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH`.
The existing vault binds to `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4`
and `.swap-router-sbtc-stx-jing-v5-5`.
The test manifest compiles the book, vault and proposal as Clarity 6;
the existing DAO, Direct Execute and treasury policies run as Clarity 2.

Book SHA-256: `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`.
Vault SHA-256: `ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e`.
The vault's comments were refreshed (maker spread +1 bp, 0.01 sBTC chunk); code is
unchanged from the reviewed version. The executable defaults
and explicit activation values below are authoritative.

## What the proposal does atomically

- Requires **both** `contract-caller` and `tx-sender` to be the mainnet `base-dao`.
- Rejects a book whose par has already been initialized, including activation
  through a separately deployed copy of the proposal.
- Enables **only CCD016** as a DAO extension, which lets its fixed funding path
  withdraw sBTC from the rewards treasury. This is a DAO extension authorization,
  not a token-scoped capability: review the deployed vault's complete code before granting it.
- Ensures the rewards treasury allows the sBTC token. An existing allowance is harmless.
- Sets the launch parameters below, snapshots par using CCD015's own formula,
  and unpauses the book.
- Does not transfer funds or perform swaps. An empty rewards treasury or unavailable
  price feed does not prevent activation. A failed initialization rolls back all
  changes, the DAO execution record and the final approver signal.

Neither the book nor the proposal receives permanent DAO extension privileges.
The old CCD013 ratio, treasury principal, existing offers and governance approvers
are not modified. Existing offers must be cancelled and reposted by their owners
if they want to use the new book.

| Setting | Activation value |
| --- | --- |
| Maker window | 288 Bitcoin burn blocks |
| Placement floor leeway | 1,000 bps (10%) |
| Router slippage | 100 bps (1%) |
| Router chunk cap | 1,000,000 sats (0.01 sBTC) |
| Maker spread | +1 bp over the mid |
| DIA agreement band | 1,000 bps (10%) |
| Router cooldown | 1 Bitcoin burn block |
| DAO-only no-Pyth emergency slippage | 1,000 bps (10%) |
| Pyth fee budget | **0 micro-STX**, matching the zero-fee launch assumption |
| Minimum offer | 100,000 MIA (`u100000000000`) |
| Par | Snapshot of mining treasury + PoX-5 staking backing, divided by combined MIA v1/v2 supply |

## Approver handoff

Before deploying, confirm the referenced mainnet contracts and active Clarity
version/epoch support these exact sources. Record the chosen deployer and the
hash of each deployed source. Verify the deployed proposal targets the intended
book/vault, the book's par is still zero, and the Pyth fee is still zero.

Before signaling, read `get-signals-required` and `is-approver` on
`SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd001-direct-execute`, and verify its
`sunsetBlock` is still valid under that deployed contract's block-height semantics.
Also confirm Direct Execute is enabled in `base-dao.is-extension`.
The tests use three distinct approvers from five; the production proposal does
not assume or change those numbers. The mainnet-fork rehearsal below confirmed
the live 3-of-5 configuration and an open sunset at its pinned block. Recheck
these settings immediately before deployment/signaling.

Each authorized approver signs this exact call using their own wallet:

```text
contract: SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd001-direct-execute
function: direct-execute
argument: '<DEPLOYER>.ccip028-activate-mia-fair-redemption
```

`<DEPLOYER>` is a transaction-entry placeholder, not a source replacement.
Do not call the proposal's `execute` directly. The threshold-reaching signal
causes CCD001 -> base-dao -> proposal.execute automatically. Duplicated signals
do not increase the count. After success, verify `base-dao.executed-at`, the
vault's extension status, treasury sBTC allowance, book par and vault configuration.

## Permissionless operation after activation

| When | Call | Effect |
| --- | --- | --- |
| Staking contract holds rewards | Existing CCD014 `forward-rewards` | Moves sBTC to the rewards treasury |
| Rewards treasury holds sBTC | CCD016 `fund-from-treasury` | Pulls treasury sBTC and opens/joins a batch according to the vault clock |
| Maker window is open and vault holds sBTC | CCD016 `jing-place(update)` | Places a pegged ask at mid + 1 bp, subject to its floor |
| Window elapsed and order remains | CCD016 `jing-reclaim(some update)` | Returns remaining book sBTC to the vault |
| Window elapsed and vault holds sBTC | CCD016 `router-swap(update)` | Sells a bounded chunk at the oracle-derived floor; repeat as needed with cooldown |
| Vault holds STX | CCD016 `fuel-fair-book` | Transfers STX to CCD015 |
| Book has STX and eligible offers | CCD015 `cross-book` | Pays sellers and burns the acquired MIA |

Fetch a current signed Pyth Lazer update for price-bearing calls. A price or
liquidity failure is a reason to retry later, not to lower guards automatically.
No keeper receives a key or destination-setting privilege. DAO-only recovery
and configuration changes require a separately authorized proposal.

## Verification

```bash
npm ci
npm run test:ccip028
```

Requires Python 3 and Node.js compatible with the pinned Clarinet SDK.
Eight Vitest integration cases cover direct/proxy authorization, a 3-of-5 signal
sequence, duplicate signals, activation with/without rewards, replay protection,
reinitialization refusal, sunset enforcement, atomic rollback/retry, retained
admin gates and the funding -> maker placement -> window expiry -> router swap ->
STX book -> MIA burn flow.

The suite runs complete local DAO, Direct Execute and treasury-v3 sources with
their real authorization logic. It runs the complete book, vault and proposal,
rebinding mainnet principals to test dependencies in generated files only.
The treasury's asset allowlist and withdrawal checks are real; the sBTC/MIA
ledgers are fixtures, with explicit minting and real transfer/burn accounting.
The market, router, oracle and backing balances are fixtures. This suite does
not claim to exercise live AMM liquidity, the live signers or mainnet state.
Source hashes are emitted into `tests/activation/.build/source-hashes.json`.

## Mainnet-fork activation rehearsal

[stxer run: d45fb46db676464d470f9c016a7cf5d4](https://stxer.xyz/simulations/mainnet/d45fb46db676464d470f9c016a7cf5d4) — **47/47 checks passed**.
Parent Stacks block **9421465**, hash
`0x8fbe7956a7f2ffc3d3ee59e466c365c6a305e63667193852ea2c150bf8fd0acf`; the result artifact records the full block metadata,
source hashes, signed Pyth updates and transaction receipts.
Both checkouts also passed **8/8** local activation tests with 10% leeway.

Book, vault and CCIP-028 were deployed from
`SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22` using exact repository bytes.
All five real approvers were recognized by the live Direct Execute contract;
the simulated signals from `SP7DGES…`, `SP3YYGC…` and `SPN4Y5Q…` activated the
proposal on the third signal. The vault remained disabled after the first two.
No DAO, treasury, token, oracle, market or router code was patched, and no
privileged state was injected through Eval. Eval steps only read state.

| Assertion | Observed result |
| --- | --- |
| Par | **2,042.49 STX per 1,000,000 MIA** |
| Rewards-v3 allows sBTC | Yes |
| Vault is a DAO extension | Yes |
| Book unpaused | Yes |
| Leeway / Pyth fee budget | 1,000 bps / 0 micro-STX |
| Placement and settlement | 100,000 sats rested on the live Jing market |
| Window expiry | 289 synthetic Bitcoin blocks, with the configured 288-block window unchanged |
| Reclaim and router swap | 100,000 sats reclaimed; 223.166660 STX received; 1 sat dust remained |
| Book funding | All 223.166660 STX forwarded to the book |
| Crossing and burn | Seller paid 100 STX; real MIA supply reduced by exactly 100,000 MIA |
| Remaining balances | 123.166660 STX in the book; 1 sat and 0 STX in the vault |

The rewards treasury was empty at the pinned block, so an existing sBTC holder
transferred 100,000 sats into it **on the fork**. An existing MIA holder offered
100,000 MIA for 100 STX. These are scenario inputs, not observed pending rewards
or a production redemption price. Both token balances and the MIA burn use the
real mainnet contracts. The placement required the market keeper's separate
`settle-token-x-deposit` call before the deposit rested.

The simulation uses unsigned impersonated senders; it is not evidence of actual
approver consent and moves no mainnet assets. The 289 synthetic burn blocks use
one-second intervals so real signed Pyth updates remain usable. This exercises
the full block-height expiry but does not model two days of price changes or
liquidity changes. The onchain DIA state and signed Pyth updates were used without
an oracle override.

Re-run from the repository root with Node.js and `stxer` 0.8.0 or compatible:

```bash
node simulations/stxer-ccip028-activation.mjs
```

Optional `SIM_BLOCK_HEIGHT` pins a chosen recent parent; the default is the latest
API height minus 600 Stacks blocks. Fresh signed Pyth updates and live liquidity
can change the amounts on a new run. `SIM_RESULTS_DIR` selects a separate output
directory; the default artifact is
`simulations/results/ccip028-activation/result.json`. Historical raw updates and
receipts are retained there for inspection, not guaranteed replay at a new block.

## Upstream review

Code target: **https://github.com/citycoins/protocol**, base **main**.
The existing governance discussion is https://github.com/citycoins/governance/pull/53.
That text describes the earlier RFQ design and must be reconciled with the
maker-first Jing book/router implementation before this activation is approved.
The implementation itself requires no tokenholder voting module.
`docs/ccip028-pr.md` is the prepared PR description; no commit, push or PR creation
is performed by this package.
