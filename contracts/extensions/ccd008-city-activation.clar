;; Title: CCD008 City Activation
;; Version: 1.0.0
;; Summary: Allows anyone to vote on activating a city once it's been added to CCD005 City Data.
;; Description: An extension contract that handles the voting process for activating a city and setting the related data.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u8000))
(define-constant ERR_NO_ACTIVATION_DETAILS (err u8001))
(define-constant ERR_ACTIVE_CITY (err u8002))
(define-constant ERR_ALREADY_VOTED (err u8003))

;; DATA MAPS

(define-map ActivationSignals uint uint)

(define-map ActivationVoters
  { cityId: uint, signaler: principal }
  bool
)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

(define-public (activate-city (cityId uint) (memo (optional (string-ascii 100))))
  (let
    (
      (details (unwrap! (contract-call? .ccd005-city-data get-activation-details cityId) ERR_NO_ACTIVATION_DETAILS))
      (signals (+ (get-activation-signals cityId) u1))
    )
    (asserts! (not (contract-call? .ccd005-city-data is-city-activated cityId)) ERR_ACTIVE_CITY)
    (map-set ActivationSignals cityId signals)
    (asserts! (map-insert ActivationVoters
      { cityId: cityId, signaler: tx-sender } true)
      ERR_ALREADY_VOTED)
    (and (is-eq signals (get threshold details))
      (begin
        (try! (as-contract
          (contract-call? .ccd005-city-data set-activation-status cityId true)
        ))
        (try! (as-contract
          (contract-call? .ccd005-city-data set-activation-details cityId block-height (get delay details) (+ block-height (get delay details)) (get threshold details))
        ))
      )
    )
    (ok true)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-activation-signals (cityId uint))
  (default-to u0 (map-get? ActivationSignals cityId))
)

(define-read-only (get-activation-voter (cityId uint) (voter principal))
  (default-to false (map-get? ActivationVoters { cityId: cityId, signaler: voter }))
)

