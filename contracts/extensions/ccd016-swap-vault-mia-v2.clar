;; Title: CCD016 - MiamiCoin One-Way Swap Vault v2 (sBTC -> STX), keeperless
;; Version: 0.3.0 (DRAFT - unaudited, not deployed; market v6 pegged orders)
;; Summary: Converts the DAO's sBTC rewards to STX at an oracle-bound price with no operator; anyone can drive it. STX can only reach the ccd015 book, sBTC can only return to the treasury.
;; Description:
;;   Solution 2's execution layer, second cut. v1 needed a DAO-appointed keeper
;;   and a signing key: two humans in the loop for every trade. v2 removes
;;   both. The price never comes from a caller; it comes from the Pyth Lazer
;;   update the deployed Jing market verifies (the same feed the market
;;   settles on, fetched from jingswap's backend by whoever calls). With the
;;   price pinned by the oracle and the direction pinned by the code, there
;;   is nothing left for a caller to choose except WHEN, and a clock bounds
;;   that too:
;;
;;   1. CLOCK. When fund-from-treasury finds the vault empty (or with no
;;      clock at all), a batch opens and a
;;      window of WINDOW burn blocks starts (default 288 = about two days,
;;      cap one week). sBTC arriving while the window is open joins the
;;      batch without resetting it; sBTC arriving after it elapsed opens a
;;      fresh window, and any leftover from the old batch rides along into
;;      the new patience phase. That is the whole clock: one height, moved
;;      only by funding, only when no window is open.
;;   2. PATIENCE PHASE (window open): maker-first on the Jing market. Anyone
;;      may rest the vault's sBTC on the book as a PEG: an ask that sits
;;      maker-spread (1 bp) above the settlement mid, whatever the mid is at each
;;      settlement, with a floor of mid * (1 - LEEWAY) taken at placement.
;;      Market v6 recomputes the pegged price from its own verified mid
;;      every settlement, so nobody reprices it: the keeper loop v1 had, and
;;      the reprice call the first v2 cut had, are gone. The floor is a
;;      guard, not a price: while the mid is at or above it the ask is at
;;      the mid plus the spread; below it the ask is switched off for that settlement (no
;;      fill at all, not a fill at the floor) and comes back by itself when
;;      the mid returns. LEEWAY = 5% is how far the mid may fall before the
;;      guard trips; jing-refloor moves the guard to a fresh mid when it
;;      did. When bids already rest at the mid the market refuses the peg
;;      (a resting order may not cross): the vault waits for them to clear
;;      or for the window to elapse. The patience phase never takes: no
;;      call can sell the vault under the mid while the window is open.
;;      Why maker-first: the vault fills at the oracle mid, i.e. the CEX
;;      price with no AMM curve or slippage, and as a resting maker it pays
;;      the 10 bps book fee while collecting the 20 bps taker rebate when a
;;      taker crosses it: net +10 bps on top of CEX execution.
;;   3. LIQUIDATION PHASE (window elapsed): the market did not absorb the
;;      size. Anyone may reclaim the resting deposit, take against the book
;;      at the floor (jing-take), or sell through the
;;      Jing smart router (book, Bitflow DLMM, Bitflow XYK, Velar, split at
;;      execution) with a floor of mid * (1 - SLIPPAGE) derived from the same
;;      oracle update; whatever no venue takes inside the floor comes home
;;      unsold. A caller sizes the chunk; the floor is not theirs to move.
;;      MEV, open question (code unchanged for now): a sandwich on the AMM
;;      legs can only push our fill down to the floor, because the limit is
;;      the oracle's, not the pool's. So the most a bot extracts is
;;      SLIPPAGE * chunk, and it pays the venue fee twice to do it (Bitflow
;;      XYK and DLMM 50 bps a side, Velar 30). The invariant that makes a
;;      sandwich unprofitable at ANY size is SLIPPAGE <= 2 * venue fee:
;;      at the 1% floor XYK and DLMM sit exactly at break-even, Velar needs
;;      0.6% (60 bps round trip). The manual entry prices each leg's min
;;      itself, so its Velar leg gets the 0.6% floor (VELAR_SLIPPAGE_BPS).
;;      The smart router takes one limit for every venue, so a slice it
;;      routes to Velar carries the 1% floor; that exposure is bounded by
;;      the chunk cap to at most 0.4% of 0.01 sBTC per call, a few dollars.
;;      Last measured, a bot needed ~15k USD of sBTC per chunk to clear its
;;      costs. A cooldown of N burn blocks between router swaps is the next
;;      lever if ever needed. The Jing leg is not sandwichable: it
;;      settles at the oracle mid.
;;   4. HARD-WIRED EXITS, unchanged from v1: STX leaves only to the ccd015
;;      book (fuel-fair-book, permissionless); sBTC leaves only back to the
;;      rewards treasury (dao-recall-sbtc, by proposal).
;;
;;   What anyone can do, three steps and nothing else: jing-place while the
;;   window is open (in chunks, until every sat rests), jing-reclaim then
;;   router-swap once it elapsed (the router picks the split), and
;;   fuel-fair-book whenever STX sits here. What a proposal controls: the
;;   window length, the leeway, the slippage floor, the DIA band, the
;;   recall, and the precise tools: jing-refloor, jing-take and
;;   router-swap-split. Prices come from Pyth with a DIA sanity check,
;;   or DIA/native for emergency AMM-only splits. Destinations
;;   remain fixed.
;;
;;   Oracle: the Jing market's `refresh-mid (update)` verifies a signed Lazer
;;   update (max age 80 s, confidence required) and returns the mid in the
;;   market's price unit (micro-STX per sat, times 1e10). A stale or
;;   unsigned update reverts inside the market. The separate emergency split
;;   uses DIA, falling back to the deployed RFQ native band on DIA error.
;;   The Pyth mid
;;   must sit within DIA_BAND (10%) of the DIA push oracle's own STX/BTC rate
;;   (BTC/USD over STX/USD, both fresh within 2h), the same free on-chain
;;   feed ccd015 prices on. Two independent oracles agreeing within 10% is
;;   the whole guard; no native miner-commit band here. A proposal can widen
;;   the band or set it to 0 to trust Pyth alone if DIA dies.
;;
;;   Every deployed external principal is a fully qualified mainnet address.
;;   One reference is relative: the STX destination binds to the ccd015 book
;;   at this vault's own deployer, so vault and book ship from the same
;;   address, book first.

;; TRAITS

(impl-trait 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u16000))
(define-constant ERR_NO_FUNDS (err u16006))
(define-constant ERR_NO_BUDGET (err u16010))
(define-constant ERR_INVALID_PRICE (err u16013))
(define-constant ERR_WINDOW_CLOSED (err u16030))
(define-constant ERR_WINDOW_OPEN (err u16031))
(define-constant ERR_NO_CLOCK (err u16032))
(define-constant ERR_OUT_OF_RANGE (err u16033))
(define-constant ERR_NOTHING_RESTING (err u16034))
(define-constant ERR_ORACLE_DIA (err u16035))
(define-constant ERR_ORACLE_STALE (err u16036))
(define-constant ERR_ORACLE_DIVERGED (err u16037))
(define-constant ERR_NO_BLOCK_TIME (err u16038))
(define-constant ERR_CHUNK_TOO_BIG (err u16039))
(define-constant ERR_SPLIT_MISMATCH (err u16040))
(define-constant ERR_SOME_FUNDS (err u16043))
(define-constant ERR_COOLDOWN (err u16044))
(define-constant ERR_BELOW_FLOOR (err u16047))
;; the router lets each leg land up to ROUND_SLACK (2) sats under the limit;
;; four legs at most
(define-constant ROUTER_SLACK_SATS u8)
(define-constant ERR_UPDATE_REQUIRED (err u16045))

(define-constant PRICE_PRECISION u100000000)
(define-constant DECIMAL_FACTOR u100)
(define-constant BPS_PRECISION u10000)
;; most rebate dust the market (markets-sbtc-stx-jing-v6-4) refunds: under
;; 1 sat per rounding, 1 for net + 1 for the batch share + 49 walk fills.
;; Router v5-3 sizes the book leg at the market's gross-cap, so the leg
;; trades in full and only this rounding comes back.
(define-constant JING_REBATE_DUST_SATS u51)
;; highest taker rebate the market pays (bps). The market refunds the untraded
;; rebate share of a sub-min rest rem < min-x too, and the router re-sells it:
;; rest + left < min-x * (1 + bps / 1e4) + 51.007 (the bid list caps fills at
;; 50), so in integers router-swap allows ceil(min-x * MAX_TAKER_REBATE_BPS /
;; BPS_PRECISION) on top of min-x + 51 (audit F1, Celestial Shark)
(define-constant MAX_TAKER_REBATE_BPS u70)

(define-constant SBTC_TOKEN 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant ASSET_SBTC "sbtc-token")

;; the only account sBTC can ever be returned to - same constant as ccd014/ccd015
(define-constant REWARDS_TREASURY 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3)

;; The only account STX can ever be sent to: the ccd015 redemption book.
;; Relative on purpose - it binds at deploy time to the book at THIS deployer,
;; so vault and book must ship from the same address, book first.
(define-constant STX_FAIR_BOOK .ccd015-redemption-book-mia-stx) ;; in prod change this to the literal

;; The Jing market on Pyth Lazer (markets-sbtc-stx-jing-v6-2: pegged orders):
;; the maker venue and the price oracle. The smart router splits a taker
;; order across the book, Bitflow DLMM, Bitflow XYK and Velar at execution.
(define-constant JING_MARKET 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4)
(define-constant JING_ROUTER 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.swap-router-sbtc-stx-jing-v5-5)
(define-constant WSTX_TOKEN 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)
(define-constant ASSET_WSTX "wstx")

;; governance caps: a proposal can tune inside these, never outside
(define-constant MAX_WINDOW_BLOCKS u1008) ;; one week: rewards land weekly, a batch must clear before the next
(define-constant MAX_LEEWAY_BPS u1000) ;; 10% under the mid
(define-constant MAX_SLIPPAGE_BPS u1000) ;; -10%
(define-constant MAX_DIA_BAND_BPS u5000) ;; 50%
(define-constant MAX_CHUNK_SATS u100000000) ;; 1 BTC

;; sBTC transfers in are permissionless, so anyone can leave a sat or two in the
;; vault. Dust that small cannot be sold - every router stage skips it and the
;; swap returns zero - so an exact-zero emptiness test would let a 1-sat gift
;; hold a batch open until the 432-block recovery. Treat it as empty instead;
;; it simply rides into the next batch.
(define-constant DUST_SATS u2)

(define-constant MAX_COOLDOWN_BLOCKS u144) ;; one day
;; Velar's own floor: twice its 30 bps fee, so a sandwich there breaks even too
(define-constant VELAR_SLIPPAGE_BPS u60)
;; DIA pushes every 10-50 min; 2h clears the worst normal gap (see ccd015)
(define-constant MAX_DIA_AGE u7200) ;; in seconds

;; DATA VARS

(define-constant MAX_NO_PYTH_SLIPPAGE_BPS u5000)
;; Emergency DIA tolerance: 10% by default, bounded at 50%.
(define-data-var no-pyth-slippage-bps uint u1000)

;; Pyth Lazer charges its update fee in STX from tx-sender, which is this
;; vault inside as-contract?. uSTX allowed per Lazer-verifying call; u0 while
;; the oracle fee is u0. Every entry that takes an update reads its mid
;; through vault-mid (market refresh-mid, one verify, in its own as-contract?
;; scope), so the vault pays, never the caller. jing-take, router-swap and
;; router-swap-split verify again in the market's swap (2 fees); jing-place
;; and jing-refloor verify once. Each scope's allowance needs only 1 fee, but
;; both are paid from the vault's own STX: set it to at least 2 x the oracle
;; fee. Paid from the vault's own STX
;; balance. Bounded at 10 STX (a fee up to 5 STX per verify).
(define-constant MAX_PYTH_FEE_BUDGET u10000000)
(define-data-var pyth-fee-budget uint u0)

;; upper bound on the maker spread over mid for the resting sBTC ask
(define-constant MAX_MAKER_SPREAD_BPS u50)

;; spread over mid for the pegged sBTC ask (jing-place, jing-refloor). A
;; spread-0 ask sits at exactly mid, so the market refunds it as crossing
;; while a spread-0 pegged bid rests, and the batch never rests. 1 bp
;; keeps the ask strictly above every spread-0 bid.
(define-data-var maker-spread-bps uint u1)

;; burn blocks the patience phase lasts, from the batch's first funding
(define-data-var window-blocks uint u288)
;; resting ask under the oracle mid while the window is open (5%)
(define-data-var leeway-bps uint u500)
;; floor under the oracle mid once the window has elapsed
(define-data-var slippage-bps uint u100)
;; largest single router-swap, in sats (0.01 sBTC): keeps one liquidation
;; tx under the size where a sandwich could clear its own fees
(define-data-var max-chunk-sats uint u1000000)
;; Pyth mid must sit within this of the DIA rate; 0 = DIA check off
(define-data-var dia-band-bps uint u1000)
;; burn blocks between two router sales (router-swap and router-swap-split
;; share the clock). One chunk per Bitcoin block: a bot cannot chain chunks
;; in one block to walk DLMM and XYK down to the floor and route the rest to
;; Velar, where a sandwich clears its fees (60 bps round trip under the 1%
;; floor); between blocks the pools re-arb to the mid. 0 = off.
(define-data-var router-cooldown-blocks uint u1)
(define-data-var last-router-swap uint u0)
;; burn height the current batch opened at; none while the vault is empty.
;; Set only when funding finds the vault empty (or no clock at all);
;; cleared by the exit that empties the vault, or by close-batch. Never
;; moved while a batch is on the clock, open or elapsed: an elapsed batch's
;; leftovers stay in liquidation, and sats landing next to them join it
;; (bounty finding: a free start-clock / 1-sat funding re-armed the window
;; forever; start-clock is gone, a plain transfer waits for the next
;; funding).
(define-data-var batch-start (optional uint) none)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao)
      (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao
        is-extension contract-caller
      )
    )
    ERR_UNAUTHORIZED
  ))
)

(define-public (callback
    (sender principal)
    (memo (buff 34))
  )
  (ok true)
)

;; --- DAO configuration -----------------------------------------------------

(define-public (set-no-pyth-slippage-bps (bps uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= bps MAX_NO_PYTH_SLIPPAGE_BPS) ERR_OUT_OF_RANGE)
    (var-set no-pyth-slippage-bps bps)
    (print {
      notification: "set-no-pyth-slippage-bps",
      payload: { value: bps },
    })
    (ok true)
  )
)

(define-public (set-pyth-fee-budget (ustx uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= ustx MAX_PYTH_FEE_BUDGET) ERR_OUT_OF_RANGE)
    (var-set pyth-fee-budget ustx)
    (print {
      notification: "set-pyth-fee-budget",
      payload: { value: ustx },
    })
    (ok true)
  )
)

(define-public (set-maker-spread-bps (bps uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= bps MAX_MAKER_SPREAD_BPS) ERR_OUT_OF_RANGE)
    (var-set maker-spread-bps bps)
    (print {
      notification: "set-maker-spread-bps",
      payload: { value: bps },
    })
    (ok true)
  )
)

(define-public (set-window-blocks (blocks uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= blocks MAX_WINDOW_BLOCKS) ERR_OUT_OF_RANGE)
    (ok (var-set window-blocks blocks))
  )
)

(define-public (set-leeway-bps (bps uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= bps MAX_LEEWAY_BPS) ERR_OUT_OF_RANGE)
    (ok (var-set leeway-bps bps))
  )
)

(define-public (set-slippage-bps (bps uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= bps MAX_SLIPPAGE_BPS) ERR_OUT_OF_RANGE)
    (ok (var-set slippage-bps bps))
  )
)

(define-public (set-max-chunk-sats (sats uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (and (> sats u0) (<= sats MAX_CHUNK_SATS)) ERR_OUT_OF_RANGE)
    (ok (var-set max-chunk-sats sats))
  )
)

(define-public (set-dia-band-bps (bps uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= bps MAX_DIA_BAND_BPS) ERR_OUT_OF_RANGE)
    (ok (var-set dia-band-bps bps))
  )
)

(define-public (set-router-cooldown (blocks uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (<= blocks MAX_COOLDOWN_BLOCKS) ERR_OUT_OF_RANGE)
    (ok (var-set router-cooldown-blocks blocks))
  )
)

;; Governance escape hatch: a proposal returns the vault's entire unswapped
;; sBTC balance to the rewards treasury. A resting Jing deposit is reclaimed
;; first with dao-reclaim below (any phase for the DAO, deposit phase for the
;; market), then recalled here.
(define-public (dao-recall-sbtc)
  (let ((balance (unwrap-panic (contract-call? SBTC_TOKEN get-balance current-contract))))
    (try! (is-dao-or-extension))
    (asserts! (> balance u0) ERR_NO_FUNDS)
    (try! (as-contract? ((with-ft SBTC_TOKEN ASSET_SBTC balance))
      (try! (contract-call? SBTC_TOKEN transfer balance current-contract
        REWARDS_TREASURY none
      ))
    ))
    (close-if-empty)
    (ok (print {
      notification: "dao-recall-sbtc",
      payload: { amount: balance },
    }))
  )
)

(define-public (dao-reclaim (update (optional (buff 8192))))
  (begin
    (try! (is-dao-or-extension))
    (reclaim-core)
  )
)

;; --- funding (the pipe from the rewards treasury) ---------------------------

;; Pull the rewards treasury's entire sBTC balance into the vault and open a
;; batch if the vault was empty (or had no clock). Permissionless and argumentless: a caller
;; controls neither amount nor destination. Requires this contract to be an
;; enabled extension (the treasury gates withdraw-ft on is-dao-or-extension)
;; and sBTC on the treasury's allowlist - both set by the enabling proposal.
(define-public (fund-from-treasury)
  (let (
      (amount (unwrap! (contract-call? SBTC_TOKEN get-balance REWARDS_TREASURY)
        ERR_NO_BUDGET
      ))
      ;; read BEFORE the pull: a batch opens when the vault was empty, when
      ;; nothing is on the clock at all (sats that landed by plain transfer
      ;; have no window of their own; they join this batch), or when the old
      ;; window elapsed and what is left (wallet + market) is unsellable dust
      ;; (at most ROUTER_SLACK_SATS, under router-swap's u16047 limit). A
      ;; larger leftover keeps the elapsed window, so a 1-sat fund cannot
      ;; re-arm the clock and block the exits forever
      (empty (or
        (is-empty)
        (is-none (var-get batch-start))
        (and (window-elapsed) (<= (+ (sbtc-balance) (market-total)) ROUTER_SLACK_SATS))
      ))
    )
    (asserts! (> amount u0) ERR_NO_BUDGET)
    (try! (contract-call? REWARDS_TREASURY withdraw-ft
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token amount
      current-contract
    ))
    (and empty (open-window))
    (ok (print {
      notification: "fund-from-treasury",
      payload: {
        amount: amount,
        opened: empty,
        batch-start: (var-get batch-start),
      },
    }))
  )
)

;; The batch is over (the vault is empty) but its clock still shows, which
;; happens when the book sold it out with no exit call here: anyone clears
;; it so the next sats open a fresh window.
;; what this vault has on the market: live + parked + pending escrow
(define-private (market-total)
  (let ((cycle (contract-call? JING_MARKET get-current-cycle)))
    (+ (contract-call? JING_MARKET get-token-x-deposit cycle current-contract)
      (contract-call? JING_MARKET get-token-x-parked current-contract)
      (default-to u0
        (get amount
          (contract-call? JING_MARKET get-token-x-pending-deposit
            current-contract
          ))
      ))
  )
)

;; dust on the market (a 1-sat jing-place after the sell-out) would keep
;; is-empty false until the window ends: when wallet + market is at most
;; DUST_SATS, cancel it home first (no oracle), so the batch closes now
(define-public (close-batch)
  (let ((on-market (market-total)))
    (and
      (> on-market u0)
      (<= (+ on-market (sbtc-balance)) DUST_SATS)
      (is-ok (reclaim-core))
    )
    (asserts! (is-empty) ERR_SOME_FUNDS)
    (asserts! (is-some (var-get batch-start)) ERR_NO_CLOCK)
    (var-set batch-start none)
    (ok (print {
      notification: "close-batch",
      payload: { burn-height: burn-block-height },
    }))
  )
)

;; --- exits (destinations hard-wired) ---------------------------------------

;; Flush the vault's STX balance to the ccd015 book, less pyth-fee-budget
;; uSTX kept back so a caller cannot sweep the Lazer fee float before a sale.
;; Permissionless: no pricing, no amount, no destination.
(define-public (fuel-fair-book)
  (let (
      (balance (stx-get-balance current-contract))
      (reserve (var-get pyth-fee-budget))
      (amount (if (> balance reserve)
        (- balance reserve)
        u0
      ))
    )
    (asserts! (> amount u0) ERR_NO_FUNDS)
    (try! (as-contract? ((with-stx amount))
      (try! (stx-transfer? amount current-contract STX_FAIR_BOOK))
    ))
    ;; a batch the book sold out has no exit call here: its proceeds do
    (close-if-empty)
    (ok (print {
      notification: "fuel-fair-book",
      payload: {
        amount: amount,
        book: STX_FAIR_BOOK,
      },
    }))
  )
)

;; --- patience phase: Jing maker-first (window open) -------------------------

;; Rest the vault's whole sBTC balance on the Jing book as a peg: mid + spread every
;; settlement, off while the mid is under the floor mid * (1 - leeway) taken
;; now. The market rests it at once when the STX side is empty, otherwise it
;; escrows the sats until someone settles them with a price update published
;; after the deposit; a settle that finds the peg crossing refunds them here
;; instead of resting them. Merges into an existing resting or parked position
;; (the market folds a parked amount back in) and refreshes the floor.
;;
;; Nothing here settles that escrow: the market's settle-token-x-deposit takes
;; the depositor as an argument, so a keeper - or anyone at all - settles this
;; vault with a fresh update, and the sats stay escrowed until someone does.
;; A reclaim does not need that settle: the market's cancel returns pending
;; escrow too. A second jing-place before the settle is refused by the market
;; (one pending deposit per maker).
(define-public (jing-place (update (buff 8192)))
  (let (
      (floor (ask-of (try! (vault-mid update))))
      ;; the whole balance, always: a caller chooses nothing but WHEN
      (amount (sbtc-balance))
    )
    (asserts! (window-open) ERR_WINDOW_CLOSED)
    (try! (check-amount amount))
    (try! (as-contract? ((with-ft SBTC_TOKEN ASSET_SBTC amount))
      (try! (contract-call? JING_MARKET deposit-token-x amount floor
        (some (var-get maker-spread-bps))
        SBTC_TOKEN ASSET_SBTC
      ))
    ))
    (ok (print {
      notification: "jing-place",
      payload: {
        amount: amount,
        floor: floor,
      },
    }))
  )
)

;; DAO only. Move the guard of the resting peg to a fresh oracle mid: mid *
;; (1 - leeway) while the window is open, mid * (1 - slippage) once it
;; elapsed. The price itself never needs moving (the peg follows the mid);
;; this is only for a mid that fell under the floor and switched the ask off,
;; a proposal-worthy event, not a community chore. The floor applies at once
;; when the STX side is empty, otherwise it waits for settle-token-x-limit,
;; which drops it if it crosses at that print. Works on a live or a parked
;; position, not on an escrowed one (a pending deposit carries its own floor
;; and is refloored by replacing it); nothing moves but the floor.
(define-public (jing-refloor (update (buff 8192)))
  (let (
      (floor (phase-limit (try! (vault-mid update))))
      (cycle (contract-call? JING_MARKET get-current-cycle))
      (resting (+ (contract-call? JING_MARKET get-token-x-deposit cycle current-contract)
        (contract-call? JING_MARKET get-token-x-parked current-contract)
      ))
    )
    (try! (is-dao-or-extension))
    (asserts! (> resting u0) ERR_NOTHING_RESTING)
    (try! (as-contract? ()
      (try! (contract-call? JING_MARKET set-token-x-limit floor
        (some (var-get maker-spread-bps))
      ))
    ))
    (ok (print {
      notification: "jing-refloor",
      payload: {
        resting: resting,
        floor: floor,
      },
    }))
  )
)

;; DAO only (no chunk cap: the book settles at the oracle mid, so one call may
;; clear a whole batch). Take against the Jing book, fill-or-kill, at the
;; liquidation floor mid * (1 - slippage). Liquidation phase only: the patience phase is passive,
;; the vault rests at the mid and takes nothing, so nobody can sell it under
;; the mid before the window elapsed. The market's `swap` refuses a caller
;; with a resting position (u1018): reclaim first.
(define-public (jing-take
    (requested uint)
    (update (buff 8192))
  )
  (let (
      (amount (sweep-amount requested))
      (limit (floor-of (try! (vault-mid update))))
    )
    (try! (is-dao-or-extension))
    (asserts! (window-elapsed) ERR_WINDOW_OPEN)
    (try! (check-amount amount))
    (let ((result (try! (as-contract? ((with-ft SBTC_TOKEN ASSET_SBTC amount)
          (with-stx (var-get pyth-fee-budget))
        )
        (try! (contract-call? JING_MARKET swap amount limit update SBTC_TOKEN
          ASSET_SBTC WSTX_TOKEN ASSET_WSTX true
        ))
      ))))
      (close-if-empty)
      (ok (print {
        notification: "jing-take",
        payload: {
          amount: amount,
          limit-price: limit,
          out: (get token-y-received result),
        },
      }))
    )
  )
)

;; --- liquidation phase: reclaim + any venue at the floor (window elapsed) ----

;; Reclaim the sBTC on the Jing market (pending, resting and parked) back into
;; the vault. Anyone, once the window elapsed; the DAO any time via
;; dao-reclaim. Funds can only return here, so no other check is needed. The
;; update argument is kept for callers but no longer used: cancel needs no
;; oracle and no settle.
(define-public (jing-reclaim (update (optional (buff 8192))))
  (begin
    (asserts! (window-elapsed) ERR_WINDOW_OPEN)
    (reclaim-core)
  )
)

;; Sell `amount` sats through the smart router at the floor: the router sizes
;; each venue (book at the verified mid, DLMM bin walk, XYK, Velar) so every
;; leg clears inside `limit`, and returns what nothing could take inside it
;; as `unsold`. The allowance is `amount` plus the market's minimum deposit:
;; as-contract? counts gross transfers and the router re-sells refunded dust.
(define-public (router-swap (update (buff 8192)))
  (let (
      ;; permissionless: always the whole balance or one full chunk, never a
      ;; caller-chosen sliver that burns the shared cooldown
      (amount (chunk-amount))
      (mid (try! (vault-mid update)))
      (limit (floor-of mid))
      (mins (contract-call? JING_MARKET get-min-deposits))
    )
    (asserts! (window-elapsed) ERR_WINDOW_OPEN)
    (try! (check-amount amount))
    (try! (cooldown-tick))
    (let ((result (try! (as-contract?
        ;; the market refunds the unfilled rest (under min-x), the rebate share
        ;; on it (at most ceil(min-x * 70 bps)) and the unused rebate dust, and the
        ;; router re-sells all three: allow that on top of `amount`
        ((with-ft SBTC_TOKEN ASSET_SBTC
          (+ amount (get min-token-x mins) JING_REBATE_DUST_SATS
            (/ (+ (* (get min-token-x mins) MAX_TAKER_REBATE_BPS) (- BPS_PRECISION u1))
              BPS_PRECISION
            )
          ))
          (with-stx (var-get pyth-fee-budget))
        )
        (try! (contract-call? JING_ROUTER smart-swap-sbtc-for-stx amount limit
          (some update) mid u0
        ))
      ))))
      ;; sell what fits inside the floor, keep the rest: every router leg
      ;; already enforces the limit, so the floor is checked on what sold
      (let ((sold (- amount (get unsold result))))
        (asserts! (> sold ROUTER_SLACK_SATS) ERR_BELOW_FLOOR)
        (asserts!
          (>= (get out result) (floor-out (- sold ROUTER_SLACK_SATS) limit))
          ERR_BELOW_FLOOR
        )
      )
      (close-if-empty)
      (ok (print {
        notification: "router-swap",
        payload: {
          amount: amount,
          limit-price: limit,
          mid: mid,
          out: (get out result),
          unsold: (get unsold result),
        },
      }))
    )
  )
)

;; DAO only. Same liquidation sale through the router's manual entry: the caller picks
;; the jing / dlmm / xyk / velar split (jing u0 while a position is still
;; resting on the book, the market refuses a taker with resting size). Every
;; leg's min comes from the oracle: mid minus SLIPPAGE for jing, dlmm, xyk
;; and mid minus VELAR_SLIPPAGE_BPS for velar, twice each venue's fee, so a
;; sandwich breaks even on every leg (see header). A bad split only reverts;
;; it cannot fill below its floor. Same chunk cap as router-swap. The
;; allowance adds the market minimum for the book leg's refunded dust.
(define-public (router-swap-split
    (amount uint)
    (jing uint)
    (dlmm uint)
    (xyk uint)
    (velar uint)
    (update (buff 8192))
  )
  (let (
      (mid (try! (vault-mid update)))
      (limit (floor-of mid))
      (velar-limit (/ (* mid (- BPS_PRECISION VELAR_SLIPPAGE_BPS)) BPS_PRECISION))
      (mins {
        dlmm: (floor-out dlmm limit),
        xyk: (floor-out xyk limit),
        velar: (floor-out velar velar-limit),
      })
      (market-mins (contract-call? JING_MARKET get-min-deposits))
    )
    (try! (is-dao-or-extension))
    (asserts! (is-eq amount (+ jing dlmm xyk velar)) ERR_SPLIT_MISMATCH)
    (asserts! (window-elapsed) ERR_WINDOW_OPEN)
    (asserts! (<= amount (var-get max-chunk-sats)) ERR_CHUNK_TOO_BIG)
    (try! (check-amount amount))
    (try! (cooldown-tick))
    (let ((result (try! (as-contract?
        ((with-ft SBTC_TOKEN ASSET_SBTC (+ amount (get min-token-x market-mins)))
          (with-stx (var-get pyth-fee-budget))
        )
        (try! (contract-call? JING_ROUTER swap-sbtc-for-stx amount jing limit
          (some update) none {
          dlmm: dlmm,
          xyk: xyk,
          velar: velar,
        }
          mins
          (+ (floor-out (+ jing dlmm xyk) limit) (floor-out velar velar-limit))
        ))
      ))))
      (close-if-empty)
      (ok (print {
        notification: "router-swap-split",
        payload: {
          amount: amount,
          jing: jing,
          dlmm: dlmm,
          xyk: xyk,
          velar: velar,
          limit-price: limit,
          velar-limit: velar-limit,
          mid: mid,
          out: (get out result),
          unsold: (get unsold result),
        },
      }))
    )
  )
)

;; Emergency AMM-only liquidation. No Jing allocation or Pyth argument.
(define-public (router-swap-split-dia
    (amount uint)
    (dlmm uint)
    (xyk uint)
    (velar uint)
  )
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-eq amount (+ dlmm xyk velar)) ERR_SPLIT_MISMATCH)
    (asserts! (window-elapsed) ERR_WINDOW_OPEN)
    (asserts! (<= amount (var-get max-chunk-sats)) ERR_CHUNK_TOO_BIG)
    (try! (check-amount amount))
    (try! (cooldown-tick))
    (let ((price (try! (get-no-pyth-price))))
      (let (
          (limit (get limit price))
          (mins {
            dlmm: (floor-out dlmm limit),
            xyk: (floor-out xyk limit),
            velar: (floor-out velar limit),
          })
        )
        (let ((result (try! (as-contract? ((with-ft SBTC_TOKEN ASSET_SBTC amount))
            (try! (contract-call? JING_ROUTER swap-sbtc-for-stx amount u0 limit none
              none {
              dlmm: dlmm,
              xyk: xyk,
              velar: velar,
            }
              mins (floor-out amount limit)
            ))
          ))))
          (close-if-empty)
          (ok (print {
            notification: "router-swap-split-dia",
            payload: {
              amount: amount,
              dlmm: dlmm,
              xyk: xyk,
              velar: velar,
              mid: (get mid price),
              limit-price: limit,
              price-source: (get source price),
              dia-error: (get dia-error price),
              out: (get out result),
              unsold: (get unsold result),
            },
          }))
        )
      )
    )
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-config)
  {
    window-blocks: (var-get window-blocks),
    leeway-bps: (var-get leeway-bps),
    slippage-bps: (var-get slippage-bps),
    no-pyth-slippage-bps: (var-get no-pyth-slippage-bps),
    pyth-fee-budget: (var-get pyth-fee-budget),
    maker-spread-bps: (var-get maker-spread-bps),
    dia-band-bps: (var-get dia-band-bps),
    max-chunk-sats: (var-get max-chunk-sats),
    router-cooldown-blocks: (var-get router-cooldown-blocks),
    last-router-swap: (var-get last-router-swap),
    jing-market: JING_MARKET,
    jing-router: JING_ROUTER,
    stx-destination: STX_FAIR_BOOK,
  }
)

(define-read-only (get-clock)
  (let ((start (var-get batch-start)))
    {
      batch-start: start,
      window-ends: (match start
        s (some (+ s (var-get window-blocks)))
        none
      ),
      window-open: (window-open),
      window-elapsed: (window-elapsed),
      burn-height: burn-block-height,
    }
  )
)

;; Read-only paths name the market and the token LITERALLY: to the read-only
;; checker a contract-call? through a define-constant alias is a dynamic
;; dispatch and the function is rejected as writing.
(define-read-only (get-status)
  (let ((cycle (contract-call?
      'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
      get-current-cycle
    )))
    {
      sbtc-balance: (sbtc-balance),
      stx-balance: (stx-get-balance current-contract),
      jing-resting: (contract-call?
        'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
        get-token-x-deposit cycle current-contract
      ),
      jing-parked: (contract-call?
        'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
        get-token-x-parked current-contract
      ),
      jing-escrowed: (default-to u0
        (get amount
          (contract-call?
            'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
            get-token-x-pending-deposit current-contract
          ))
      ),
      empty: (is-empty),
      ;; sBTC still sitting in the rewards treasury, claimable via fund-from-treasury
      pending-treasury-sats: (unwrap-panic (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
        get-balance REWARDS_TREASURY
      )),
    }
  )
)

;; Nothing to sell and nothing resting: the next funding opens a new batch.
(define-read-only (is-empty)
  (let ((cycle (contract-call?
      'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
      get-current-cycle
    )))
    (and
      (<= (sbtc-balance) DUST_SATS)
      (is-eq
        (contract-call?
          'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
          get-token-x-deposit cycle current-contract
        )
        u0
      )
      (is-eq
        (contract-call?
          'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
          get-token-x-parked current-contract
        )
        u0
      )
      (is-none (contract-call?
        'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
        get-token-x-pending-deposit current-contract
      ))
    )
  )
)

;; One DIA key, staleness-checked (lifted from ccd015). Literal principal:
;; a contract-call? through a constant is not resolvable in a read-only.
;; DIA supplies the emergency mid. On any DIA response error, use the
;; deployed RFQ's native lower band edge; never substitute a zero price.
(define-read-only (get-no-pyth-price)
  (match (get-dia-price)
    mid (let ((limit (/ (* mid (- BPS_PRECISION (var-get no-pyth-slippage-bps))) BPS_PRECISION)))
      (asserts! (> limit u0) ERR_INVALID_PRICE)
      (ok {
        mid: mid,
        limit: limit,
        source: "dia",
        dia-error: none,
      })
    )
    dia-error (let (
        (mid (try! (contract-call?
          'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.rfq-sbtc-stx-jing-v2-3
          get-native-price
        )))
        (limit (/ mid u2))
      )
      (asserts! (> limit u0) ERR_INVALID_PRICE)
      (ok {
        mid: mid,
        limit: limit,
        source: "native",
        dia-error: (some dia-error),
      })
    )
  )
)

(define-read-only (get-dia-value (key (string-ascii 32)))
  (let (
      (res (unwrap!
        (contract-call? 'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle
          get-value key
        )
        ERR_ORACLE_DIA
      ))
      ;; "now" = the previous block's timestamp (the current block has none yet)
      (last-time (unwrap! (get-stacks-block-info? time (- stacks-block-height u1))
        ERR_NO_BLOCK_TIME
      ))
      (ts (/ (get timestamp res) u1000))
      (v (get value res))
    )
    (asserts! (> v u0) ERR_INVALID_PRICE)
    (asserts! (>= (+ ts MAX_DIA_AGE) last-time) ERR_ORACLE_STALE)
    (ok v)
  )
)

;; DIA's STX/BTC rate in the market's unit (uSTX per sat * 1e10):
;; BTC_USD * 1e8 / STX_USD, the 8-decimal scales cancel (see ccd015).
(define-read-only (get-dia-price)
  (let (
      (stx-usd (try! (get-dia-value "STX/USD")))
      (btc-usd (try! (get-dia-value "BTC/USD")))
      (price (/ (* btc-usd PRICE_PRECISION) stx-usd))
    )
    (asserts! (> price u0) ERR_INVALID_PRICE)
    (ok price)
  )
)

(define-read-only (window-open)
  (match (var-get batch-start)
    s (< burn-block-height (+ s (var-get window-blocks)))
    false
  )
)

(define-read-only (window-elapsed)
  (match (var-get batch-start)
    s (>= burn-block-height (+ s (var-get window-blocks)))
    false
  )
)

;; PRIVATE FUNCTIONS

;; The amount a single-venue swap actually sells.
;;
;; A keeper sizes the final chunk from the balance it read a block earlier, so a
;; sat donated in between leaves a remainder that keeps the batch open and forces
;; a retry at the griefer's chosen pace. Once the whole balance fits in one chunk
;; there is no reason to sell less than all of it, so sweep: the donation goes out
;; with the funds and `close-if-empty` lands on zero in the same transaction.
;;
;; Above the cap the requested chunk is honoured unchanged - that is a mid-run
;; slice, and sweeping it would breach `max-chunk-sats`.
;;
;; Split swaps are deliberately excluded: their amount must equal the sum of the
;; per-venue legs, and there is no way to say which venue the extra dust belongs
;; to.
(define-private (sweep-amount (amount uint))
  (let ((balance (sbtc-balance)))
    (if (<= balance (var-get max-chunk-sats))
      balance
      amount
    )
  )
)

;; what a permissionless router-swap sells: the whole balance, or one full
;; chunk when the balance is bigger
(define-private (chunk-amount)
  (let (
      (balance (sbtc-balance))
      (chunk (var-get max-chunk-sats))
    )
    (if (<= balance chunk)
      balance
      chunk
    )
  )
)

(define-private (sbtc-balance)
  (unwrap-panic (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
    get-balance current-contract
  ))
)

;; A batch opens now. Callers check the vault was empty first.
(define-private (open-window)
  (var-set batch-start (some burn-block-height))
)

;; After an exit: an empty vault has no batch on the clock.
(define-private (close-if-empty)
  (and (is-empty) (var-set batch-start none))
)

;; The mid the market would settle at right now, from a signed Lazer update
;; the market itself verifies (staleness + confidence), then sanity-checked
;; against DIA: |mid - dia| <= dia * band. Public call, not read-only,
;; because the Lazer verification writes.
;; refresh-mid verifies the update and the oracle charges its fee to
;; tx-sender: entries call this only through vault-mid, so the vault pays,
;; never the caller (bounty mv7dfb, Super Orb)
(define-private (current-mid (update (buff 8192)))
  (let (
      (mid (try! (contract-call? JING_MARKET refresh-mid update)))
      (band (var-get dia-band-bps))
    )
    (asserts! (> mid u0) ERR_INVALID_PRICE)
    (if (> band u0)
      (let ((dia (try! (get-dia-price))))
        (asserts! (>= (* mid BPS_PRECISION) (* dia (- BPS_PRECISION band)))
          ERR_ORACLE_DIVERGED
        )
        (asserts! (<= (* mid BPS_PRECISION) (* dia (+ BPS_PRECISION band)))
          ERR_ORACLE_DIVERGED
        )
        (ok mid)
      )
      (ok mid)
    )
  )
)

;; The mid every entry that takes an update reads: current-mid in its own
;; as-contract? scope with the pyth-fee-budget allowance, so tx-sender is the
;; vault and the vault pays the Lazer verify fee. A fee above the budget fails
;; the allowance check (err u0, the with-stx index); current-mid errors pass
;; through unchanged.
(define-private (vault-mid (update (buff 8192)))
  (as-contract? ((with-stx (var-get pyth-fee-budget)))
    (try! (current-mid update))
  )
)

(define-private (ask-of (mid uint))
  (/ (* mid (- BPS_PRECISION (var-get leeway-bps))) BPS_PRECISION)
)

(define-private (floor-of (mid uint))
  (/ (* mid (- BPS_PRECISION (var-get slippage-bps))) BPS_PRECISION)
)

(define-private (phase-limit (mid uint))
  (if (window-open)
    (ask-of mid)
    (floor-of mid)
  )
)

;; STX floor for `amount` sats at `limit`: uSTX = sats * price / (1e8 * 100)
(define-private (floor-out
    (amount uint)
    (limit uint)
  )
  (/ (* amount limit) (* PRICE_PRECISION DECIMAL_FACTOR))
)

;; one router sale per cooldown; stamps the height on the way through
(define-private (cooldown-tick)
  (begin
    (asserts!
      (>= burn-block-height
        (+ (var-get last-router-swap) (var-get router-cooldown-blocks))
      )
      ERR_COOLDOWN
    )
    (ok (var-set last-router-swap burn-block-height))
  )
)

(define-private (check-amount (amount uint))
  (begin
    (asserts! (> amount u0) ERR_NO_FUNDS)
    (asserts! (<= amount (sbtc-balance)) ERR_NO_FUNDS)
    (ok true)
  )
)

(define-private (reclaim-core)
  (let (
      (cycle (contract-call? JING_MARKET get-current-cycle))
      (resting (contract-call? JING_MARKET get-token-x-deposit cycle current-contract))
      (parked (contract-call? JING_MARKET get-token-x-parked current-contract))
      (escrowed (default-to u0
        (get amount
          (contract-call? JING_MARKET get-token-x-pending-deposit
            current-contract
          ))
      ))
    )
    ;; Cancel returns pending escrow + resting + parked in one call, with no
    ;; oracle and no pause check, so a reclaim never waits on a settle.
    (if (or
        (> escrowed u0)
        (> resting u0)
        (> parked u0)
      )
      (let ((refunded (try! (as-contract? ()
          (try! (contract-call? JING_MARKET cancel-token-x-deposit SBTC_TOKEN
            ASSET_SBTC
          ))
        ))))
        (ok (print {
          notification: "jing-reclaim",
          payload: { amount: refunded },
        }))
      )
      (ok (print {
        notification: "jing-reclaim",
        payload: { amount: u0 },
      }))
    )
  )
)
