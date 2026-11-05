
;; ===========================================================================
;; RV ccd016-final harness (TEST-ONLY, appended to the generated vault copy by
;; tests/rv/ccd016-final/build.py; the production source is never edited).
;;
;; Invariant mode: RV calls the private `update-context` after every
;; successful public call. The harness hooks it: it compares a snapshot taken
;; after the previous successful call with the state now (nothing else moves
;; between two successful calls: failed calls revert, mined burn blocks move
;; no funds) and counts transition violations per category in
;; `rv-violations`. The `invariant-*` read-onlys assert those counters stay
;; zero, plus static state invariants.
;;
;; Property mode: the private `test-*` functions drive one entry each with
;; derived inputs and check its exact outcome. `(ok false)` discards a run in
;; place (the action could not be exercised: nothing to sell, market refusal).
;; ===========================================================================

(define-constant RV-DEPLOYER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
(define-constant RV-ACCOUNTS (list
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
  'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC
  'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND
  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB
  'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0
  'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ
  'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP
  'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6))
(define-constant RV-SCALE u10000000000) ;; PRICE_PRECISION * DECIMAL_FACTOR
(define-constant RV-MARKET-FEE-BPS u10) ;; fixture market FEE_BPS
(define-constant RV-REBATE-BPS u20) ;; fixture market TAKER_REBATE_BPS
(define-constant RV-MID-LO u24000000000000)
(define-constant RV-MID-HI u40000000000000)
(define-constant RV-UPDATE 0x01)

;; violation categories
(define-constant RV-V-FLOOR u1)
(define-constant RV-V-PATIENCE u2)
(define-constant RV-V-STX u3)
(define-constant RV-V-FEE u4)
(define-constant RV-V-FUEL u5)
(define-constant RV-V-CLOCK u6)
(define-constant RV-V-BOOK u7)
(define-constant RV-V-TREASURY u8)

(define-constant RV-ROUTER-FNS (list "router-swap" "rv-router-swap"))
(define-constant RV-SPLIT-FNS (list "router-swap-split" "rv-dao-split"))
(define-constant RV-DIA-FNS (list "router-swap-split-dia" "rv-dao-split-dia"))
(define-constant RV-TAKE-FNS (list "jing-take" "rv-dao-take"))
(define-constant RV-RECALL-FNS (list "dao-recall-sbtc" "rv-dao-recall"))
(define-constant RV-FUEL-FNS (list "fuel-fair-book"))
(define-constant RV-FUND-FNS (list "fund-from-treasury" "rv-open-window"))
;; rv-open-window empties the vault (reclaim + recall) before it funds, so its
;; clock may restart from a non-empty snapshot (the intermediate state is empty)
(define-constant RV-REOPEN-FNS (list "rv-open-window"))
(define-constant RV-ENTRY-FNS (list "router-swap" "rv-router-swap" "router-swap-split" "rv-dao-split"
  "jing-take" "rv-dao-take" "jing-place" "rv-place" "jing-refloor" "rv-dao-refloor" "rv-open-window"))
(define-constant RV-EXIT-FNS (list "router-swap" "rv-router-swap" "router-swap-split" "rv-dao-split"
  "router-swap-split-dia" "rv-dao-split-dia" "jing-take" "rv-dao-take" "dao-recall-sbtc"
  "rv-dao-recall" "fuel-fair-book"))
(define-constant RV-CLEAR-FNS (list "router-swap" "rv-router-swap" "router-swap-split" "rv-dao-split"
  "router-swap-split-dia" "rv-dao-split-dia" "jing-take" "rv-dao-take" "dao-recall-sbtc"
  "rv-dao-recall" "fuel-fair-book" "close-batch"))
(define-constant RV-TREASURY-IN-FNS (list "rv-treasury"))

;; test-only DAO flag read by the rewritten is-dao-or-extension
(define-data-var rv-dao bool false)
;; STX the harness itself put into the vault (rv-fund-vault-stx)
(define-data-var rv-stx-in uint u0)
(define-data-var rv-ready bool false)
(define-data-var rv-stx-base uint u0)
(define-data-var rv-snap
  { vsbtc: uint, vmkt: uint, vstx: uint, book: uint, feev: uint, feeo: uint, treas: uint,
    start: (optional uint), xlimit: uint, stxin: uint }
  { vsbtc: u0, vmkt: u0, vstx: u0, book: u0, feev: u0, feeo: u0, treas: u0,
    start: none, xlimit: u0, stxin: u0 })
(define-map rv-violations uint uint)
(define-data-var rv-last-violation { name: (string-ascii 100), kind: uint, burn: uint }
  { name: "", kind: u0, burn: u0 })

(define-map context (string-ascii 100) { called: uint })

;; ---------------------------------------------------------------------------
;; readers
;; ---------------------------------------------------------------------------

(define-private (rv-ft (who principal))
  (unwrap-panic (contract-call? .mock-ft get-balance who)))
(define-private (rv-ft-fold (who principal) (acc uint)) (+ acc (rv-ft who)))
(define-private (rv-stx-fold (who principal) (acc uint)) (+ acc (stx-get-balance who)))
;; RV draws naturals biased toward 0 and 2^31: spread them before folding
(define-private (rv-r (raw uint) (n uint)) (mod (* (+ (mod raw u4294967296) u1) u2654435761) n))
(define-private (rv-min (a uint) (b uint)) (if (< a b) a b))
(define-private (rv-in (name (string-ascii 100)) (names (list 16 (string-ascii 100))))
  (is-some (index-of? names name)))

(define-read-only (rv-stx-total)
  (fold rv-stx-fold RV-ACCOUNTS
    (+ (stx-get-balance current-contract)
       (stx-get-balance .ccd015-redemption-book-mia-stx)
       (stx-get-balance .mock-lazer-oracle)
       (stx-get-balance .mock-router)
       (stx-get-balance .v6-market))))

(define-read-only (rv-ft-holders)
  (fold rv-ft-fold RV-ACCOUNTS
    (+ (rv-ft current-contract) (rv-ft .mock-treasury) (rv-ft .v6-market) (rv-ft .mock-router))))

(define-read-only (rv-mkt)
  (let ((c (contract-call? .v6-market get-current-cycle)))
    (+ (contract-call? .v6-market get-token-x-deposit c current-contract)
       (contract-call? .v6-market get-token-x-parked current-contract)
       (default-to u0 (get amount (contract-call? .v6-market get-token-x-pending-deposit current-contract))))))

(define-read-only (rv-violation-count (k uint)) (default-to u0 (map-get? rv-violations k)))
(define-read-only (rv-get-last-violation) (var-get rv-last-violation))

(define-private (rv-snapshot)
  (let ((fees (contract-call? .mock-lazer-oracle get-fees)))
    { vsbtc: (rv-ft current-contract),
      vmkt: (rv-mkt),
      vstx: (stx-get-balance current-contract),
      book: (stx-get-balance .ccd015-redemption-book-mia-stx),
      feev: (get vault fees),
      feeo: (get other fees),
      treas: (rv-ft .mock-treasury),
      start: (var-get batch-start),
      xlimit: (get limit (contract-call? .v6-market get-token-x-order current-contract)),
      stxin: (var-get rv-stx-in) }))

(define-private (rv-flag (bad bool) (kind uint) (name (string-ascii 100)))
  (begin
    (and bad
      (begin
        (map-set rv-violations kind (+ u1 (rv-violation-count kind)))
        (var-set rv-last-violation { name: name, kind: kind, burn: burn-block-height })))
    true))

;; ---------------------------------------------------------------------------
;; transition checks (one successful call: snapshot a -> state b)
;; ---------------------------------------------------------------------------

(define-private (rv-check
    (name (string-ascii 100))
    (a { vsbtc: uint, vmkt: uint, vstx: uint, book: uint, feev: uint, feeo: uint, treas: uint,
         start: (optional uint), xlimit: uint, stxin: uint })
    (b { vsbtc: uint, vmkt: uint, vstx: uint, book: uint, feev: uint, feeo: uint, treas: uint,
         start: (optional uint), xlimit: uint, stxin: uint }))
  (let (
      (claim-a (+ (get vsbtc a) (get vmkt a)))
      (claim-b (+ (get vsbtc b) (get vmkt b)))
      (sold (if (> claim-a claim-b) (- claim-a claim-b) u0))
      (dbook (- (to-int (get book b)) (to-int (get book a))))
      (dfeev (- (to-int (get feev b)) (to-int (get feev a))))
      (dfeeo (- (to-int (get feeo b)) (to-int (get feeo a))))
      (dtreas (- (to-int (get treas b)) (to-int (get treas a))))
      (dstxin (- (to-int (get stxin b)) (to-int (get stxin a))))
      ;; gross STX the vault received in this call: what it holds now, plus
      ;; what it paid to the book and to the oracle, minus harness top-ups
      (proceeds (- (+ (to-int (get vstx b)) dbook dfeev) (+ (to-int (get vstx a)) dstxin)))
      (mid (contract-call? .mock-lazer-oracle get-mid))
      (fl (floor-of mid))
      (vl (/ (* mid (- BPS_PRECISION VELAR_SLIPPAGE_BPS)) BPS_PRECISION))
      (budget (var-get pyth-fee-budget))
      (elapsed-a (match (get start a) s (>= burn-block-height (+ s (var-get window-blocks))) false))
      (empty-a (and (<= (get vsbtc a) DUST_SATS) (is-eq (get vmkt a) u0)))
      (empty-b (is-empty))
      (router (rv-in name RV-ROUTER-FNS))
      (split (rv-in name RV-SPLIT-FNS))
      (dia (rv-in name RV-DIA-FNS))
      (take (rv-in name RV-TAKE-FNS))
      (recall (rv-in name RV-RECALL-FNS))
      (fuel (rv-in name RV-FUEL-FNS))
      (entry (rv-in name RV-ENTRY-FNS))
      (vault-sale (or router split dia take))
    )
    ;; 1. FLOOR: every sale clears the floor of its path
    (rv-flag (and (> sold u0) router
      (or (<= sold ROUTER_SLACK_SATS)
          (< proceeds (to-int (floor-out (- sold ROUTER_SLACK_SATS) fl)))))
      RV-V-FLOOR name)
    (rv-flag (and (> sold u0) split
      (< (+ proceeds 4) (to-int (floor-out sold (rv-min fl vl)))))
      RV-V-FLOOR name)
    (rv-flag (and (> sold u0) dia
      (match (get-no-pyth-price)
        p (< (+ proceeds 3) (to-int (floor-out sold (get limit p))))
        e false))
      RV-V-FLOOR name)
    (rv-flag (and (> sold u0) take
      (< (* (+ proceeds 2) (to-int BPS_PRECISION))
         (to-int (* (floor-out sold fl) (- BPS_PRECISION (+ RV-MARKET-FEE-BPS RV-REBATE-BPS))))))
      RV-V-FLOOR name)
    ;; anything else that sold is a maker fill of the resting peg: never under
    ;; the order's floor (net of the maker fee)
    (rv-flag (and (> sold u0) (not vault-sale) (not recall)
      (or (is-eq (get xlimit a) u0)
          (< (* (+ proceeds 2) (to-int BPS_PRECISION))
             (to-int (* (floor-out sold (get xlimit a)) (- BPS_PRECISION RV-MARKET-FEE-BPS))))))
      RV-V-FLOOR name)
    ;; 2. PATIENCE: the vault never takes or routes while the window is open
    (rv-flag (and vault-sale (not elapsed-a)) RV-V-PATIENCE name)
    ;; 3. STX: no proceeds without a sale; a recall earns nothing; the vault's
    ;; STX only ever goes to the book (fuel) or to the oracle fee
    (rv-flag (or (< proceeds 0)
                 (and (is-eq sold u0) (not (is-eq proceeds 0)))
                 (and recall (not (is-eq proceeds 0))))
      RV-V-STX name)
    ;; 4. FEES: inside a vault entry only the vault pays the Lazer fee, at most
    ;; one budget per as-contract? scope (two scopes); nothing else spends it
    (rv-flag (or (and entry (> dfeeo 0))
                 (and (not entry) (> dfeev 0))
                 (> dfeev (to-int (* u2 budget))))
      RV-V-FEE name)
    ;; 5. FUEL: the book gets balance - min(balance, budget), the vault keeps
    ;; min(balance, budget)
    (rv-flag (and fuel
      (or (not (is-eq dbook (to-int (- (get vstx a) (rv-min (get vstx a) budget)))))
          (not (is-eq (get vstx b) (rv-min (get vstx a) budget)))))
      RV-V-FUEL name)
    ;; 7. the book only ever receives through fuel-fair-book
    (rv-flag (and (not fuel) (not (is-eq dbook 0))) RV-V-BOOK name)
    ;; 6. CLOCK: set only by funding, at the current height, and only from an
    ;; empty vault / no clock / an elapsed batch whose leftover is unsellable
    ;; dust; cleared only on an empty vault, by an exit or close-batch; an exit
    ;; that empties the vault clears it
    (rv-flag
      (if (is-eq (get start a) (get start b))
        false
        (match (get start b)
          t (not (and (rv-in name RV-FUND-FNS) (is-eq t burn-block-height)
                      (or empty-a (is-none (get start a)) (rv-in name RV-REOPEN-FNS)
                          (and elapsed-a (<= claim-a ROUTER_SLACK_SATS)))))
          (not (and empty-b (rv-in name RV-CLEAR-FNS)))))
      RV-V-CLOCK name)
    (rv-flag (and (rv-in name RV-EXIT-FNS) empty-b (is-some (get start b))) RV-V-CLOCK name)
    ;; 8. TREASURY: sBTC returns to it only through a recall, exactly what left
    ;; the vault; it only loses sBTC to funding
    (rv-flag (or (and recall (not (is-eq dtreas (to-int sold))))
                 (and (rv-in name RV-REOPEN-FNS) (> dtreas 0))
                 (and (> dtreas 0) (not recall) (not (rv-in name RV-TREASURY-IN-FNS)))
                 (and (< dtreas 0) (not (rv-in name RV-FUND-FNS))))
      RV-V-TREASURY name)
    true))

(define-private (update-context (function-name (string-ascii 100)) (called uint))
  (begin
    (map-set context function-name { called: called })
    (if (var-get rv-ready)
      (and (> called u0) (rv-check function-name (var-get rv-snap) (rv-snapshot)))
      (begin (var-set rv-stx-base (rv-stx-total)) (var-set rv-ready true)))
    (var-set rv-snap (rv-snapshot))
    (ok true)))

;; ---------------------------------------------------------------------------
;; wrappers (fuzzed like any public function; a wrapper succeeds only when its
;; action happened, so RV's SUCCESSFUL counts are real movement)
;; ---------------------------------------------------------------------------

(define-public (rv-treasury (raw uint))
  (contract-call? .mock-ft mint (+ u1000 (rv-r raw u3000000)) .mock-treasury))

;; dust griefing: 1-2 sats straight into the vault (under DUST_SATS), one
;; call in five 3-10 sats (over it: the vault is no longer empty)
(define-public (rv-donate (raw uint))
  (contract-call? .mock-ft mint (if (is-eq (rv-r raw u5) u0) (+ u3 (rv-r raw u8)) (+ u1 (rv-r raw u2))) current-contract))

(define-public (rv-fund-router (raw uint))
  (stx-transfer? (+ u1000000000 (rv-r raw u100000000000)) tx-sender .mock-router))

(define-public (rv-fund-vault-stx (raw uint))
  (let ((amount (+ u1 (rv-r raw u10000000))))
    (try! (stx-transfer? amount tx-sender current-contract))
    (ok (var-set rv-stx-in (+ (var-get rv-stx-in) amount)))))

;; the Lazer mid walks -3%..+3% per call, clamped to the fixture band
(define-public (rv-mid (raw uint))
  (let (
      (m (contract-call? .mock-lazer-oracle get-mid))
      (n (/ (* m (+ u9700 (rv-r raw u601))) u10000))
    )
    (contract-call? .mock-lazer-oracle set-mid
      (if (< n RV-MID-LO) RV-MID-LO (if (> n RV-MID-HI) RV-MID-HI n)))))

;; DIA and the native band: mostly healthy, sometimes stale / failed / skewed
(define-public (rv-world (raw uint))
  (begin
    (try! (contract-call? .mock-dia set-stale (is-eq (rv-r raw u23) u0)))
    (try! (contract-call? .mock-dia set-failed (is-eq (rv-r raw u29) u0)))
    (try! (contract-call? .mock-native set-failed (is-eq (rv-r raw u13) u0)))
    (try! (contract-call? .mock-native set-mid
      (if (is-eq (rv-r raw u17) u0) u0 (contract-call? .mock-lazer-oracle get-mid))))
    (contract-call? .mock-dia set-skew
      (if (< (rv-r raw u10) u7) u10000 (+ u8800 (rv-r raw u2401))))))

;; adversarial router: price 95%..101% of the mid, a third of calls partial
(define-public (rv-router-knobs (q uint) (f uint))
  (contract-call? .mock-router set-knobs (+ u9500 (rv-r q u601))
    (if (is-eq (rv-r f u3) u0) (rv-r f u10001) u10000)))

;; Lazer verify fee: zero 7 in 10; 2 in 10 a fee inside the DAO budget; 1 in
;; 10 up to 5000 uSTX (over the budget: every fee-bearing entry must fail)
(define-public (rv-fee (raw uint))
  (let ((k (rv-r raw u10)))
    (contract-call? .mock-lazer-oracle set-fee
      (if (< k u7) u0
        (if (< k u9) (/ (var-get pyth-fee-budget) (+ u1 (rv-r raw u3)))
          (* u1000 (+ u1 (rv-r raw u5))))))))

;; a wallet bid resting 0.5%..3% under the mid (fixed price)
(define-public (rv-bid (raw uint) (off uint))
  (let ((m (contract-call? .mock-lazer-oracle get-mid)))
    (contract-call? .v6-market deposit-token-y (+ u1000000 (rv-r raw u3000000000))
      (/ (* m (- u9950 (rv-r off u250))) u10000) none 0x .mock-ft "mock-ft")))

(define-public (rv-cancel-bid)
  (contract-call? .v6-market cancel-token-y-deposit .mock-ft "mock-ft"))

;; move the mid onto a resting bid so the next settle can cross the vault
;; (private: left alone, bids at the mid make the market refuse every peg)
(define-private (rv-mid-to-bid (who principal))
  (let ((l (contract-call? .v6-market get-token-y-limit who)))
    (asserts! (> l u0) (err u9002))
    (contract-call? .mock-lazer-oracle set-mid l)))

(define-public (rv-settle)
  (begin
    (try! (contract-call? .v6-market settle-with-refresh 0x .mock-ft "mock-ft" .mock-ft "mock-ft"))
    (ok true)))

;; a settle that fills the vault's resting peg (any other settle is reverted)
(define-public (rv-settle-vault)
  (let ((c0 (+ (sbtc-balance) (rv-mkt))))
    (try! (contract-call? .v6-market settle-with-refresh 0x .mock-ft "mock-ft" .mock-ft "mock-ft"))
    (asserts! (< (+ (sbtc-balance) (rv-mkt)) c0) (err u9001))
    (ok true)))

;; a fresh batch: the DAO reclaims and recalls everything, then anyone funds,
;; which opens a window, then jing-place rests it if the market takes the peg
;; (one wrapper call in two, the rest revert)
(define-public (rv-open-window (raw uint))
  (begin
    (asserts! (is-eq (rv-r raw u2) u0) (err u9005))
    (var-set rv-dao true)
    (try! (dao-reclaim none))
    (if (> (sbtc-balance) u0) (begin (try! (dao-recall-sbtc)) true) true)
    (var-set rv-dao false)
    (try! (contract-call? .mock-ft mint (+ u1000 (rv-r raw u3000000)) .mock-treasury))
    (try! (fund-from-treasury))
    (asserts! (window-open) (err u9006))
    ;; and rest it on the book when the market takes the peg
    (is-ok (jing-place RV-UPDATE))
    (ok true)))

;; the permissionless entries with a non-empty update (fee-bearing)
(define-public (rv-router-swap) (begin (try! (router-swap RV-UPDATE)) (ok true)))
(define-public (rv-place) (begin (try! (jing-place RV-UPDATE)) (ok true)))

;; the first resting bid becomes the mid, then a settle that fills the vault
(define-public (rv-cross-vault)
  (let ((ys (contract-call? .v6-market get-token-y-depositors (contract-call? .v6-market get-current-cycle))))
    (asserts! (> (len ys) u0) (err u9003))
    (try! (rv-mid-to-bid (unwrap-panic (element-at? ys u0))))
    (rv-settle-vault)))

;; bounded DAO configuration (any RV sender acts as the DAO here)
(define-public (rv-dao-config (action uint) (raw uint))
  (let ((a (rv-r action u9)))
    (var-set rv-dao true)
    (try!
      (if (is-eq a u0) (set-window-blocks (if (is-eq (rv-r raw u4) u0) (rv-r raw u41) (+ u60 (rv-r raw u241))))
      (if (is-eq a u1) (set-slippage-bps (rv-r raw u301))
      (if (is-eq a u2) (set-leeway-bps (rv-r raw u1001))
      (if (is-eq a u3) (set-max-chunk-sats (+ u1 (rv-r raw u2000000)))
      (if (is-eq a u4) (set-router-cooldown (rv-r raw u3))
      (if (is-eq a u5) (set-dia-band-bps (if (is-eq (rv-r raw u3) u0) u0 (+ u500 (rv-r raw u2000))))
      (if (is-eq a u6) (set-no-pyth-slippage-bps (rv-r raw u5001))
      (if (is-eq a u7) (set-pyth-fee-budget (* u1000 (rv-r raw u11)))
        (set-router-cooldown u0))))))))))
    (var-set rv-dao false)
    (ok true)))

(define-public (rv-dao-take (raw uint))
  (begin
    (var-set rv-dao true)
    (try! (jing-take (+ u1 (rv-r raw u3000000)) RV-UPDATE))
    (var-set rv-dao false)
    (ok true)))

(define-private (rv-legs (amount uint) (raw uint))
  (let (
      (d (/ (* amount (rv-r raw u101)) u100))
      (x (/ (- amount d) u2))
    )
    { dlmm: d, xyk: x, velar: (- amount (+ d x)) }))

(define-public (rv-dao-split (raw uint))
  (let ((amount (chunk-amount)) (l (rv-legs amount raw)))
    (var-set rv-dao true)
    (try! (router-swap-split amount u0 (get dlmm l) (get xyk l) (get velar l) RV-UPDATE))
    (var-set rv-dao false)
    (ok true)))

(define-public (rv-dao-split-dia (raw uint))
  (let ((amount (chunk-amount)) (l (rv-legs amount raw)))
    (var-set rv-dao true)
    (try! (router-swap-split-dia amount (get dlmm l) (get xyk l) (get velar l)))
    (var-set rv-dao false)
    (ok true)))

(define-public (rv-dao-recall (raw uint))
  (begin
    ;; a recall empties the vault: one wrapper call in two
    (asserts! (is-eq (rv-r raw u2) u0) (err u9004))
    (var-set rv-dao true)
    (try! (dao-recall-sbtc))
    (var-set rv-dao false)
    (ok true)))

(define-public (rv-dao-reclaim (raw uint))
  (begin
    ;; one wrapper call in three: a reclaim takes the vault off the book
    (asserts! (is-eq (rv-r raw u3) u0) (err u9007))
    (var-set rv-dao true)
    (try! (dao-reclaim none))
    (var-set rv-dao false)
    (ok true)))

(define-public (rv-dao-refloor)
  (begin
    (var-set rv-dao true)
    (try! (jing-refloor RV-UPDATE))
    (var-set rv-dao false)
    (ok true)))

;; ---------------------------------------------------------------------------
;; invariants
;; ---------------------------------------------------------------------------

(define-read-only (invariant-never-below-floor) (is-eq (rv-violation-count RV-V-FLOOR) u0))
(define-read-only (invariant-no-sale-in-patience) (is-eq (rv-violation-count RV-V-PATIENCE) u0))
(define-read-only (invariant-stx-only-to-book-or-fee) (is-eq (rv-violation-count RV-V-STX) u0))
(define-read-only (invariant-only-vault-pays-fee) (is-eq (rv-violation-count RV-V-FEE) u0))
(define-read-only (invariant-fuel-keeps-budget)
  (and (is-eq (rv-violation-count RV-V-FUEL) u0) (is-eq (rv-violation-count RV-V-BOOK) u0)))
(define-read-only (invariant-clock-transitions) (is-eq (rv-violation-count RV-V-CLOCK) u0))
(define-read-only (invariant-treasury-flows) (is-eq (rv-violation-count RV-V-TREASURY) u0))

;; sBTC leaves the vault only to the treasury, the market or the router
(define-read-only (invariant-sbtc-destinations)
  (is-eq (get bad (contract-call? .mock-ft get-vault-out)) u0))
;; no sBTC appears or vanishes: supply = every holder the harness can reach
(define-read-only (invariant-sbtc-conservation)
  (is-eq (unwrap-panic (contract-call? .mock-ft get-total-supply)) (rv-ft-holders)))
;; no STX appears or vanishes across vault, book, oracle, router, market, wallets
(define-read-only (invariant-stx-conservation)
  (or (not (var-get rv-ready)) (is-eq (rv-stx-total) (var-get rv-stx-base))))

(define-read-only (invariant-window-exclusive)
  (not (and (window-open) (window-elapsed))))
(define-read-only (invariant-no-clock-no-window)
  (or (is-some (var-get batch-start)) (and (not (window-open)) (not (window-elapsed)))))
(define-read-only (invariant-clock-not-future)
  (and (match (var-get batch-start) s (<= s burn-block-height) true)
       (<= (var-get last-router-swap) burn-block-height)))
(define-read-only (invariant-config-bounded)
  (and (<= (var-get window-blocks) MAX_WINDOW_BLOCKS)
       (<= (var-get no-pyth-slippage-bps) MAX_NO_PYTH_SLIPPAGE_BPS)
       (<= (var-get pyth-fee-budget) MAX_PYTH_FEE_BUDGET)
       (<= (var-get leeway-bps) MAX_LEEWAY_BPS)
       (<= (var-get slippage-bps) MAX_SLIPPAGE_BPS)
       (<= (var-get dia-band-bps) MAX_DIA_BAND_BPS)
       (> (var-get max-chunk-sats) u0)
       (<= (var-get max-chunk-sats) MAX_CHUNK_SATS)
       (<= (var-get router-cooldown-blocks) MAX_COOLDOWN_BLOCKS)))
;; whatever rests on the book is a zero-spread peg with a positive floor
(define-read-only (invariant-resting-peg)
  (let ((o (contract-call? .v6-market get-token-x-order current-contract)))
    (or (is-eq (rv-mkt) u0)
        (and (> (get limit o) u0) (is-eq (get spread-bps o) (some u0))))))
;; the test-only DAO flag is never left raised
(define-read-only (invariant-dao-flag-down) (not (var-get rv-dao)))

;; ---------------------------------------------------------------------------
;; property tests (RV property mode; private test-* functions)
;; ---------------------------------------------------------------------------

(define-private (rv-as-dao-config (window uint) (cooldown uint) (band uint) (budget uint))
  (begin
    (var-set rv-dao true)
    (unwrap-panic (set-window-blocks window))
    (unwrap-panic (set-router-cooldown cooldown))
    (unwrap-panic (set-dia-band-bps band))
    (unwrap-panic (set-pyth-fee-budget budget))
    (var-set rv-dao false)))

(define-private (rv-healthy-world (mid uint))
  (begin
    (unwrap-panic (contract-call? .mock-lazer-oracle set-mid mid))
    (unwrap-panic (contract-call? .mock-lazer-oracle set-fee u0))
    (unwrap-panic (contract-call? .mock-dia set-stale false))
    (unwrap-panic (contract-call? .mock-dia set-failed false))
    (unwrap-panic (contract-call? .mock-dia set-skew u10000))
    (unwrap-panic (contract-call? .mock-native set-failed false))
    (unwrap-panic (contract-call? .mock-native set-mid mid))
    true))

(define-private (rv-band-mid (raw uint)) (+ RV-MID-LO (rv-r raw (- RV-MID-HI RV-MID-LO))))

;; elapsed batch with sBTC in the wallet: window 0, cooldown 0, DIA band off,
;; no fee; a treasury reward pulled in (opens a clock if there was none)
(define-private (rv-setup-sell (raw uint))
  (begin
    (rv-as-dao-config u0 u0 u0 u0)
    (rv-healthy-world (rv-band-mid raw))
    (unwrap-panic (contract-call? .mock-ft mint (+ u1000 (rv-r raw u3000000)) .mock-treasury))
    (unwrap-panic (fund-from-treasury))
    (unwrap-panic (stx-transfer? u20000000000 tx-sender .mock-router))
    true))

;; empty the vault (reclaim + recall), then open a fresh window of `window`
(define-private (rv-fresh-batch (raw uint) (window uint))
  (begin
    (rv-as-dao-config window u0 u0 u0)
    (var-set rv-dao true)
    (unwrap-panic (dao-reclaim none))
    (and (> (sbtc-balance) u0) (is-ok (dao-recall-sbtc)))
    (var-set rv-dao false)
    (unwrap-panic (contract-call? .mock-ft mint (+ u1000 (rv-r raw u3000000)) .mock-treasury))
    (unwrap-panic (fund-from-treasury))
    true))

;; router-swap: sells exactly what the router took, for at least the floor of
;; what sold (less ROUTER_SLACK_SATS); refuses (u16047) only a real sub-floor
;; fill, and then nothing moves
(define-private (test-router-swap-floor (raw uint) (q uint) (f uint) (slip uint))
  (begin
    (rv-setup-sell raw)
    (var-set rv-dao true)
    (unwrap-panic (set-slippage-bps (rv-r slip u1001)))
    (var-set rv-dao false)
    (unwrap-panic (contract-call? .mock-router set-knobs (+ u9000 (rv-r q u1101))
      (if (is-eq (rv-r f u2) u0) u10000 (rv-r f u10001))))
    (let (
        (amount (chunk-amount))
        (mid (contract-call? .mock-lazer-oracle get-mid))
        (limit (floor-of mid))
        (v0 (sbtc-balance))
        (s0 (stx-get-balance current-contract))
        (k (contract-call? .mock-router get-knobs))
        (fill (/ (* amount (get fill k)) u10000))
        (out (/ (* (* fill mid) (get quality k)) (* RV-SCALE u10000)))
        (r (router-swap RV-UPDATE))
      )
      (match r okv
        (begin
          (asserts! (> fill ROUTER_SLACK_SATS) (err u101))
          (asserts! (>= out (floor-out (- fill ROUTER_SLACK_SATS) limit)) (err u102))
          (asserts! (is-eq (sbtc-balance) (- v0 fill)) (err u103))
          (asserts! (is-eq (stx-get-balance current-contract) (+ s0 out)) (err u104))
          (ok true))
        e (begin
          (asserts! (is-eq (sbtc-balance) v0) (err u105))
          (asserts! (is-eq (stx-get-balance current-contract) s0) (err u106))
          (if (is-eq e u16047)
            (begin
              (asserts! (or (<= fill ROUTER_SLACK_SATS) (is-eq out u0)
                            (< out (floor-out (- fill ROUTER_SLACK_SATS) limit))) (err u107))
              (ok true))
            (if (is-eq amount u0) (ok false) (err e))))))))

;; router-swap-split: on success the STX received covers every leg's floor
;; (mid - slippage, Velar mid - 0.6%) on the full amount
(define-private (test-split-floor (raw uint) (legs uint) (q uint) (slip uint))
  (begin
    (rv-setup-sell raw)
    (var-set rv-dao true)
    (unwrap-panic (set-slippage-bps (rv-r slip u1001)))
    (var-set rv-dao false)
    (unwrap-panic (contract-call? .mock-router set-knobs (+ u9000 (rv-r q u1101))
      (if (is-eq (rv-r legs u3) u0) (rv-r q u10001) u10000)))
    (let (
        (amount (chunk-amount))
        (l (rv-legs amount legs))
        (mid (contract-call? .mock-lazer-oracle get-mid))
        (limit (floor-of mid))
        (vlimit (/ (* mid (- BPS_PRECISION VELAR_SLIPPAGE_BPS)) BPS_PRECISION))
        (min-out (+ (floor-out (+ (get dlmm l) (get xyk l)) limit) (floor-out (get velar l) vlimit)))
        (v0 (sbtc-balance))
        (s0 (stx-get-balance current-contract))
        (r (begin
          (var-set rv-dao true)
          (let ((res (router-swap-split amount u0 (get dlmm l) (get xyk l) (get velar l) RV-UPDATE)))
            (var-set rv-dao false)
            res)))
      )
      (match r okv
        (let ((sold (- v0 (sbtc-balance))) (got (- (stx-get-balance current-contract) s0)))
          (asserts! (> sold u0) (err u201))
          (asserts! (>= got min-out) (err u202))
          (asserts! (>= got (floor-out sold (rv-min limit vlimit))) (err u203))
          (ok true))
        e (begin
          (asserts! (is-eq (sbtc-balance) v0) (err u204))
          (if (is-eq amount u0) (ok false) (if (is-eq e u3002) (ok true) (err e))))))))

;; router-swap-split-dia: the emergency floor is DIA * (1 - tolerance), or
;; half the native price when DIA errors; never a zero limit; on success the
;; STX received covers it on the full amount
(define-private (test-split-dia-floor (raw uint) (legs uint) (q uint) (w uint))
  (begin
    (rv-setup-sell raw)
    (var-set rv-dao true)
    (unwrap-panic (set-no-pyth-slippage-bps (rv-r w u5001)))
    (var-set rv-dao false)
    (unwrap-panic (contract-call? .mock-dia set-stale (is-eq (rv-r w u5) u0)))
    (unwrap-panic (contract-call? .mock-dia set-failed (is-eq (rv-r w u7) u0)))
    (unwrap-panic (contract-call? .mock-dia set-skew (+ u5000 (rv-r q u10001))))
    (unwrap-panic (contract-call? .mock-native set-failed (is-eq (rv-r w u11) u0)))
    (unwrap-panic (contract-call? .mock-native set-mid
      (if (is-eq (rv-r w u13) u0) u1 (rv-band-mid w))))
    (unwrap-panic (contract-call? .mock-router set-knobs (+ u4000 (rv-r q u7001)) u10000))
    (let (
        (amount (chunk-amount))
        (l (rv-legs amount legs))
        (price (get-no-pyth-price))
        (v0 (sbtc-balance))
        (s0 (stx-get-balance current-contract))
        (r (begin
          (var-set rv-dao true)
          (let ((res (router-swap-split-dia amount (get dlmm l) (get xyk l) (get velar l))))
            (var-set rv-dao false)
            res)))
      )
      (rv-healthy-world (contract-call? .mock-lazer-oracle get-mid))
      (match price p
        (begin
          (asserts! (> (get limit p) u0) (err u301))
          (asserts! (is-eq (get limit p)
            (if (is-eq (get source p) "native")
              (/ (get mid p) u2)
              (/ (* (get mid p) (- BPS_PRECISION (var-get no-pyth-slippage-bps))) BPS_PRECISION)))
            (err u302))
          (match r okv
            (let ((sold (- v0 (sbtc-balance))) (got (- (stx-get-balance current-contract) s0)))
              (asserts! (> sold u0) (err u303))
              (asserts! (>= got (floor-out amount (get limit p))) (err u304))
              (ok true))
            e (begin
              (asserts! (is-eq (sbtc-balance) v0) (err u305))
              (if (is-eq amount u0) (ok false) (if (is-eq e u3002) (ok true) (err e))))))
        pe (begin
          ;; no emergency price: the sale must not happen
          (asserts! (is-err r) (err u306))
          (asserts! (is-eq (sbtc-balance) v0) (err u307))
          (ok true))))))

;; jing-take: a fill against resting bids clears mid * (1 - slippage), net of
;; the market's 10 bps fee and 20 bps taker rebate; a failed take moves nothing
(define-private (test-jing-take-floor (raw uint) (off uint) (slip uint))
  (begin
    (rv-setup-sell raw)
    (var-set rv-dao true)
    (unwrap-panic (set-slippage-bps (rv-r slip u1001)))
    (unwrap-panic (dao-reclaim none))
    (var-set rv-dao false)
    (let ((mid (contract-call? .mock-lazer-oracle get-mid)))
      ;; a bid sized to absorb the whole wallet balance (fill-or-kill take)
      (is-ok (contract-call? .v6-market deposit-token-y
        (+ u1000000 (/ (* (/ (* (sbtc-balance) mid) RV-SCALE) (+ u11000 (rv-r raw u5000))) u10000))
        (/ (* mid (- u10000 (rv-r off u300))) u10000) none 0x .mock-ft "mock-ft"))
      (let (
          (c0 (+ (sbtc-balance) (rv-mkt)))
          (s0 (stx-get-balance current-contract))
          (r (begin
            (var-set rv-dao true)
            (let ((res (jing-take (+ u1 (rv-r raw u3000000)) RV-UPDATE)))
              (var-set rv-dao false)
              res)))
          (sold (- c0 (+ (sbtc-balance) (rv-mkt))))
          (got (- (stx-get-balance current-contract) s0))
        )
        (is-ok (contract-call? .v6-market cancel-token-y-deposit .mock-ft "mock-ft"))
        (match r okv
          (begin
            (asserts! (> sold u0) (err u401))
            (asserts! (>= (* (+ got u2) BPS_PRECISION)
              (* (floor-out sold (floor-of mid)) (- BPS_PRECISION (+ RV-MARKET-FEE-BPS RV-REBATE-BPS))))
              (err u402))
            (ok true))
          e (begin
            (asserts! (is-eq sold u0) (err u403))
            (asserts! (is-eq got u0) (err u404))
            (ok false)))))))

;; jing-place (window open): the whole wallet balance rests as a zero-spread
;; peg with floor mid * (1 - leeway); nothing leaves the vault's claim
(define-private (test-place-peg (raw uint) (lee uint))
  (begin
    (rv-fresh-batch raw u1008)
    (rv-healthy-world (rv-band-mid lee))
    (var-set rv-dao true)
    (unwrap-panic (set-leeway-bps (rv-r lee u1001)))
    (var-set rv-dao false)
    (let (
        (mid (contract-call? .mock-lazer-oracle get-mid))
        (open (window-open))
        (amount (sbtc-balance))
        (c0 (+ amount (rv-mkt)))
        (r (jing-place RV-UPDATE))
      )
      (if open
        (match r okv
          (let ((o (contract-call? .v6-market get-token-x-order current-contract)))
            (asserts! (is-eq (sbtc-balance) u0) (err u501))
            (asserts! (is-eq (+ (sbtc-balance) (rv-mkt)) c0) (err u502))
            (asserts! (is-eq (get limit o) (ask-of mid)) (err u503))
            (asserts! (is-eq (get spread-bps o) (some u0)) (err u504))
            (ok true))
          e (ok false))
        (begin
          (asserts! (is-eq r (err u16030)) (err u505))
          (ok true))))))

;; dao-recall-sbtc: the whole wallet balance goes back to the treasury, exactly
(define-private (test-recall (raw uint) (d uint))
  (begin
    (and (> (rv-r d u3) u0) (is-ok (contract-call? .mock-ft mint (+ u1 (rv-r raw u100000)) current-contract)))
    (let (
        (v0 (sbtc-balance))
        (t0 (rv-ft .mock-treasury))
        (r (begin
          (var-set rv-dao true)
          (let ((res (dao-recall-sbtc))) (var-set rv-dao false) res)))
      )
      (if (is-eq v0 u0)
        (begin (asserts! (is-eq r (err u16006)) (err u601)) (ok true))
        (begin
          (asserts! (is-ok r) (err u602))
          (asserts! (is-eq (sbtc-balance) u0) (err u603))
          (asserts! (is-eq (rv-ft .mock-treasury) (+ t0 v0)) (err u604))
          (asserts! (or (not (is-empty)) (is-none (var-get batch-start))) (err u605))
          (ok true))))))

;; fund-from-treasury: pulls the whole treasury balance; opens a fresh window
;; only from an empty vault, no clock, or an elapsed batch whose leftover is
;; unsellable dust; otherwise the clock does not move
(define-private (test-fund-clock (raw uint) (d uint) (win uint))
  (begin
    (var-set rv-dao true)
    (unwrap-panic (set-window-blocks (rv-r win u30)))
    (var-set rv-dao false)
    (and (is-eq (rv-r d u4) u0) (is-ok (contract-call? .mock-ft mint (+ u1 (rv-r d u10)) current-contract)))
    (unwrap-panic (contract-call? .mock-ft mint (+ u1 (rv-r raw u3000000)) .mock-treasury))
    (let (
        (start-a (var-get batch-start))
        (empty-a (is-empty))
        (elapsed-a (window-elapsed))
        (claim-a (+ (sbtc-balance) (rv-mkt)))
        (t0 (rv-ft .mock-treasury))
        (v0 (sbtc-balance))
        (r (fund-from-treasury))
        (opens (or empty-a (is-none start-a) (and elapsed-a (<= claim-a ROUTER_SLACK_SATS))))
      )
      (asserts! (is-ok r) (err u701))
      (asserts! (is-eq (rv-ft .mock-treasury) u0) (err u702))
      (asserts! (is-eq (sbtc-balance) (+ v0 t0)) (err u703))
      (asserts! (is-eq (var-get batch-start) (if opens (some burn-block-height) start-a)) (err u704))
      (ok true))))

;; the Lazer fee: paid by the vault, never by the caller; at most the budget
;; per scope; a fee over the budget fails the whole call and moves nothing
(define-private (test-fee-payer (fraw uint) (braw uint) (raw uint))
  (begin
    (rv-setup-sell raw)
    (unwrap-panic (contract-call? .mock-router set-knobs u10000 u10000))
    (unwrap-panic (stx-transfer? u20000 tx-sender current-contract))
    (let ((fee (+ u1 (rv-r fraw u5000))) (budget (rv-r braw u6000)))
      (rv-as-dao-config u0 u0 u0 budget)
      (unwrap-panic (contract-call? .mock-lazer-oracle set-fee fee))
      (let (
          (f0 (contract-call? .mock-lazer-oracle get-fees))
          (caller0 (stx-get-balance tx-sender))
          (v0 (sbtc-balance))
          (amount (chunk-amount))
          (r (router-swap RV-UPDATE))
          (f1 (contract-call? .mock-lazer-oracle get-fees))
        )
        (unwrap-panic (contract-call? .mock-lazer-oracle set-fee u0))
        (asserts! (is-eq (get other f1) (get other f0)) (err u801))
        (asserts! (is-eq (stx-get-balance tx-sender) caller0) (err u802))
        (match r okv
          (begin
            (asserts! (<= fee budget) (err u803))
            (asserts! (is-eq (- (get vault f1) (get vault f0)) (* u2 fee)) (err u804))
            (ok true))
          e (begin
            (asserts! (is-eq (sbtc-balance) v0) (err u805))
            (asserts! (is-eq (get vault f1) (get vault f0)) (err u806))
            (if (> fee budget) (ok true) (if (is-eq amount u0) (ok false) (err e)))))))))

;; fuel-fair-book: the book gets balance - min(balance, budget), the vault keeps
;; min(balance, budget); nothing to send is u16006
(define-private (test-fuel-fair-book (raw uint) (braw uint))
  (let ((amount (rv-r raw u100000000)) (budget (rv-r braw (+ MAX_PYTH_FEE_BUDGET u1))))
    (var-set rv-dao true)
    (unwrap-panic (set-pyth-fee-budget budget))
    (var-set rv-dao false)
    (and (> amount u0) (unwrap-panic (stx-transfer? amount tx-sender current-contract)))
    (let (
        (bal (stx-get-balance current-contract))
        (book0 (stx-get-balance .ccd015-redemption-book-mia-stx))
        (keep (rv-min bal budget))
        (r (fuel-fair-book))
      )
      (if (is-eq bal keep)
        (begin (asserts! (is-eq r (err u16006)) (err u901)) (ok true))
        (begin
          (asserts! (is-ok r) (err u902))
          (asserts! (is-eq (stx-get-balance .ccd015-redemption-book-mia-stx) (+ book0 (- bal keep))) (err u903))
          (asserts! (is-eq (stx-get-balance current-contract) keep) (err u904))
          (asserts! (or (not (is-empty)) (is-none (var-get batch-start))) (err u905))
          (ok true))))))

;; patience phase: no take, no router sale, no reclaim while the window is open
(define-private (test-patience-no-sale (raw uint) (legs uint))
  (begin
    (rv-fresh-batch raw u1008)
    (rv-healthy-world (rv-band-mid legs))
    (let (
        (v0 (sbtc-balance))
        (amount (chunk-amount))
        (l (rv-legs amount legs))
      )
      (if (window-open)
        (begin
          (asserts! (is-eq (router-swap RV-UPDATE) (err u16031)) (err u1001))
          (asserts! (is-eq (jing-reclaim none) (err u16031)) (err u1002))
          (var-set rv-dao true)
          (let (
              (r1 (router-swap-split amount u0 (get dlmm l) (get xyk l) (get velar l) RV-UPDATE))
              (r2 (router-swap-split-dia amount (get dlmm l) (get xyk l) (get velar l)))
              (r3 (jing-take amount RV-UPDATE))
            )
            (var-set rv-dao false)
            (asserts! (is-eq r1 (err u16031)) (err u1003))
            (asserts! (is-eq r2 (err u16031)) (err u1004))
            (asserts! (is-eq r3 (err u16031)) (err u1005))
            (asserts! (is-eq (sbtc-balance) v0) (err u1006))
            (ok true)))
        (ok false)))))
