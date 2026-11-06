# CCD016 swap vault v2: sBTC rewards to STX, nobody holds a key

Decision record for `ccd016-swap-vault-mia-v2.clar` v0.3.0 (2026-09-12).
Draft, unaudited, not deployed. It binds the NEXT Jing stack, itself under
audit bounty `mtxs6nxg7a6d97081b11` (aibtc.com): `markets-sbtc-stx-jing-v6`
(pegged orders), `swap-router-sbtc-stx-jing-v5`, `jing-core-v5`, source at
github.com/Rapha-btc/jing-contracts-v3. Deploy order: that stack, then the
ccd015 STX book, then this vault at the same deployer as the book.

## What it is

A contract that holds the DAO's sBTC rewards and can do two things with
them: sell sBTC for STX and send the STX to the ccd015 redemption book, or
send the sBTC back to the rewards treasury (`dao-recall-sbtc`, by
proposal). No other destination exists. The price is never chosen by a
caller: Pyth Lazer signs it, the Jing market verifies it (80 s freshness,
confidence), and the vault refuses to act unless DIA agrees within
`dia-band-bps` (10%).

## v0.3.0: the peg, and who does what

- **Patience phase (window open, 288 burn blocks by default).** `jing-place`
  rests the sBTC on the book as a ZERO-SPREAD PEG: `deposit-token-x amount
  floor (some u0)`. The order sits at the settlement mid whatever the mid is,
  every settlement, with no one repricing it (the keeper of v1 and the
  reprice call of the first v2 cut are gone). The floor is `mid * (1 -
  leeway)` at placement: under it the order is off for that settlement, not
  filled at the floor. As a resting maker the vault pays the 10 bps book fee
  and collects the 20 bps taker rebate. Nothing can sell the vault under the
  mid while the window is open: `jing-take` is liquidation-only now.
- **Liquidation phase (window elapsed).** `jing-reclaim` brings the sBTC
  home; `router-swap` sells through the smart router (book, Bitflow DLMM,
  Bitflow XYK, Velar, split at execution) at `mid * (1 - slippage)`, 0.05
  sBTC per call, whatever no venue takes inside the floor comes home.
- **Community, three steps and nothing else:** `jing-place` while the window
  is open (in chunks until every sat rests), `jing-reclaim` then
  `router-swap` once it elapsed, `fuel-fair-book` whenever STX sits here.
- **DAO only (proposal):** `jing-refloor` (moves the guard to a fresh mid,
  live or parked, `set-token-x-limit`, no crossing allowance needed),
  `jing-take` (fill-or-kill at the floor, no chunk cap: the book settles at
  the oracle mid), `router-swap-split` (manual venue split), the settings
  (window, leeway, slippage, DIA band, chunk cap) and the recall.
- **Nobody:** the price and the destinations.

## Verification (stxer mainnet fork, real Lazer update, 2026-09-12)

`simulations/stxer-ccd016-v2-coverage.js` (`npm run sim:ccd016`,
`PYTH_API_KEY` required, `JING_SRC` points at the jing repo's contracts/).
The fork deploys core-v5, market v6 (one sim-only patch: `MAX_STALENESS`
widened so the single update survives the block advance), router v5, the
ccd015 STX book and the vault under chavita; base-dao is patched so
`is-extension` is true for the vault (treasury withdraw) and a proxy that
plays a passed proposal; DIA is impersonated from its updater key with the
Lazer prices.

| Simulation | Result | Covers |
|---|---|---|
| `8821da4c7e090564582a4fbfa62c3476` | 61/61 | fund-from-treasury opens the window; jing-place in two chunks rests `(some u0)` with floor = mid - 5% and price = mid; take / router-swap / reclaim refused while open, refloor DAO-only and working, setters gated and range-checked; a 100 STX taker fills the vault at the mid with the exact STX received (net - 10 bps + the whole rebate) and the peg rolls with its rule; fuel-fair-book moves exactly that to the book; the window elapses by proposal + block advance; reclaim by anyone; router-swap by anyone at the floor (pools), chunk cap enforced; a DAO take against a resting bid fills at the mid; recall to the treasury by proposal only; idle at the end |
| `5df232a3282ec928cfb1b6536fe7b3d0` | 58/61 | 2026-09-13 rerun against jing v6 at `b606103` (the deploy set after bounty mtxs6nxg7a6d97081b11: parked-swap refusal, sentinel skips, switched-off refusal, `distance-slots` with the N-best-prices region, demotion and one park path). No contract change here: the vault only calls deposit / cancel / withdraw / readmit and the router's swap, whose signatures are unchanged, and it already treats a parked position as resting. Every vault-on-book step is green. The three misses are S7 "router-swap 300k sats at the floor (book empty: pools)" and the two checks that follow it: the router's `u3002` min-out guard, because the AMM pools at that day's fork tip could not return the vault's floor for 300k sats. Same 58/61 with the same three misses on the pre-bounty source `f04ebb5` (`20e8e8246ee6e019e92c047ee6a57a56`), so it is the market, not the change. Rerun S7 on a day the pools sit near mid, or size it under the pools' depth at the floor |

| `b3c85f0afca647d9b0c4d88f38f6afa2` | 61/61 | 2026-09-14 rerun on the source at 32f4a63 (bounty round below: the clock opens only from an empty vault, `jing-place` places the whole balance, `is-empty`, `close-batch`), jing v6 at d9ee89e (the harness now deploys `jing-ladder` before the market, which reads it for the protected seats). S7 green again: the pools sat near mid |
| `04a15e2b93da4ee1c46d4910f716f911` | 60/60 | keyed rerun after `start-clock` was removed (below) |
| `f3db741b2f90addeb3de8dbdb4fa8c95` / `d1213248cdbcdcdaf8660b6602d56bba` / `214f5e18e78cdb35b6b5a8229a3f9373` | 49/49, 129/129, 67/67 | happy path, parked and keyless clock rerun on the cooldown build (9096f77), unchanged |
| `dc770f07957e63aead60cc8911e3b268` | 73/73 | keyed coverage with the router cooldown (section 2): a second `router-swap` in the same burn block is u16044, the next block is fine, `set-router-cooldown` gated (u16000) and capped (200 -> u16033), config shows cooldown 1 and the stamped height; S7b's book-leg sale runs a block later |
| `32235e8cebc74e21897cf5f8bec8d975` / `0f7a68fd8e9f90a547ac7f1aff58775b` | 96/96 / 52/52 | keyed coverage + happy path (`close-batch` on a batch the book sold out: the stale clock clears, then u16032), trace-driven gaps closed: every DAO dial over its cap and in range through the proxy (leeway, slippage, max-chunk, DIA band, cooldown), a stranger on each (u16000), `router-swap-split` (stranger u16000, mismatch u16040, a DLMM-only split sells with unsold 0, a second split in the same burn block u16044: the cooldown is shared), `jing-refloor` after the window (floor = mid - 1% slippage, not the 5% leeway), DIA band set to 0 before the take (the mid no longer consulted with DIA), no-clock paths (`jing-place` u16030, `close-batch` u16032, `callback`), `close-batch` while funded u16043, the read-onlys (`get-clock`, `get-config`, `get-status`) called through the proxy so their arms are traced. Trace report: `simulations/TRACE-COVERAGE-ccd016-swap-vault-mia-v2.md` (35 branch nodes, all full) |
| `e2e2c16bde757444d7c6e2aa92fb951c` | 66/66 | keyed coverage on jing d1b32bd, plus S7b, the router's BOOK leg from the vault: a 200 STX bid rests at the mid, `router-swap` 100k sats fills 67,914 of them on the book at the mid (the market settles one cycle, the bidder's sBTC balance grows by exactly that) and the remaining 32k in the pools, unsold 0, 293.66 STX home, `fuel-fair-book` |
| `6d4fa2cd2bd6c6af7b18052ada81075a` | 129/129 | `simulations/stxer-ccd016-v2-parked.js` (`PYTH_API_KEY`), the vault PARKED on the v6 book, on jing d1b32bd (v6 parks, never refunds, on a full side; since 2026-09-14 an in-range resident is parked only by a bigger IN-RANGE newcomer when nobody is out of range, an out-of-range newcomer fights inside its own region: the first run of this harness, `9162be8e…` on the older market, had a 5,000-sat ask 2% off the mid park the vault's 1,000-sat peg AT the mid, which is the finding that led to the fix): the open region is 40 makers (50 minus the 10 seats reserved for band rungs); 39 fillers rest 2,000-sat zero-spread pegs, the vault rests 1,000 (the minimum), a 5,000-sat in-range peg arrives and the core's size rule parks the vault (status parked 1,000, resting 0, not empty); the DAO reclaims the parked amount mid-window; `jing-place` again with the smallest size on the full in-range side is u1010, lands once a filler cancels; a fresh in-range 5,000 parks it again; Sonic Mast's case: a stranger's `readmit-token-x(vault)` is u1010 while full, lands once a filler cancels, and only puts the peg back at the mid (harmless); parked a third time, the window elapses, `jing-reclaim` by anyone brings the PARKED amount home, `router-swap` sells it, empty, clock cleared |
| `300972c447b57a5f486942d0d5c52b5b` | 49/49 | `simulations/stxer-ccd016-v2-happy-path.js` (`PYTH_API_KEY`), the HAPPY PATH twice: batch 1 funded (window opens), placed, a 400 STX taker buys the whole 100k-sat batch at the mid in the patience phase (a second maker rests 1M sats at mid + 1% behind the vault, as a real book would; v6 refuses a partial fill), the vault is empty of sBTC with STX home, `fuel-fair-book` sends the STX to the book and clears the clock; batch 2 funded (a SECOND window, fresh batch-start), placed, a 1-sat funding while it rests opens nothing, the window elapses, `jing-reclaim` by anyone, `router-swap` by anyone sells the whole batch at the floor (unsold 0), the exit clears the clock, `fuel-fair-book`; batch 3 funded: a THIRD window opens, placed |
| `9d1f78cd39feb2416da23dba34e5b669` | 67/67 | `simulations/stxer-ccd016-v2-clock-keyless.js`, no Pyth key, the CLOCK alone: funding an empty vault opens (`opened true`), a top-up while open joins, elapse, 1 sat to the treasury + fund-from-treasury on the leftovers pulls the sat and opens nothing (still elapsed), close-batch refused while not empty (u16043), recall empties the vault and clears the clock, close-batch with no clock u16032, the next funding opens fresh, a plain transfer into the empty vault has no clock of its own (reclaim u16031) and joins the next funding, which opens, recall clears again; then the DIA escape hatch (steps 60-68): `contracts/proposals/ccip027-ccd016-dia-band-off.clar` deployed, a stranger calling its `execute` directly is refused by the vault (u16000), an enabled extension runs it through the real base-dao `execute` and the band goes 1000 -> 0, the same proposal again is refused by base-dao (u901, already executed), a restore proposal puts 1000 back |

## Property fuzzing (Rendezvous, 2026-09-15)

`tests/rv/` fuzzes the vault and the ccd015 STX book on the jing v6 fuzz
stack (the market with settlement live through a mock Lazer oracle, a mock
treasury, a mock router that buys at the mid, a mock DIA that echoes the
mid times a skew): random call sequences from ten accounts, invariants
checked after each. Book, 7 invariants (sorted, MIA and STX conservation,
burn matches the token, one offer per owner, bounded, entries in range),
500 runs, real movement on every path (place, change, cancel, cross-book,
update-par). Vault, 6 (clock flags, dials inside their caps, cooldown
stamp, the resting order is a zero-spread peg with a guard), 500 runs.
Zero falsified invariants. The vault's own book paths are thin under pure
randomness (the window elapses inside most runs); the fork harnesses above
cover those end to end. `npm run rv:build`, `npm run rv:ccd015`, `npm run
rv:ccd016`; details in `tests/rv/README.md`.

## What a liquidation looks like on chain, fee by fee (sim `e2e2c16b…`)

`router-swap` 100,000 sats by a stranger, a 200 STX bid resting at the mid
(tx `59f12386…` in the sim):

| leg | sats in | out | fees |
|---|---|---|---|
| Jing book, taker | 67,981 = 67,846 order + 135 taker escrow (20 bps) | 199.797884 STX | escrow split: 67 sats protocol fee (10 bps) + 68 sats rebate to the bidder; the bidder pays 0.199997 STX (10 bps) to the protocol; 0.002119 STX dust back to the bidder |
| Bitflow DLMM, bin 366 | 32,019 | 93.865825 STX | 160 sats pool fees |
| total | 100,000 | 293.663709 STX, unsold 0 | |

The market settles cycle 1 at the oracle mid, the bidder receives 67,914
sats (67,846 + 68), the protocol fee recipient 67 sats and 0.199997 STX.
Effective 340.5 sats per STX against a mid of 339.2: the book leg fills at
the mid and the maker pays the STX-side fee. The router log says it all:
`jing-in 67981, jing-out 199797884, dlmm-in 32019, dlmm-out 93865825,
xyk 0, velar 0, unsold 0`.

`jing-take` 50,000 sats by the DAO against the same kind of bid (tx
`0586a2f2…`): 49,900 order + 100 escrow in; cycle 2 settles at the mid;
the bidder gets 49,951 sats (49,900 + 51 rebate), the protocol 49 sats and
0.147096 STX; the vault gets 146.949184 STX; the bid's unspent 52.903720
STX rolls into the next cycle. 340.3 sats per STX.

## Audit bounty mu0oy1vzf432efb13c31 (10,500 sats, 2026-09-14): four submissions, verdicts, fixes

Source only, at `84451ea`+. Every finding was read against the source one at
a time. **Paid 2026-09-15 to Patient Reed / apeirs** (submission
`mu0zoma224a949991206`, SP3BB5BAT…), 10,500 sats sBTC, tx
`cda7ff2f60557491764e776286162883b80893fceb8caed81465ebe2e7a298c6`, bounty
status `paid`. Nothing here is deployed.

| # | Submitter | Finding | Holds | Rating filed | Decision |
|---|-----------|---------|-------|--------------|----------|
| 1 | Patient Reed / apeirs | `start-clock` re-arms the window for free after every elapse (it checked only "not idle" and "window not open"); same via 1 sat to the treasury + `fund-from-treasury`. Reclaim, router-swap and take stay u16031 forever: the permissionless liquidation never comes | yes | MEDIUM | **Fixed** (`32f4a63`, section 1). Leading submission: first, exact, with the fund path named. No funds at risk, the DAO could still reclaim or recall by proposal, but "nobody holds a key" needs the liquidation reachable by anyone. |
| 1b | Patient Reed / apeirs | LOW: a DIA outage (stale or absent push) makes `current-mid` fail, so `jing-place` cannot run and the patience window burns with nothing on the book | yes | LOW | **Accepted, dial exists.** `set-dia-band-bps 0` by proposal turns the DIA check off and trusts the market's Lazer verification alone (documented in the header; the proposal is written, `contracts/proposals/ccip027-ccd016-dia-band-off.clar`, executed through base-dao on the fork, `9d1f78cd…` steps 60-68); a 2-day window and DIA's 10-50 min cadence make a full burn unlikely. No change. |
| 2 | Celestial Mast | `fund-from-treasury` re-arms an expired window while the vault holds the old batch (22/22 fork run) | yes | availability | Duplicate of 1's second path, seven hours later. Same fix. |
| 3 | Glowing Key | `jing-place` is permissionless and rewrites the floor of the whole merged position from a caller-chosen Lazer update; for 1 sat anyone re-floors the batch at a dip mid × 0.95 and takes it at the dip. Fix proposed: a monotonic floor | yes, as read | MEDIUM-HIGH | **Rejected, by design.** The fill is at the market's verified mid, DIA-banded; nobody fakes the price and the taker buys a real dip like any taker. The floor is a policy guard ("do not sell into a wick"), not a security bound, and with the mid verified a lower floor only decides whether the vault sells at the real price or sits unsold, which is the job. A min on `jing-place` would only price the call and strand the last chunk. `jing-refloor` stays DAO-only: the 1-sat placement can wake a switched-off peg, but at least it takes the hassle. `jing-place` now places the whole balance (no amount argument), which was never needed. |
| 3b | Glowing Key | LOW: the stated Velar MEV bound (0.4% of a 0.05 sBTC chunk) is per `router-swap` call and there is no cooldown, so it is not bounded per batch | yes | LOW | **Fixed: a cooldown** (section 2). The bound is per chunk by construction (a sandwich only pushes a chunk to its floor and pays the venue fee twice), and Bitflow's 50 bps a side makes it break-even at the 1% floor; only Velar's 30 bps leaves 40 bps, and Velar is reached only after the book and DLMM ran out inside the floor. Without a cooldown a bot could chain chunks in one block to walk DLMM and XYK down to the floor and route the rest to Velar. Now one router sale per burn block. |
| 4 | Sonic Mast | Market `readmit-token-x` takes any `who`: anyone re-rests the vault's parked sats after the window elapsed, no DAO gate | yes | LOW-MEDIUM | **No change.** The peg fills at the verified mid, better than the liquidation floor, and `jing-reclaim` still works. Exercised on the fork (`6d4fa2cd…`, P4): the readmit puts the peg back at the mid and the elapsed reclaim brings the parked amount home either way. Whether the market should let anyone readmit anyone is a Jing question (bounty mu0ox53v1fae7181582b). |

### 1. The clock opens only from an empty vault (fixed 32f4a63)

Before: `open-window` set `batch-start` whenever no window was open, and
`start-clock` asked only "not idle" and "not window-open". Leftovers of an
elapsed batch satisfied both, so one call every 288 blocks kept the
patience phase alive and the liquidation phase never arrived; a 1-sat
transfer to the treasury plus `fund-from-treasury` did the same.

After, one rule: a batch opens only when the vault is EMPTY (no sats home,
none on the book). `fund-from-treasury` reads `is-empty` BEFORE the pull and
opens a window only then, or when no clock is set at all (`opened` in the
event); otherwise the sats join whatever phase the batch is in and the
clock does not move. `start-clock` is GONE: it existed for sats that landed
by plain transfer, and those now simply wait for the next funding, which
opens the window for them. The exit that empties the vault clears the
clock (`close-if-empty` in `jing-take`,
`router-swap`, `router-swap-split`, `dao-recall-sbtc`, and in
`fuel-fair-book`, since a batch the book sold out has no exit call here and
its proceeds are what the community flushes). `close-batch` (anyone) is the
manual version for an empty vault whose clock still shows.

Consequence, accepted: rewards landing next to an elapsed batch's leftovers
skip the patience phase and go straight to liquidation until the vault is
empty again. Anyone clears that with `jing-reclaim` + `router-swap`; if the
book has no bids at mid AND every pool sits more than 1% under mid, the
leftover waits for the pools (blocks) or for a DAO take or recall, which
also clears the clock. Never permanent. `is-idle` was renamed `is-empty`
(the status field `empty`) since it means "no sBTC anywhere", not "nothing
happening".

Prior v2 cut (fixed ask at mid - leeway, `jing-reprice`) is superseded; the
fixed ask and the zero-spread peg fill in the same cycles, the peg only
differs after a drop past the floor (off instead of resting above the mid).

### 2. One router sale per burn block (router cooldown)

Why a cooldown and not a tighter floor. The floor is the DAO's, mid minus
SLIPPAGE (1%), one number for every venue in `router-swap`. A sandwich on
an AMM leg can only push our fill down to that floor and pays the venue fee
twice: Bitflow DLMM and XYK charge 50 bps a side, so at the 1% floor a
sandwich there is break-even at any size; Velar charges 30 bps, so 40 bps
of a Velar slice is extractable. The router is staged, book first, then
DLMM on what is left, then XYK and Velar on what DLMM left, so Velar only
sees sats once the book and DLMM have no capacity inside the floor for that
chunk. That happens after our own chunks walked the pools down to the
floor, or after a bot pre-pushed them (paying 50 bps twice on Bitflow to
set it up, for at most 40 bps of a 0.05 sBTC chunk). Chaining chunks in one
block is what turned the per-call bound into a per-batch exposure.

Lowering SLIPPAGE to 0.6% would make Velar neutral too, but it would also
stop DLMM and XYK from filling whenever the pools sit between 0.6% and 1%
under the mid: less liquidity taken per call, more unsold, more retries.
The cooldown keeps the 1% floor for the pools that matter and removes the
chaining: `router-swap` and `router-swap-split` share `last-router-swap`,
a sale needs `burn-block-height >= last + router-cooldown-blocks` (u16044
`ERR_COOLDOWN`), default 1 burn block, DAO dial `set-router-cooldown` up
to 144, 0 = off. Between Bitcoin blocks the pools re-arb to the mid.
`jing-take` is not on the clock: it settles at the oracle mid on the book,
nothing to sandwich. Covered in the coverage harness (`dc770f07…`, S7).


## Current-source verification (2026-09-18)

See the [verification README](../../simulations/README-ccd016-v2-verification.md):
**423/423 Stxer fork checks**, **97/97 local branch outcomes**, and **2,000/2,000 RV
invariant checks** with zero runtime exceptions and 72 completed emergency batches.
It includes zero-block patience, DAO-only AMM swaps without Pyth/Jing, DIA/native
fallback, failure rollback, exact source hashes, numerical examples and replay commands.

## Elapsed window on funding: bounties mv7dfb and mu0oy1

Two findings pull on the same line in `fund-from-treasury`.

Bounty mu0oy1 (Patient Reed, paid, fixed in `32f4a63`). Funding must not
re-arm an elapsed window on a real leftover. Else anyone sends 1 sat to the
treasury and calls `fund-from-treasury` after each elapse. The vault stays in
the patience phase, and `router-swap`, `jing-take` and `jing-reclaim` stay
u16031 (ERR_WINDOW_OPEN) forever.

Bounty mv7dfb (Calm Forge). Dust of 3-8 sats can stay in the vault after a
batch. The book refunds a remainder under its minimum, or a griefer donates
sats after the sell-out. The dust is above DUST_SATS (2), so `is-empty` is
false and the old batch stays alive with an elapsed window. New rewards then
joined that batch (`opened false`). Anyone could `router-swap` them at once
at the floor. They did not rest at the mid first.

Rule. Read before the pull, a batch opens when:

- the vault is empty, or
- nothing is on the clock, or
- the window elapsed AND wallet + market (live + parked + pending escrow) is
  at most ROUTER_SLACK_SATS (8). That much cannot be sold: `router-swap`
  needs more than 8 sats (u16047).

```clarity
(empty (or
  (is-empty)
  (is-none (var-get batch-start))
  (and (window-elapsed) (<= (+ (sbtc-balance) (market-total)) ROUTER_SLACK_SATS))
))
```

Unsellable dust no longer pins new rewards to an elapsed batch (mv7dfb). A
sellable leftover keeps its elapsed window, so 1 sat cannot re-arm it
(mu0oy1 stays fixed).

Tests. `simulations/stxer-ccd016-v2-clock-keyless.js` (no Pyth key; S8 uses
one public Lazer update for `router-swap`). Run 101/101:
https://stxer.xyz/simulations/mainnet/39fca44556c0537340ebe27f35e989ed

- S3 (mu0oy1): window elapsed on 1,000,100 sats, 1 sat funded: `opened
  false`, still elapsed.
- S8a: empty vault, 3 sats funded: `opened true`.
- S8b: window open, 5 sats funded: `opened false`. 8 sats of dust home.
- S8c (mv7dfb): window elapsed on the 8-sat dust, 1M sats funded: `opened
  true`, batch-start moves to the current height. `router-swap` and
  `jing-reclaim` return u16031.
- S8d (mu0oy1 again): window elapsed on 1,000,008 sats, 1 sat funded:
  `opened false`, batch-start unchanged, still elapsed.

Regression runs on the same source:

- coverage 104/104: https://stxer.xyz/simulations/mainnet/fd6d485d235cbd9af0a614326ee8d8bc
- happy-path 58/58: https://stxer.xyz/simulations/mainnet/8151a5a2ecba1286e13eedefb405a3a7
- parked 136/136: https://stxer.xyz/simulations/mainnet/79d46185f0d60bb515129dc28f914ad0
- pyth-fee 66/66: https://stxer.xyz/simulations/mainnet/de1bf43a3df69a4020d0bcdbd287b2dd
- emergency 45/45: https://stxer.xyz/simulations/mainnet/caf729594137614ef38c7057b2ef41f5

## Bounty mv7dfb: Super Orb, vault pays both Pyth verifies

Finding. Every entry that takes a Lazer `update` first ran `current-mid`.
That calls the market's `refresh-mid`, which verifies the update. The oracle
charges its fee to tx-sender. This ran before the vault's `as-contract?`, so
the caller paid it. Only the second verify (in the market's `swap`) was paid
by the vault. `jing-place` and `jing-refloor` had no `with-stx` at all.

Fix. New private `vault-mid` runs `current-mid` in its own `as-contract?`
scope with `(with-stx (var-get pyth-fee-budget))`. Every entry that verifies
(`jing-place`, `jing-refloor`, `jing-take`, `router-swap`,
`router-swap-split`) calls `vault-mid` where it called `current-mid`; nothing
else in them changed, and the swap scopes keep their own `with-stx` for the
market's verify. The vault pays every Pyth fee. The caller pays only its tx
fee. The floor and limit math is unchanged.

Fee budget. `jing-take`, `router-swap` and `router-swap-split` verify twice,
once per scope. Each scope's `with-stx` caps one verify (budget = fee passes),
but both fees come from the vault's own STX: set `pyth-fee-budget` to at least
**2 x fee**. `jing-place` and
`jing-refloor` verify once. The 10 STX cap still allows a fee up to 5 STX
per verify. The live fee is u0 today.

STX on hand. With a fee above 0, the vault now also pays for `jing-place`
and `jing-refloor`, so it needs STX for those too. `fuel-fair-book` keeps
`pyth-fee-budget` back, which covers one entry. With no STX in the vault,
every Lazer entry aborts with `(err u1)` (the oracle's fee transfer). With a
budget below the fee, it aborts in `vault-mid` with `(err u0)`. Before, `router-swap`
could still sell on the AMMs when the vault had no STX; now it aborts.

Check order and error codes. As at HEAD: the mid is read first, in the
outer `let`, then auth, window, amount and cooldown. Codes are unchanged
except over budget: `(err u0)` from `vault-mid` in every entry (HEAD: `(err
u1)` from the swap scope's `with-stx`; jing-place and jing-refloor had none).

Tests. `simulations/stxer-ccd016-v2-pyth-fee.js` 70/70:
https://stxer.xyz/simulations/mainnet/990fd61bf4b3f09efea55fa756d7457f

- Budget 0, vault STX 0: `router-swap` and `jing-take` return `(err u1)`.
- Budget 0 with a float, and budget 9 (fee - 1): both abort in `vault-mid`
  with `(err u0)`.
- Budget 20: a fresh account with 0 STX runs `router-swap`. It sends no STX
  and still holds 0 STX. The vault pays exactly two 10 uSTX fees.
  `jing-take` also pays exactly two fees from the vault.
- `fuel-fair-book` keeps exactly the 20 uSTX budget.

Regression runs on the same source (no Pyth key):

- clock-keyless 101/101: https://stxer.xyz/simulations/mainnet/fb461e0f8e0cf60ef6b30a343bd0ee92
- coverage 104/104: https://stxer.xyz/simulations/mainnet/be64614667fc2ffa2c7c92c5daf0be92
- happy-path 58/58: https://stxer.xyz/simulations/mainnet/d9719d945b5e61bf4001a50a4137817e
- parked 136/136: https://stxer.xyz/simulations/mainnet/b7f64867b34506b6ff1ebf469128859e
- emergency 45/45: https://stxer.xyz/simulations/mainnet/4470fb1a029b816d91a6b373ee384cf8
- fixes 76/92 (https://stxer.xyz/simulations/mainnet/dbc260d4d0c54537be8e6b51114698b3).
  The same 16 L-1 checks fail on HEAD 8adfa68 without this change
  (https://stxer.xyz/simulations/mainnet/c8653524b8ace456c37e02aa324a52d4).
  The harness predates the Calm Forge funding rule (dust in an elapsed
  window now opens a fresh batch), so its L-1 setup is stale.

## Bounty mv7dfb: not taken (Calm Forge option, Violet Reed)

Lines below are at `8adfa68`.

**Calm Forge, optional hardening: not needed after `8adfa68`.** The
suggestion: let `close-batch` (L410) send at most ROUTER_SLACK_SATS of dust
to REWARDS_TREASURY when nothing is on the market, so the clock can close
without a proposal.

The only harm of the stuck clock was in `fund-from-treasury`: new rewards
joined the elapsed batch and anyone could `router-swap` them at the floor.
Since `8adfa68`, `fund-from-treasury` (L355) opens a fresh window when the
old one elapsed and wallet + market is at most ROUTER_SLACK_SATS (L370). The
dust then rides along into the new patience phase and rests at the mid with
the rewards. Until new rewards arrive, the stale clock blocks nothing that
has funds to move: 3-8 sats cannot be sold (`router-swap` needs more than 8,
L615), and no other function waits for `batch-start` to be none. Sending the
dust to the treasury would only move it one hop early. No change.

**Violet Reed, `router-swap-split` and a bid in the net band: by design.**
`router-swap-split` (L644) signs a gross min-out (L680). The router's manual
book leg pays net of the rebate and the 10 bps fee, so a best bid in
`[limit, book-limit(limit))` makes the split revert u3002. The vault never
sells under its floor and the tx rolls back. The split is DAO-only; size the
`jing` slice with the market's `get-taker-capacity` at `book-limit` and the
walk stops above it. Full reasoning: juicestx
`contracts/pox-5/README-bounty-mv7dfb.md` section 9.

**Frosty Narwhal M-4: `router-swap-split` allowance lacks the rebate dust.**
Does not hold, no change (checked at `8bfbb5f`, same at the pinned
`8bb69aa`). The split calls the router with `fallback none` (L678). Router
v5-3 `with-fallback` adds the Jing residual only to a named fallback venue,
so nothing is re-sold and the vault sends at most `amount`. The refunded
rest and rebate dust stay in the vault. `amount + min-x` (L674) covers it.
Full reasoning: juicestx `contracts/pox-5/README-bounty-mv7dfb.md`
section 13.
