;; External venue fixture, deployed separately as dlmm, xyk and velar.
;; Pricing is independent of the router's minimum. Transfers use finite,
;; pre-funded balances; no minting occurs in any swap. Test controls only.
(use-trait ft .sip-010-trait.sip-010-trait)
(define-constant owner tx-sender)
(define-data-var sats uint u0)
(define-data-var microstx uint u0)
(define-data-var reverse bool false)
(define-data-var fee-x uint u0)
(define-data-var fee-y uint u0)
(define-data-var active int 0)
(define-data-var step uint u15)
(define-data-var price uint u1000000)
(define-data-var max-input uint u340282366920938463463374607431768211455)
(define-data-var inflate uint u0)
(define-data-var calls uint u0)
(define-data-var last-in uint u0)
(define-data-var last-min uint u0)
;; DLMM bin-walk mode, off until set-bin: each bin holds its own balances
;; (x = uSTX, y = sats) and a swap walks up to 30 bins from the active one,
;; with the core's per-bin formula (the input that empties a bin is
;; ceil(avail * price / 1e8) selling sBTC or ceil(avail * 1e8 / price) selling
;; STX, grossed up by the fee; the bin that runs the input out pays
;; net * 1e8 / price or net * price / 1e8). Prices are get-bin-price below.
(define-map bins int {x: uint, y: uint})
(define-data-var walk bool false)
(define-constant WALK (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15
  u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29))

(define-public (configure (s uint) (y uint) (rev bool) (fx uint) (fy uint))
  (begin
    (asserts! (is-eq tx-sender owner) (err u401))
    (var-set sats s) (var-set microstx y) (var-set reverse rev)
    (var-set fee-x fx) (var-set fee-y fy) (ok true)))
(define-public (configure-dlmm (bin int) (p uint) (bin-step uint) (cap uint))
  (begin
    (asserts! (is-eq tx-sender owner) (err u401))
    (var-set active bin) (var-set price p) (var-set step bin-step)
    (var-set max-input cap) (ok true)))
(define-public (set-bin (bin int) (x uint) (y uint))
  (begin
    (asserts! (is-eq tx-sender owner) (err u401))
    (var-set walk true) (ok (map-set bins bin {x: x, y: y}))))
(define-private (bin-of (bin int)) (default-to {x: u0, y: u0} (map-get? bins bin)))
;; The pool's core-address, read by the router's dlmm-enabled (Giant Moth 01:
;; a pool Bitflow migrated to another core). Defaults to this deployer's
;; .dlmm-router (the router's DLMM_CORE substitute), built with
;; principal-construct? so the fixture takes no deploy dependency on it.
(define-data-var core principal (let ((d (unwrap-panic (principal-destruct? tx-sender))))
  (unwrap-panic (principal-construct? (get version d) (get hash-bytes d) "dlmm-router"))))
(define-public (set-core (p principal))
  (begin (asserts! (is-eq tx-sender owner) (err u401)) (ok (var-set core p))))
(define-public (set-inflate (n uint))
  (begin (asserts! (is-eq tx-sender owner) (err u401)) (ok (var-set inflate n))))
(define-read-only (get-pool)
  (ok {x-token: (if (var-get reverse) .asset-stx .token),
    x-balance: (if (var-get reverse) (var-get microstx) (var-get sats)),
    y-balance: (if (var-get reverse) (var-get sats) (var-get microstx)),
    token0: (if (var-get reverse) .asset-stx .token),
    reserve0: (if (var-get reverse) (var-get microstx) (var-get sats)),
    reserve1: (if (var-get reverse) (var-get sats) (var-get microstx)),
    active-bin-id: (var-get active), initial-price: (var-get price), bin-step: (var-get step),
    core-address: (var-get core),
    x-protocol-fee: (var-get fee-x), x-provider-fee: u0, x-variable-fee: u0,
    y-protocol-fee: (var-get fee-y), y-provider-fee: u0, y-variable-fee: u0}))
;; DLMM pool getter with the mainnet dlmm-pool-stx-sbtc-v-N-bps-15 tuple: x =
;; STX, y = sBTC; fees of the input side (x when is-x-for-y). Bin, initial
;; price and bin step are the ones configure-dlmm sets for the swap and bins.
(define-read-only (get-pool-for-swap (is-x-for-y bool))
  (ok {pool-id: u0, pool-name: "dlmm-stub", core-address: owner, fee-address: owner,
    x-token: .asset-stx, y-token: .token, bin-step: (var-get step),
    initial-price: (var-get price), active-bin-id: (var-get active),
    protocol-fee: (if is-x-for-y (var-get fee-x) (var-get fee-y)), provider-fee: u0, variable-fee: u0}))
(define-read-only (get-fees)
  (ok {swap-fee:{num:(- u10000 (var-get fee-x)), den:u10000}}))
(define-read-only (get-bin-price (initial uint) (bin-step uint) (bin int))
  (let ((p (+ (* (to-int initial) 10000) (* (to-int initial) (to-int bin-step) bin))))
    (if (> p 0) (ok (to-uint (/ p 10000))) (err u4001))))
(define-read-only (get-bin-balances (id uint))
  (begin
    (asserts! (<= id u1000) (err u4002))
    (ok (if (var-get walk)
      (let ((b (bin-of (- (to-int id) 500)))) {x-balance:(get x b),y-balance:(get y b)})
      (if (is-eq id (to-uint (+ (var-get active) 500)))
      {x-balance:(var-get microstx),y-balance:(var-get sats)}
      {x-balance:u0,y-balance:u0})))))

(define-private (exchange (sell-sbtc bool) (amount uint) (out uint) (minimum uint))
  (let ((user tx-sender))
    (asserts! (>= out minimum) (err u4003))
    (if sell-sbtc
      (begin
        (try! (contract-call? .token transfer amount user current-contract none))
        (try! (as-contract? ((with-stx out)) (try! (stx-transfer? out current-contract user)))))
      (begin
        (try! (stx-transfer? amount user current-contract))
        (try! (as-contract? ((with-ft .token "token" out))
          (try! (contract-call? .token transfer out current-contract user none))))))
    (var-set calls (+ (var-get calls) u1))
    (var-set last-in amount) (var-set last-min minimum)
    (ok (+ out (var-get inflate)))))
(define-private (cp (sell-sbtc bool) (amount uint) (minimum uint) (fee uint))
  (let ((rin (if sell-sbtc (var-get sats) (var-get microstx)))
        (rout (if sell-sbtc (var-get microstx) (var-get sats)))
        (adjusted (/ (* amount (- u10000 fee)) u10000))
        (out (/ (* rout adjusted) (+ rin adjusted)))
        (reported (try! (exchange sell-sbtc amount out minimum))))
    (var-set sats (if sell-sbtc (+ (var-get sats) amount) (- (var-get sats) out)))
    (var-set microstx (if sell-sbtc (- (var-get microstx) out) (+ (var-get microstx) amount)))
    (ok reported)))
(define-private (dlmm-fill (sell-sbtc bool) (amount uint) (minimum uint))
  (let ((spent (if (< amount (var-get max-input)) amount (var-get max-input)))
        (fee (if sell-sbtc (var-get fee-y) (var-get fee-x)))
        (net (/ (* spent (- u10000 fee)) u10000))
        (p (unwrap-panic (get-bin-price (var-get price) (var-get step) (var-get active))))
        (out (if sell-sbtc (/ (* net u100000000) p) (/ (* net p) u100000000)))
        (reported (try! (exchange sell-sbtc spent out minimum))))
    (ok {in:spent,out:reported})))
(define-private (walk-step (i uint) (acc {bin: int, up: bool, fee: uint, left: uint, out: uint, done: bool}))
  (if (or (get done acc) (is-eq (get left acc) u0))
    acc
    (let ((b (bin-of (get bin acc)))
          (p (unwrap-panic (get-bin-price (var-get price) (var-get step) (get bin acc))))
          (avail (if (get up acc) (get x b) (get y b)))
          (raw (if (get up acc) (/ (+ (* avail p) u99999999) u100000000) (/ (+ (* avail u100000000) (- p u1)) p)))
          (grossed (if (> (get fee acc) u0) (/ (* raw u10000) (- u10000 (get fee acc))) raw))
          (edge (is-eq (get bin acc) (if (get up acc) 500 -500))))
      (if (>= (get left acc) grossed)
        (begin
          (map-set bins (get bin acc)
            (if (get up acc) {x: u0, y: (+ (get y b) grossed)} {x: (+ (get x b) grossed), y: u0}))
          (merge acc {out: (+ (get out acc) avail), left: (- (get left acc) grossed),
            bin: (if edge (get bin acc) (if (get up acc) (+ (get bin acc) 1) (- (get bin acc) 1))),
            done: edge}))
        (let ((net (/ (* (get left acc) (- u10000 (get fee acc))) u10000))
              (paid (if (get up acc) (/ (* net u100000000) p) (/ (* net p) u100000000))))
          (map-set bins (get bin acc)
            (if (get up acc) {x: (- avail paid), y: (+ (get y b) (get left acc))}
              {x: (+ (get x b) (get left acc)), y: (- avail paid)}))
          (merge acc {out: (+ (get out acc) paid), left: u0, done: true}))))))
(define-private (walk-fill (sell-sbtc bool) (amount uint) (minimum uint))
  (let ((r (fold walk-step WALK {bin: (var-get active), up: sell-sbtc,
          fee: (if sell-sbtc (var-get fee-y) (var-get fee-x)), left: amount, out: u0, done: false}))
        (spent (- amount (get left r)))
        (reported (try! (exchange sell-sbtc spent (get out r) minimum))))
    (var-set active (get bin r))
    (ok {in:spent,out:reported})))
(define-public (swap-x-for-y-simple-range-multi (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint) (steps uint) (deadline (optional uint)))
  (if (var-get walk) (walk-fill false amount minimum) (dlmm-fill false amount minimum)))
(define-public (swap-y-for-x-simple-range-multi (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint) (steps uint) (deadline (optional uint)))
  (if (var-get walk) (walk-fill true amount minimum) (dlmm-fill true amount minimum)))
(define-public (swap-x-for-y (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint))
  (cp (is-eq (contract-of x) .token) amount minimum (var-get fee-x)))
(define-public (swap-y-for-x (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint))
  (cp (is-eq (contract-of y) .token) amount minimum (var-get fee-y)))
(define-public (swap (input <ft>) (output <ft>) (fees principal) (amount uint) (minimum uint))
  (ok {amt-out:(try! (cp (is-eq (contract-of input) .token) amount minimum (var-get fee-x)))}))
