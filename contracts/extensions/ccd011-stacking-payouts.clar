;; Title: CCD011 Stacking Payouts
;; Version: 1.0.0
;; Summary: A central stacking payout extension hardcoded to look up and transfer to city treasuries.
;; Description: An extension that provides a the ability to pay out the stacking rewards for a given city to the city treasury.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u11000))
(define-constant ERR_CITY_ID_NOT_FOUND (err u11001))
(define-constant ERR_STACKING_PAYOUT_INVALID (err u11002))

;; DATA VARS

;; MAINNET: (define-data-var poolOperator principal 'SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M)
(define-data-var poolOperator principal 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

(define-public (set-pool-operator (operator principal))
  (begin
    (try! (is-dao-or-extension))
    (ok (var-set poolOperator operator))
  )
)

(define-public (send-stacking-reward-mia (cycleId uint) (amount uint))
  (let
    ((cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_CITY_ID_NOT_FOUND)))
    (asserts! (is-eq tx-sender (var-get poolOperator)) ERR_UNAUTHORIZED)
    (asserts! (> amount u0) ERR_STACKING_PAYOUT_INVALID)
    (try! (contract-call? .ccd007-citycoin-stacking set-stacking-reward cityId cycleId amount))
    (print {
      event: "stacking-reward-payout",
      amount: amount,
      cityId: cityId,
      cityName: "mia",
    })
    (contract-call? .ccd002-treasury-mia-stacking deposit-stx amount)
  )
)

(define-public (send-stacking-reward-nyc (cycleId uint) (amount uint))
  (let
    ((cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_CITY_ID_NOT_FOUND)))
    (asserts! (is-eq tx-sender (var-get poolOperator)) ERR_UNAUTHORIZED)
    (asserts! (> amount u0) ERR_STACKING_PAYOUT_INVALID)
    (try! (contract-call? .ccd007-citycoin-stacking set-stacking-reward cityId cycleId amount))
    (print {
      event: "stacking-reward-payout",
      amount: amount,
      cityId: cityId,
      cityName: "nyc",
    })
    (contract-call? .ccd002-treasury-nyc-stacking deposit-stx amount)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-pool-operator)
  (var-get poolOperator)
)