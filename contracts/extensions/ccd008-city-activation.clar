;; Title: CCD008 City Activation
;; Version: 1.0.0
;; Synopsis: This extension allows anyone to vote on activating a city once it's been added to CCD005 City Data.
;; Description: An extension contract that handles the voting process for activating a city and setting the related data.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u8000))
(define-constant ERR_ACTIVATION_DETAILS_NOT_FOUND (err u8001))
(define-constant ERR_CONTRACT_ALREADY_ACTIVE (err u8002))
(define-constant ERR_ALREADY_VOTED (err u8003))
(define-constant ERR_INVALID_CITY (err u8004))

;; DATA MAPS

(define-map CityActivationSignals uint uint)

(define-map CityActivationVoters
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
      (details (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) ERR_ACTIVATION_DETAILS_NOT_FOUND))
      (signals (+ (get-city-activation-signals cityId) u1))
    )
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (not (contract-call? .ccd005-city-data is-city-activated cityId)) ERR_CONTRACT_ALREADY_ACTIVE)
    (map-set CityActivationSignals cityId signals)
    (asserts! (map-insert CityActivationVoters
      { cityId: cityId, signaler: tx-sender } true)
      ERR_ALREADY_VOTED)
    (and (is-eq signals (get threshold details))
      (begin
        (try! (as-contract
          (contract-call? .ccd005-city-data set-city-activation-status cityId true)
        ))
        (try! (as-contract
          (contract-call? .ccd005-city-data set-city-activation-details cityId block-height (get delay details) (+ block-height (get delay details)) (get threshold details))
        ))
      )
    )
    (ok true)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-city-activation-signals (cityId uint))
  (default-to u0 (map-get? CityActivationSignals cityId))
)

(define-read-only (get-city-activation-voter (cityId uint) (voter principal))
  (default-to false (map-get? CityActivationVoters { cityId: cityId, signaler: voter }))
)

