;; Historical harness. Current canonical invariants: tests/vault/rv.invariants.clar.
;; ============================================================================
;; RENDEZVOUS INVARIANTS for ccd016-swap-vault-mia-v2 (keeperless one-way
;; vault on markets v6)
;; ============================================================================
;; Append-only block; tests/rv/build.sh binds the vault to the jing v6 fuzz
;; stack (the market with settle live through the mock Lazer oracle), a
;; mock treasury, a mock router that buys at the mid with the STX it holds,
;; a mock DIA that echoes the Lazer mid times a skew, the fuzz build of the
;; ccd015 STX book, the DAO gate to the deployer account, and a 20-block
;; window. RV fuzzes the vault's calls; the wrappers play the world around
;; it: sBTC lands in the treasury, bids rest on the market and take the
;; vault's peg, settlements run, the mid and the DIA skew move, the router
;; gets STX to pay with.
;;
;; The vault keeps no ledger of its own (balance-driven by design), so the
;; checks here are about the clock, the caps, and the order it rests; the
;; market's own 25 invariants cover the funds while they sit on the book.
;; ============================================================================

(define-map context (string-ascii 100) { called: uint })

(define-private (update-context (function-name (string-ascii 100)) (called uint))
  (ok (map-set context function-name { called: called })))

(define-constant RV-MID-BASE u24000000000000)
(define-constant RV-MID-STEPS u16000)
(define-constant RV-MID-STEP u1000000000)

(define-private (rv-price (raw uint))
  (+ RV-MID-BASE (* (mod raw RV-MID-STEPS) RV-MID-STEP)))

;; ---------------------------------------------------------------------------
;; wrappers
;; ---------------------------------------------------------------------------

;; rewards land in the treasury (the weekly sBTC)
(define-public (rv-fund-treasury (amount uint))
  (contract-call? .mock-ft transfer amount tx-sender .mock-treasury none))

;; sats landing here by plain transfer, with no clock of their own
(define-public (rv-plain-transfer (amount uint))
  (contract-call? .mock-ft transfer amount tx-sender current-contract none))

;; the router's STX to buy with
(define-public (rv-fund-router (amount uint))
  (stx-transfer? amount tx-sender .mock-router))

(define-public (rv-set-mid (raw uint))
  (contract-call? .mock-lazer-oracle set-mid (rv-price raw)))

;; DIA agrees within 85..115% of the Pyth mid (the band is 10%, so two
;; calls in three land inside it), and goes stale one call in eight: both
;; persist across RV's shared simnet, so they are kept rare enough that
;; the vault's own paths get a turn (the first sweep had every jing-place
;; refused u16036 / u16037).
(define-public (rv-dia-skew (bps uint))
  (contract-call? .mock-dia set-skew
    (if (is-eq (mod bps u3) u0)
      (+ u8500 (mod (/ bps u3) u3000))
      u10000)))

(define-public (rv-dia-stale (n uint))
  (contract-call? .mock-dia set-stale (is-eq (mod n u8) u7)))

;; a resting STX bid from the sender: what the vault's peg fills against
(define-public (rv-bid (amount uint) (limit uint))
  (contract-call? .v6-market deposit-token-y amount (rv-price limit) none 0x
    .mock-ft "mock-ft"))

(define-public (rv-cancel-bid)
  (contract-call? .v6-market cancel-token-y-deposit .mock-ft "mock-ft"))

(define-public (rv-settle)
  (contract-call? .v6-market settle-with-refresh 0x .mock-ft "mock-ft"
    .mock-ft "mock-ft"))

;; the price moves onto the vault's floor, so its peg is back in range
(define-public (rv-mid-at-floor)
  (let ((l (contract-call? .v6-market get-token-x-limit current-contract)))
    (asserts! (> l u0) ERR_NOTHING_RESTING)
    (contract-call? .mock-lazer-oracle set-mid l)))

(define-public (rv-unpause-market)
  (contract-call? .v6-market rv-unpause))

;; ---------------------------------------------------------------------------
;; readers
;; ---------------------------------------------------------------------------

(define-private (rv-resting)
  (+ (contract-call? .v6-market get-token-x-deposit
       (contract-call? .v6-market get-current-cycle) current-contract)
     (contract-call? .v6-market get-token-x-parked current-contract)))

;; ============================================================================
;; 1-2: the clock. Open and elapsed never both hold; with no batch on the
;; clock, neither holds.
;; ============================================================================

(define-read-only (invariant-window-flags-exclusive)
  (not (and (window-open) (window-elapsed))))

(define-read-only (invariant-no-clock-no-window)
  (or (is-some (var-get batch-start))
      (and (not (window-open)) (not (window-elapsed)))))

;; ============================================================================
;; 3: every dial sits inside its governance cap; zero window is allowed.
;; ============================================================================

(define-read-only (invariant-config-in-caps)
  (and (<= (var-get window-blocks) MAX_WINDOW_BLOCKS)
       (<= (var-get no-pyth-slippage-bps) MAX_NO_PYTH_SLIPPAGE_BPS)
       (<= (var-get leeway-bps) MAX_LEEWAY_BPS)
       (<= (var-get slippage-bps) MAX_SLIPPAGE_BPS)
       (<= (var-get dia-band-bps) MAX_DIA_BAND_BPS)
       (> (var-get max-chunk-sats) u0)
       (<= (var-get max-chunk-sats) MAX_CHUNK_SATS)
       (<= (var-get router-cooldown-blocks) MAX_COOLDOWN_BLOCKS)))

;; ============================================================================
;; 4: the cooldown stamp is never in the future.
;; ============================================================================

(define-read-only (invariant-cooldown-stamp-in-past)
  (<= (var-get last-router-swap) burn-block-height))

;; ============================================================================
;; 5: whatever the vault rests on the book is a zero-spread peg with a
;; guard. jing-place and jing-refloor are the only writers; the market
;; never reprices it.
;; ============================================================================

(define-read-only (invariant-resting-order-is-zero-spread-peg)
  (or (is-eq (rv-resting) u0)
      (let ((o (contract-call? .v6-market get-token-x-order current-contract)))
        (and (> (get limit o) u0)
             (is-eq (get spread-bps o) (some u0))))))

;; ============================================================================
;; 6: the clock is set only with something behind it or for a batch the
;; book sold out: an empty vault with a clock is exactly the close-batch
;; case, and a non-empty vault with no clock is exactly the plain-transfer
;; case. Both are allowed, so this only pins that a clock, when set, was
;; opened at or before now.
;; ============================================================================

(define-read-only (invariant-clock-in-past)
  (match (var-get batch-start)
    s (<= s burn-block-height)
    true))
