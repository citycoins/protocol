;; Mock Pyth Lazer oracle for RV fuzzing of markets-sbtc-stx-jing-v6.
;;
;; The v6 market prices every gate, every settlement and every book walk
;; from `verify-price-feeds`. Random `update` buffers can never carry a
;; valid Lazer signature, so the fuzz build binds LAZER_ORACLE (and the
;; decoder principal it passes along) to this contract instead. It ignores
;; the buffer and answers with two fresh feeds: BTC/USD (feed u1) at `mid`
;; and STX/USD (feed u45) at exactly 1e8, so the market's cross
;; (price-x * 1e8 / price-y) IS `mid`, in the market's own unit.
;;
;; `set-mid` is how the fuzz run moves the price: the SUT's rv-set-mid
;; wrapper folds RV's random naturals into a band around a real BTC/STX
;; cross, so pegs go in and out of range, limit rolls fire, walks happen.
;; Confidence u0 and a publish time equal to the block time keep the
;; staleness and confidence gates open; those gates are covered by the
;; stxer harnesses against the real oracle.
(define-data-var mid uint u32000000000000)

(define-read-only (get-mid)
  (var-get mid)
)

(define-public (set-mid (m uint))
  (begin
    (asserts! true (err u0))
    (ok (var-set mid m))
  )
)

;; typed nones: a bare `none` in a literal tuple has no element type
(define-private (none-int)
  (if true none (some 0))
)
(define-private (none-uint)
  (if true none (some u0))
)

(define-private (feed
    (id uint)
    (p int)
    (ts uint)
  )
  {
    feed-id: id,
    price: p,
    exponent: -8,
    publisher-count: u1,
    confidence: (some u0),
    best-bid: (none-int),
    best-ask: (none-int),
    funding-rate: (none-int),
    funding-timestamp: (none-uint),
    funding-rate-interval: (none-uint),
    market-session: (none-uint),
    ema-price: (none-int),
    ema-confidence: (none-uint),
    feed-update-timestamp: (some ts),
  }
)

(define-public (verify-price-feeds
    (update (buff 8192))
    (decoder principal)
    (max-age (optional uint))
  )
  (let ((ts (* stacks-block-time u1000000)))
    (asserts! true (err u0))
    (ok {
      timestamp: ts,
      channel: u0,
      price-feeds: (list
        (feed u1 (to-int (var-get mid)) ts)
        (feed u45 100000000 ts)
      ),
    })
  )
)
