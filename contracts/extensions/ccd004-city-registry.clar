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

;; store nonce for incrementing treasuries per city
(define-map CityTreasuryNonce
  uint ;; city ID
  uint ;; nonce
)

;; store treasury data based on city ID and nonce
(define-map CityTreasuryData
  {
    cityId: uint,
    nonce: uint
  }
  {
    address: principal,
    name: (string-ascii 32)
  }
)

;; returns current nonce or default of u0
(define-read-only (get-city-treasury-nonce (cityId uint))
  (default-to u0 (map-get? CityTreasuryNonce cityId))
)

;; returns (some {address: principal, name: (string-ascii 32)}) or none
(define-read-only (get-city-treasury (cityId uint) (nonce uint))
  (map-get? CityTreasuryData {cityId: cityId, nonce: nonce})
)

;; adds a new treasury definition for a city
;; guarded: can only be called by the DAO or other extensions
(define-public (add-city-treasury (cityId uint) (address principal) (name (string-ascii 32)))
  (begin
    (let
      (
        (nonce (+ u1 (get-city-treasury-nonce cityId)))
      )
      (try! (is-dao-or-extension))
      (map-set CityTreasuryNonce cityId nonce)
      (map-insert CityTreasuryData {cityId: cityId, nonce: nonce} {address: address, name: name})
      (ok nonce)
    )
  )
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
