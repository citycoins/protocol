# CityCoins vault v2 runtime coverage and Rendezvous fuzzing

Latest Clarinet runs (2026-10-14): the vault suite passes **313 assertions**;
the new standalone redemption-book suite passes **21/21 public functions**,
**29/29 instrumented functions**, and **72/72 branches**. Eight prior RV
invariants, two seeds: **2,000/2,000 checks passed**, **zero falsified
invariants**, **zero runtime exceptions**, **72 completed emergency batches**.
These complement
[423 real mainnet-fork checks](../../simulations/README-ccd016-v2-verification.md).
No contract bug was found; finite testing is not a proof of universal correctness.

## Run

```bash
npm ci
npm run test:vault
npm run test:book
npm run rv:vault:build
npm run rv:vault -- --seed=20260918 --bail
npm run rv:vault -- --seed=20260919 --bail
```

Versions: Clarinet SDK **3.21.0**, Rendezvous **1.0.3**, generated contracts
Clarity **6**, epoch **4.0**. The generated `.build` and `.build-rv` projects are
ignored and regenerated from current source. `rv:ccd016` now builds/runs this harness.
RV 1.0.3 calls a private `update-context`; the old book callback is adjusted for
that test-tool API. All production source remains untouched.

## Source and dependencies

`build.py` reads both entire current production contracts and records SHA-256:
vault `e3437fcfe248b46e11ffee8b37e88d227211387afca099db1502c8b231133720`,
fair book `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`.
It rewrites mainnet dependency addresses and allowance asset names to fixtures.
The actual vault gates, price arithmetic, routing arguments, clocks and
`close-if-empty` logic are unchanged in runtime tests. The fair book is the full
current source, not a placeholder STX sink; its MIA tokens/backing accounts are
fixtures. The local DAO authenticates exact `contract-caller` extension identities;
runtime tests enable only the deployer test actor and reject strangers. Real DAO
proposal execution is separately verified on the keyless-clock fork.

Fixtures are vendored from the Juice vault verification committed in
`Rapha-btc/juicestx@3811307`, plus this repo's existing treasury/MIA fixtures.
The Jing v6 market fixture contains the prior RV adaptations: initialized mock
assets/feeds, six depositors, oracle/core/ladder fixtures and test actions. It
is not the production AMM/router and its branch coverage is not claimed here.
One strict FT ledger stands in for sBTC/wSTX: explicit minting and real ledger
transfers, no implicit balance top-ups. The MIA fixture may auto-mint; MIA
conservation is outside this vault suite. The treasury fixture withdraws without
its own DAO gate; real treasury access is covered by forks. `mock-router` sells
at the fixture mid, enforces overall minOut, rejects missing liquidity when
minOut is positive, and transfers actual FT/STX; it does not model per-AMM pools
or independently enforce each leg's minOut. Forks cover the real router/AMMs.

The builder adds market-only park/forced-zero-mid helpers. The FT fixture can
reject a configured recipient to verify rollback. These fault controls are
not production contract changes. The maker-fill test sets the market fixture's
STX minimum to 1 STX (matching fork initialization) so fill-or-kill rounding
has realistic dust tolerance. No test modifies the source vault's guards to
force a branch outcome.

## Runtime cases and coverage

`runtime.mjs` tests every setter's unauthorized/capped/allowed outcomes, window
zero, no-clock paths, direct donations then first treasury pull, top-ups that do
not restart a live clock, maker placement, DAO refloor in both phases, zero-spread
orders, community/DAO reclaim, parked reclaim, recall, and public STX forwarding.
It also tests taking from a resting bid, external maker sell-out and public close,
exact patience expiry, valid required-Pyth split, shared cooldown with emergency,
zero/over-balance/chunk/split guards, stale/divergent/disabled DIA band, forced zero
market mid, DIA 7,200/7,201-second boundary, response-error/zero-price fallback,
native error/zero/one values, price/floor rounding to zero, minOut rejection,
recipient-transfer rejection, atomic balance/clock/cooldown rollback and full drain.
The SDK coverage gate for this source is **118/119 branches**, **450/473
lines**, and **46/46 functions**. Its only missed branch is the below-floor
router outcome at vault line 622, which the mock router rejects before the
vault receives a result. Zero-hit line counters are recorded in
[`runtime.json`](results/runtime.json); they are not additional uncovered
branches.

## Redemption-book Clarinet coverage

Run the book-specific Clarinet SDK suite with:

```sh
npm run test:book
```

It source-pins `ccd015-redemption-book-mia-stx` at commit `a9a6bd6` and SHA-256
`b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`. The
suite passes **21/21 public/read-only functions**, **29/29 instrumented
functions**, and **72/72 branches**; line coverage is **211/213 (99.06%)**.
The two unhit line counters are the literal token contract principals at source
lines 373 and 375 inside `get-mia-total-supply`; the function and both token
calls execute, but Clarinet does not attribute line hits to those static
operands. The suite exercises authorization, offers, sorting, cancellation,
pause/funding, eviction, partial and full fills, and rounding guards. Detailed
machine-readable results are in [`ccd015-book-runtime.json`](results/ccd015-book-runtime.json)
and [`ccd015-book-runtime.lcov`](results/ccd015-book-runtime.lcov).

[Runtime results](results/runtime.json) and [target-only LCOV](results/runtime.lcov)
contain the vault source hashes and measurements. The report lists 23 source
line counters without hits, including the single uncovered branch at line 622;
these line counts are distinct from the measured **118/119 branch outcomes**.
No claim is made that every possible error-propagation path or uint128 input
was covered.

## Fuzz actors, actions and invariants

RV uses the same source/fixtures but rewrites **only the vault DAO helper** to a
strict deployer `tx-sender` gate (one actor in ten). Real DAO gates are retained
in runtime tests and forks; RV is not evidence for production DAO authenticity.
Wrappers explicitly mint donations/treasury rewards, fund router STX, vary DIA
skew/staleness/error and native error/zero price, and run bounded privileged calls.
`rv-batch` uses real vault setters to set zero patience/cooldown, sets the emergency
tolerance to 50%, funds when needed, drains the full liquid sBTC balance through
`router-swap-split-dia`, then forwards STX through `fuel-fair-book`.
CityCoins permits its DAO window setter during a batch, so no test-only expiry
bypass is needed. Failed calls are expected guard outcomes; runtime panics were
checked separately in both logs because RV can log them without failing a seed.
Random direct uints use RV's default small-natural strategies, not all uint128 values.

Eight invariants: window flags exclusive; no clock/no window; clock not in future;
cooldown not in future; bounded config (window zero allowed); correct positive
DIA/native emergency floor; resting order remains a guarded zero-spread peg;
FT supply equals the summed vault/treasury/market/router balances. That holder
set is complete for this harness's successful token-moving actions, not all
possible external users. RV chooses one invariant after each random command
sequence: 2,000 runs mean 2,000 checks, not 16,000 checks. `rv-batch` contains
multiple successful internal calls, counted as one public wrapper invocation.

| Seed | Passed checks | Completed batches | Successful public calls | Failed invariants | Runtime exceptions |
| --- | --- | --- | --- | --- | --- |
| 20260918 | 1,000 | 43 | 1,427 | 0 | 0 |
| 20260919 | 1,000 | 29 | 1,418 | 0 | 0 |

See [seed 20260918](results/rv-20260918.json),
[seed 20260919](results/rv-20260919.json) and matching text summaries.
