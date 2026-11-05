;; RV ccd016-final: ADVERSARIAL mock of swap-router-sbtc-stx-jing-v5-3
;; (overrides tests/vault/fixtures). One venue that fills `fill-bps` of the
;; amount at `quality-bps` of the Lazer mid, ignoring the limit price and the
;; per-leg mins. It honours only the overall min-stx-out (u3002), the one
;; guarantee the vault's split entries lean on. router-swap passes min-out u0,
;; so the vault's own post-trade floor check is the only guard there. With an
;; update it verifies once (the real router's book leg verifies in the market),
;; charging the Lazer fee to tx-sender (the vault inside as-contract?).
(use-trait ft-trait .sip-010-trait.sip-010-trait)
(define-constant SCALE u10000000000)
(define-data-var quality-bps uint u10000)
(define-data-var fill-bps uint u10000)
(define-read-only (get-knobs) { quality: (var-get quality-bps), fill: (var-get fill-bps) })
(define-public (set-knobs (q uint) (f uint))
  (begin (asserts! (<= f u10000) (err u1)) (var-set quality-bps q) (ok (var-set fill-bps f))))

(define-private (verify (update (optional (buff 8192))))
  (match update u
    (begin (try! (contract-call? .mock-lazer-oracle verify-price-feeds u .mock-lazer-oracle none)) (ok true))
    (ok true)))

(define-private (sell (amount uint) (min-out uint) (update (optional (buff 8192))))
  (let (
      (mid (contract-call? .mock-lazer-oracle get-mid))
      (fill (/ (* amount (var-get fill-bps)) u10000))
      (out (/ (* (* fill mid) (var-get quality-bps)) (* SCALE u10000)))
      (taker tx-sender)
    )
    (try! (verify update))
    (if (or (is-eq fill u0) (is-eq out u0) (> out (stx-get-balance current-contract)))
      (begin (asserts! (is-eq min-out u0) (err u3002)) (ok { out: u0, unsold: amount }))
      (begin
        (asserts! (>= out min-out) (err u3002))
        (try! (contract-call? .mock-ft transfer fill taker current-contract none))
        (try! (as-contract? ((with-stx out)) (try! (stx-transfer? out current-contract taker))))
        (ok { out: out, unsold: (- amount fill) })))))

(define-public (smart-swap-sbtc-for-stx (amount uint) (limit-price uint) (update (optional (buff 8192))) (mid uint) (min-stx-out uint))
  (sell amount min-stx-out update))

(define-public (swap-sbtc-for-stx (amount uint) (jing-amount uint) (limit-price uint) (update (optional (buff 8192)))
    (fallback (optional uint)) (amm-amounts { dlmm: uint, xyk: uint, velar: uint })
    (amm-mins { dlmm: uint, xyk: uint, velar: uint }) (min-stx-out uint))
  (sell amount min-stx-out update))
