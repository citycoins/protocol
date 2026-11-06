# Final CityCoins vault/book local tests

All commands below read the final production contracts without editing them.
The Jing market fixture is now the complete deployed **v6-4** source, with real
pending deposits and limits; the former compatibility entrypoints and fake empty
escrow map are gone. `test:vault` also runs the complete deployed **v5-5** router
against funded AMM fixtures, in addition to the existing fault-double checks.

The final-source runs have no failed assertions or runtime exceptions. The
property sweep has 14 documented precondition discards; see the
[complete result summary](results/final-summary.json) and [RV results](../rv/README.md).

## Run

```bash
npm run test:vault
npm run test:book
npm run rv:ccd016 -- --seed=20261105 --bail
python3 tests/rv/summarize.py tests/vault/results/rv-20261105.log tests/vault/.build-rv/source-hashes.json tests/vault/results/rv-20261105
npm run test:ccip028
```

To keep the RV log for the summarizer, redirect the RV command's stdout/stderr to
`tests/vault/results/rv-20261105.log`. The summarizer fails on a runtime exception,
even when Rendezvous itself reports passing invariants. Runtime and router JSON
results are emitted automatically by `test:vault`.

Uses Clarinet SDK 3.24.1, Rendezvous 1.0.3, Clarity 6 and `epoch = "latest"`.
All generated projects are under `tests/`; no sibling checkout or network is
needed to run the suites. The upstream Jing sources were verified against mainnet
when vendored; their executable tokens also match the sibling Jing checkout.

## Pinned source bytes

| Contract | SHA-256 |
| --- | --- |
| CCD016 vault | `ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e` |
| CCD015 book | `b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f` |
| Jing market v6-4, deployed bytes | `6b3e6943806350daace1498b6b923479cf61b1f555e814f9a01d5db972f436bf` |
| Jing router v5-5, deployed bytes | `6b65927e564d0bc3df239c5b872b45358f4349e2ec652cf8198e36fd4f3dac7c` |

Market and router live at `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22` under
`markets-sbtc-stx-jing-v6-4` and `swap-router-sbtc-stx-jing-v5-5`.
`fixtures/upstream/sources.json` records the deployment metadata. The market's
exact source is `fixtures/v6-market.clar`; the router's is under
`fixtures/upstream/`. `jing_sources.py` verifies both before any build.

## Test configurations and limits

`build.py` rebinds dependency principals and allowance names. The complete
production vault and book retain their business logic; runtime tests retain the
vault's DAO gate with a controlled extension registry. The market uses its real
initializer with mock assets, feeds 1/45 and local minimum deposits of 100 atomic
units; tests set other minima explicitly where needed. Core logging, ladder
membership, oracle verification, tokens, treasury and DIA are local fixtures.
Market admission, settlement, crossing, rebates and pending escrow are real
v6-4 logic. Deposit-Y calls now use the final signature and settle pending
orders with a separate call.

The runtime fault configuration reuses the existing adversarial `mock-router`
from `tests/rv/ccd016-final/mocks/mock-router.clar`. Its default knobs fill at
mid; the floor regression sets a partial fill below the permitted price. The
basic RV build retains its original healthy router double. These allow tests of
min-out failures and rejected transfers that a healthy route would avoid. The
market-only park/forced-zero-price controls are retained for vault recovery
branches. These are disclosed fault injections, not evidence of live venue
behavior. MIA may auto-mint for arbitrary fuzz sellers; sBTC uses a strict ledger.

`build-live-router.py` creates a separate `.build-live-router` project with the
full v5-5 router replacing `mock-router`, and the full market without those fault
controls. Only router dependency principals and asset names are substituted.
`live-router.mjs`, run automatically by `test:vault`, exercises smart routing,
explicit DLMM/XYK/Velar splits, the DIA fallback path and a trade through the real
v6-4 book. It asserts proceeds, the vault's floor, book funding and no balances
left in the router. AMM reserves and swap implementations are finite, prefunded
fixtures; this is not a mainnet liquidity simulation.

RV uses the final vault with test actions appended and its DAO helper replaced by
a deployer gate. The production 288-block window is retained. The basic harness
uses real setters to advance batches, checks conservation and preserves the
configured maker spread. `dao-reclaim` wrappers now pass the required optional
update. See [the final property harness](../rv/README.md) for adversarial tests.

## Results from the final-source refresh

| Suite | Result | Evidence |
| --- | --- | --- |
| Vault runtime | 349/349 assertions | [runtime.json](results/runtime.json) |
| Full deployed router integration | 60/60 assertions | [live-router.json](results/live-router.json) |
| Book SDK suite | 1/1 Vitest integration test; 21/21 public/read-only functions | [ccd015-book-runtime.json](results/ccd015-book-runtime.json) |
| Basic vault RV, seed 20261105 | 1,000/1,000; zero runtime errors | [rv-20261105.json](results/rv-20261105.json) |
| CCIP-028 | 8/8 | [activation result](results/activation.json) |

Vault runtime coverage: **121/121 branches**, **463/485 line counters**; see
[runtime.lcov](results/runtime.lcov). The adversarial-router regression covers
the second `ERR_BELOW_FLOOR` assertion in `router-swap` (line 647): of a
20,000-sat chunk, 10,000 sats sell for 123,650 micro-STX, exactly one below the
123,651 floor after the 8-sat allowance. The vault rejects with `err u16047`;
all asset balances, batch state and the cooldown stamp remain unchanged.
An above-floor partial fill succeeds in the same burn block, confirming the
failed transaction did not consume the cooldown.

The remaining 22 "uncovered" lines are continuation lines of multi-line
expressions: payload/minimum-output tuples, literal principals and contract
function names. The line counter does not attribute hits to these lines even
though their containing expressions execute; they are not unexecuted code.
Book coverage remains **72/72 branches**, **29/29 instrumented functions**,
**211/213 line counters**. The two unhit counters are static token principal
operands; both token supply calls execute. These coverage figures concern the
vault/book, not complete market/router coverage.

Historical result files remain archived with their original source hashes. They
are not substituted for these final-source runs. Failures encountered during the
refresh were test setup: old logging signatures, the missing read-only Lazer
decoder, old deposit arity, a zero-spread assumption, and `dao-reclaim`'s missing
optional argument. Assertions were retained or updated to the final API/behavior;
the actual router integration adds coverage rather than replacing fault tests.
