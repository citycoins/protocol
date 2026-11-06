;; DLMM swap-router and core fixture. The router's three DLMM pool principals
;; map to separate venues.clar deployments: v-1 = dlmm, v-2 = dlmm-2,
;; v-3 = dlmm-3. Each pool has its own quote, bins and funded ledger
;; balances. A swap goes to the pool the caller names, with no as-contract,
;; so the caller stays tx-sender. get-bin-price is the venues.clar formula.
;; get-bin-factors-by-step serves the same linear formula as a factor list
;; for bin step u15 (factor[id] = 1e8 + 15e4 * (id - 500), so
;; initial * factor / 1e8 = get-bin-price initial u15 (id - 500)); mainnet
;; factors are geometric. Other steps have no list ((ok none)), as on the
;; core for a step it does not know. `set-factors-off` makes the u15 read
;; return (ok none) too, so a router that reads it panics: tests use it to
;; show a pick made no price read.
;; get-pool-by-id serves the core's `pools` map for the mainnet ids (6 = dlmm,
;; 15 = dlmm-2, 16 = dlmm-3), all enabled until `set-pool-status`. A swap on
;; a disabled pool is refused as on mainnet: the core's first bin step fails
;; u1010 (ERR_POOL_DISABLED) and the swap router's fold reports it as u2001
;; (ERR_NO_RESULT_DATA, its next step unwrapping the error).
;; `set-pool-entry` points an id at another contract (or none) to test the
;; router's pool-contract check.
(use-trait ft .sip-010-trait.sip-010-trait)
(define-constant owner tx-sender)
(define-data-var factors-off bool false)
(define-map pools uint {id: uint, name: (string-ascii 32), symbol: (string-ascii 32), pool-contract: principal, status: bool})
(map-set pools u6 {id: u6, name: "STX-sBTC-LP", symbol: "STX-sBTC", pool-contract: .dlmm, status: true})
(map-set pools u15 {id: u15, name: "STX-sBTC-LP", symbol: "STX-sBTC", pool-contract: .dlmm-2, status: true})
(map-set pools u16 {id: u16, name: "STX-sBTC-LP", symbol: "STX-sBTC", pool-contract: .dlmm-3, status: true})
(define-read-only (get-pool-by-id (id uint)) (ok (map-get? pools id)))
(define-public (set-pool-status (id uint) (status bool))
  (let ((entry (unwrap! (map-get? pools id) (err u4005))))
    (asserts! (is-eq tx-sender owner) (err u401))
    (ok (map-set pools id (merge entry {status: status})))))
(define-public (set-pool-entry (id uint) (pool (optional principal)))
  (begin
    (asserts! (is-eq tx-sender owner) (err u401))
    (ok (match pool
      p (map-set pools id {id: id, name: "STX-sBTC-LP", symbol: "STX-sBTC", pool-contract: p, status: true})
      (map-delete pools id)))))
(define-private (enabled (pool principal))
  (let ((id (if (is-eq pool .dlmm-2) u15 (if (is-eq pool .dlmm-3) u16 u6))))
    (match (map-get? pools id) e (and (get status e) (is-eq (get pool-contract e) pool)) false)))

(define-constant DIGITS (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9))
(define-private (factor-at (id uint)) (+ u25000000 (* u150000 id)))
(define-private (add-unit (d uint) (acc {base: uint, out: (list 1001 uint)}))
  (merge acc {out: (unwrap-panic (as-max-len?
    (append (get out acc) (factor-at (+ (get base acc) d))) u1001))}))
(define-private (add-ten (d uint) (acc {base: uint, out: (list 1001 uint)}))
  (merge acc {out: (get out (fold add-unit DIGITS
    {base: (+ (get base acc) (* u10 d)), out: (get out acc)}))}))
(define-private (add-hundred (d uint) (out (list 1001 uint)))
  (get out (fold add-ten DIGITS {base: (* u100 d), out: out})))
(define-constant FACTORS-15 (unwrap-panic (as-max-len?
  (append (fold add-hundred DIGITS (list)) (factor-at u1000)) u1001)))

(define-public (set-factors-off (off bool))
  (begin (asserts! (is-eq tx-sender owner) (err u401)) (ok (var-set factors-off off))))

(define-read-only (get-bin-factors-by-step (step uint))
  (ok (if (and (is-eq step u15) (not (var-get factors-off))) (some FACTORS-15) none)))

(define-read-only (get-bin-price (initial uint) (bin-step uint) (bin int))
  (let ((p (+ (* (to-int initial) 10000) (* (to-int initial) (to-int bin-step) bin))))
    (if (> p 0) (ok (to-uint (/ p 10000))) (err u4001))))

(define-public (swap-x-for-y-simple-range-multi (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint) (steps uint) (deadline (optional uint)))
  (if (not (enabled pool)) (err u2001)
  (if (is-eq pool .dlmm-2)
    (contract-call? .dlmm-2 swap-x-for-y-simple-range-multi pool x y amount minimum steps deadline)
    (if (is-eq pool .dlmm-3)
      (contract-call? .dlmm-3 swap-x-for-y-simple-range-multi pool x y amount minimum steps deadline)
      (begin
        (asserts! (is-eq pool .dlmm) (err u4004))
        (contract-call? .dlmm swap-x-for-y-simple-range-multi pool x y amount minimum steps deadline))))))

(define-public (swap-y-for-x-simple-range-multi (pool principal) (x <ft>) (y <ft>) (amount uint) (minimum uint) (steps uint) (deadline (optional uint)))
  (if (not (enabled pool)) (err u2001)
  (if (is-eq pool .dlmm-2)
    (contract-call? .dlmm-2 swap-y-for-x-simple-range-multi pool x y amount minimum steps deadline)
    (if (is-eq pool .dlmm-3)
      (contract-call? .dlmm-3 swap-y-for-x-simple-range-multi pool x y amount minimum steps deadline)
      (begin
        (asserts! (is-eq pool .dlmm) (err u4004))
        (contract-call? .dlmm swap-y-for-x-simple-range-multi pool x y amount minimum steps deadline))))))
