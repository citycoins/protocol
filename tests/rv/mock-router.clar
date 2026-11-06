;; Mock swap-router-sbtc-stx-jing-v5 for RV fuzzing of the ccd016 vault.
;; The real router splits a sale across the Jing book, Bitflow DLMM / XYK
;; and Velar; none of those run in simnet. This mock is one venue that
;; buys sBTC at the mock Lazer mid with the STX it holds (the SUT's
;; rv-fund-router wrapper gives it some): it takes `amount` sats, pays
;; sats * mid / 1e10 micro-STX when it can (and that clears min-out), and
;; otherwise takes nothing and reports everything unsold, the way the real
;; router returns what no venue could fill inside the floor. u3002 is the
;; real router's min-out code.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-constant SCALE u10000000000)

(define-private (sell
    (amount uint)
    (min-out uint)
  )
  (let (
      (mid (contract-call? .mock-lazer-oracle get-mid))
      (out (/ (* amount mid) SCALE))
      (taker tx-sender)
    )
    (if (or (is-eq amount u0) (> out (stx-get-balance current-contract)))
      (ok { out: u0, unsold: amount })
      (begin
        (asserts! (>= out min-out) (err u3002))
        (try! (contract-call? .mock-ft transfer amount taker current-contract none))
        (try! (as-contract? ((with-stx out))
          (try! (stx-transfer? out current-contract taker))))
        (ok { out: out, unsold: u0 })))))

(define-public (smart-swap-sbtc-for-stx
    (amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (mid uint)
    (min-stx-out uint)
  )
  (sell amount min-stx-out))

(define-public (swap-sbtc-for-stx
    (amount uint)
    (jing-amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (fallback (optional uint))
    (amm-amounts { dlmm: uint, xyk: uint, velar: uint })
    (amm-mins { dlmm: uint, xyk: uint, velar: uint })
    (min-stx-out uint)
  )
  (sell amount min-stx-out))
