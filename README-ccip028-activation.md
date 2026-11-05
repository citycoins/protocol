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
not assume or change those numbers. A live mainnet preflight/fork rehearsal is
still required before deployment/signaling; the new test results below are local simnet results.

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

## Upstream review

Code target: **https://github.com/citycoins/protocol**, base **main**.
The existing governance discussion is https://github.com/citycoins/governance/pull/53.
That text describes the earlier RFQ design and must be reconciled with the
maker-first Jing book/router implementation before this activation is approved.
The implementation itself requires no tokenholder voting module.
`docs/ccip028-pr.md` is the prepared PR description; no commit, push or PR creation
is performed by this package.
