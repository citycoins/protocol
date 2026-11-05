;; RV ccd016-final: mock Pyth Lazer oracle (overrides tests/vault/fixtures).
;; Same feeds as the fixture (BTC/USD = mid, STX/USD = 1e8, so the market's
;; cross IS `mid`), plus a configurable verify fee charged in STX to
;; tx-sender, like the real Lazer verifier. The fee is charged only for a
;; non-empty update: the fixture market's v6-3 adapters pass 0x where the
;; deployed v6-3 entry points take no update (no verify). Ghost totals split
;; who paid: the vault (inside its as-contract? scopes) or anyone else.
(define-constant RV-VAULT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd016-swap-vault-mia-v2)
(define-data-var mid uint u32000000000000)
(define-data-var fee uint u0)
(define-data-var fees-vault uint u0)
(define-data-var fees-other uint u0)
(define-data-var verifies uint u0)

(define-read-only (get-mid) (var-get mid))
(define-read-only (get-fee) (var-get fee))
(define-read-only (get-fees) { vault: (var-get fees-vault), other: (var-get fees-other), verifies: (var-get verifies) })
(define-public (set-mid (m uint)) (begin (asserts! true (err u0)) (ok (var-set mid m))))
(define-public (set-fee (f uint)) (begin (asserts! true (err u0)) (ok (var-set fee f))))

(define-private (none-int) (if true none (some 0)))
(define-private (none-uint) (if true none (some u0)))
(define-private (feed (id uint) (p int) (ts uint))
  {
    feed-id: id, price: p, exponent: -8, publisher-count: u1, confidence: (some u0),
    best-bid: (none-int), best-ask: (none-int), funding-rate: (none-int),
    funding-timestamp: (none-uint), funding-rate-interval: (none-uint),
    market-session: (none-uint), ema-price: (none-int), ema-confidence: (none-uint),
    feed-update-timestamp: (some ts),
  })

(define-public (verify-price-feeds (update (buff 8192)) (decoder principal) (max-age (optional uint)))
  (let ((ts (* stacks-block-time u1000000)) (f (var-get fee)))
    (and (> f u0) (> (len update) u0)
      (begin
        (try! (stx-transfer? f tx-sender current-contract))
        (var-set verifies (+ (var-get verifies) u1))
        (if (is-eq tx-sender RV-VAULT)
          (var-set fees-vault (+ (var-get fees-vault) f))
          (var-set fees-other (+ (var-get fees-other) f)))))
    (ok { timestamp: ts, channel: u0,
          price-feeds: (list (feed u1 (to-int (var-get mid)) ts) (feed u45 100000000 ts)) })))
