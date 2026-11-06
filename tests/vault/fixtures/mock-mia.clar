;; Mock miamicoin-token-v2 for RV fuzzing of the ccd015 STX book and the
;; ccd016 vault. Real ledger under the token name `miamicoin` (the with-ft
;; allowance name the book uses), transfer auto-mints the sender when short
;; so RV's random sellers never fail at the token, burn is real and counted
;; so the book's total-burned can be checked against it.
(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token miamicoin)
(define-data-var burned uint u0)

(define-public (transfer
    (amount uint)
    (sender principal)
    (recipient principal)
    (memo (optional (buff 34)))
  )
  (begin
    (asserts! (is-eq tx-sender sender) (err u4))
    (if (< (ft-get-balance miamicoin sender) amount)
      (try! (ft-mint? miamicoin (+ amount u1000000000000) sender))
      true)
    (ft-transfer? miamicoin amount sender recipient)
  )
)

(define-public (burn
    (amount uint)
    (owner principal)
  )
  (begin
    (asserts! (is-eq tx-sender owner) (err u4))
    (try! (ft-burn? miamicoin amount owner))
    (ok (var-set burned (+ (var-get burned) amount)))
  )
)

(define-read-only (get-burned) (var-get burned))
(define-read-only (get-name) (ok "miamicoin"))
(define-read-only (get-symbol) (ok "MIA"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance miamicoin who)))
(define-read-only (get-total-supply) (ok (ft-get-supply miamicoin)))
(define-read-only (get-token-uri) (ok none))
