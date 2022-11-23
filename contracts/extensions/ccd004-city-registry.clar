;; Title: CCD004 City Registration
;; Version: 1.0.0
;; Synopsis:
;; A central city registry for the CityCoins protocol.
;; Description:
;; An extension contract that associates a city name (string-ascii 32)
;; with an ID (uint) for use in other CityCoins extensions. It also
;; contains treasury and activation details available using the ID.

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u3300))

;; AUTHORIZATION CHECK

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; CITY REGISTRATION

(define-data-var citiesNonce uint u0)

;; store city name by ID
(define-map CityNames
  uint
  (string-ascii 32)
)

;; store city ID by name
(define-map CityIds
  (string-ascii 32)
  uint
)

;; returns (some uint) or none
(define-read-only (get-city-id (cityName (string-ascii 32)))
  (map-get? CityIds cityName)
)

;; returns (some (string-ascii 32)) or none
(define-read-only (get-city-name (cityId uint))
  (map-get? CityNames cityId)
)

;; returns city ID if it has been created, or creates and returns new ID
;; guarded: can only be called by the DAO or other extensions
(define-public (get-or-create-city-id (cityName (string-ascii 32)))
  (begin 
    (try! (is-dao-or-extension))
    (match
      (map-get? CityIds cityName)
      value (ok value)
      (let
        (
          (newId (+ u1 (var-get citiesNonce)))
        )
        (map-insert CityNames newId cityName)
        (map-insert CityIds cityName newId)
        (var-set citiesNonce newId)
        (ok newId)
      )
    )
  )
)

;; CITY TREASURIES

(define-map CityTreasuries
  {
    cityId: uint,
    treasuryName: (string-ascii 32)
  }
  principal
)

;; returns (some principal) or none
(define-read-only (get-city-treasury (cityId uint) (treasuryName (string-ascii 32)))
  (map-get? CityTreasuries {cityId: cityId, treasuryName: treasuryName})
)

;; CITY ACTIVATION

(define-map CityActivation
  uint
  bool
)

;; returns true if city is activated
(define-read-only (is-city-activated (cityId uint))
  (default-to false (map-get? CityActivation cityId))
)

(define-map CityActivationDetails
  uint
  {
    atBlock: uint,
    delay: uint,
    target: uint,
    threshold: uint
  }
)

;; returns (some) or none
(define-read-only (get-city-activation-details (cityId uint))
  (map-get? CityActivationDetails cityId)
)

;; original settings:
;; activation: block height (MIA: 24497 / NYC: 37449)
;; activation: delay (150 blocks)
;; activation: status (bool)
;; activation: target (activation block + delay)
;; activation: threshold (20)
