# Rendezvous verification of the final CityCoins contracts

The active harnesses target the final vault SHA-256
`ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e`
and book SHA-256
`b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f`.
Builds reject changed production source bytes. No production contract is edited.
All fixtures and manifests are self-contained in this checkout.

## Commands

```bash
npm run rv:ccd016 -- --seed=20261105 --bail
npm run rv:final:invariant -- 20261105 1000
npm run rv:final:test -- 20261105 1000
bash tests/rv/run-book.sh 20261105 1000
```

The checkout has no `rv:ccd015` package script. The last command is its working
equivalent; a proposed script is `"rv:ccd015": "bash tests/rv/run-book.sh"`.
No package change is required to run it and none was made for this refresh.
`bash tests/rv/build.sh all` builds the book and basic vault projects without
fetching the sibling Jing repository or using the old root manifest.

For an already built final vault, `RV_NO_BUILD=1` reuses its generated project.
Do not rebuild the same project while a sweep is running. `run.sh` retains full
logs in `ccd016-final/.build/logs/` and writes statistics to
`ccd016-final/results/`. `summarize.py` records source hashes and rejects logged
runtime exceptions; RV itself can ignore those while reporting success.

## Jing sources and test-only changes

The market is the complete deployed **markets-sbtc-stx-jing-v6-4**, replacing the
older adapted market. Pending deposits/limits and the final no-update deposit
signatures now execute directly. No fake escrow map or compatibility wrappers
remain. Deployed hashes and metadata are shared with [the vault suite](../vault/README.md).
The mainnet sources and local Jing sources have identical executable tokens;
exact deployed bytes are vendored so runtime testing needs no network.

The normal vault command includes an additional integration suite through the
complete deployed **swap-router-sbtc-stx-jing-v5-5**, with explicit venue splits,
smart routing, real Jing book capacity/settlement and router balance assertions.
The final RV suite deliberately retains an **adversarial router double** with
the final router API: it can ignore per-leg floors and pay a sub-floor output.
Replacing it with a healthy router would lose the tests of the vault's own
post-trade floor guard. Its result is not claimed as fuzz coverage of router
internals; the full source integration is reported separately.

`ccd016-final/build.py` rebinds only dependencies in the market, then calls its
real initializer with local assets and 100-unit deposit minima. It retains the
market's production 50-slot capacity. Core logging, ladder, token ledgers and
oracle feeds are fixtures. The final vault gets its harness appended and a
DAO helper that accepts the deployer or a scoped harness flag. The default
patience window is now the production **288 blocks**, with no default rewrite.
The harness uses the real configuration setters to explore other windows.

The fee oracle charges actual fixture STX and records the payer. Its new
read-only decoder supports v6-4's age-aware capacity getter. The strict FT fixture
records vault outflows; MIA's mock ledger has explicit burn accounting. The
adversarial router honors aggregate min-out while varying fill and price quality.
DAO authenticity, signed Pyth validation and real AMM liquidity are outside RV.

## Invariants and properties

The final harness retains **16 invariants**: output floors, no vault-initiated sale
inside patience, allowed STX/sBTC destinations, fee payer and budget, finish
reserve, clock transitions, treasury flows, token/STX conservation, window
exclusivity, no-clock state, clock bounds, configuration bounds, resting peg and
cleared DAO flag. `update-context` checks transitions after successful actions.

The resting-peg model now remembers the spread selected at placement/refloor;
it checks pending deposit/limit tuples as well as live orders. This replaces the
obsolete expectation that every order has zero spread. The placement property
still checks the exact configured spread, floor, zero remaining wallet sBTC and
conservation, including when v6-4 holds the new deposit in escrow.

The **10 properties** retain router/split/DIA/take floors, placement, recall,
funding clock, fee payer, finish reserve and patience restrictions. A property
returns `(ok false)` only when its preconditions cannot exercise the action;
these draws are reported separately as discarded, not passing assertions.
Random naturals are bounded by harness actions rather than covering all uint128.

## Self-contained book fuzz

`build-book.py` includes only the final book, MIA ledgers and required traits.
Its generated manifest is `tests/rv/.build-book/Clarinet.toml`. The only book
rewrites are dependency principals, the local deployer authorization gate and a
1000-micro-MIA minimum so small fuzz values can create offers. Seven invariants
check sorting, MIA/STX conservation, burn accounting, unique owners, capacity
and positive bounded entries. The build does not pull or write any Jing files.

## Saved results

Seed **20261105**, 1,000 draws per suite:

| Suite | Result | Evidence |
| --- | --- | --- |
| Basic vault invariants (8) | 1,000/1,000 | [vault run](../vault/results/rv-20261105.json) |
| Final vault invariants (16) | 1,000/1,000 | [statistics](ccd016-final/results/invariant-20261105.txt) |
| Final vault properties (10) | 986 passed, 14 discarded / 1,000 draws | [statistics](ccd016-final/results/test-20261105.txt) |
| Final book invariants (7) | 1,000/1,000 | [book run](results/book-20261105.json) |

All completed runs have zero runtime exceptions. The 14 property discards were
`test-jing-take-floor` draws without an executable fill.

RV selects one invariant per random sequence; 1,000 passing runs do not mean
16,000 invariant evaluations. Historical files from earlier seeds remain as
archives, with their original hashes, and are not evidence for today's sources.
The legacy root-level vault invariant/mock files are no longer selected by
`build.sh`; active vault commands use `tests/vault` or `ccd016-final`.
