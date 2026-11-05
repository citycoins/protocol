;; Mock DIA push oracle for RV fuzzing of the ccd016 vault. Answers the two
;; keys the vault reads: BTC/USD is the mock Lazer mid scaled by `skew-bps`
;; (10000 = agree exactly), STX/USD is 1e8, so BTC/USD * 1e8 / STX/USD is
;; the Pyth mid times the skew. The timestamp is the current block time
;; (in ms), so the 2h staleness gate passes; `set-stale` makes it fail.
;; The SUT's rv-dia-skew / rv-dia-stale wrappers drive both.
(define-data-var skew-bps uint u10000)
(define-data-var stale bool false)

(define-public (set-skew (bps uint))
  (begin (asserts! true (err u0)) (ok (var-set skew-bps bps))))

(define-public (set-stale (s bool))
  (begin (asserts! true (err u0)) (ok (var-set stale s))))

(define-read-only (get-value (key (string-ascii 32)))
  (let (
      (ts (if (var-get stale) u1000 (* stacks-block-time u1000)))
      (mid (contract-call? .mock-lazer-oracle get-mid))
    )
    (ok (if (is-eq key "BTC/USD")
      { value: (/ (* mid (var-get skew-bps)) u10000), timestamp: ts }
      (if (is-eq key "STX/USD")
        { value: u100000000, timestamp: ts }
        { value: u0, timestamp: u0 })))))
