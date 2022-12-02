;; Title: CCD004 City Registration
;; Version: 1.0.0
;; Synopsis:
;; A central city registry for the CityCoins protocol.
;; Description:
;; An extension contract that associates a city name (string-ascii 32)
;; with an ID (uint) for use in other CityCoins extensions. It also
;; contains treasury and activation details available using the ID.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

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

;; store treasury by city ID and nonce
(define-map CityTreasuryNames
  {
    cityId: uint,
    treasuryId: uint
  }
  (string-ascii 32)
)

;; store treasury by city ID and name
(define-map CityTreasuryIds
  {
    cityId: uint,
    treasuryName: (string-ascii 32)
  }
  uint
)

;; store treasury address by city ID and nonce
(define-map CityTreasuryAddress
  {
    cityId: uint,
    treasuryId: uint
  }
  principal
)

;; returns current nonce or default of u0
(define-read-only (get-city-treasury-nonce (cityId uint))
  (default-to u0 (map-get? CityTreasuryNonce cityId))
)

;; returns (some uint) or none
(define-read-only (get-city-treasury-id (cityId uint) (treasuryName (string-ascii 32)))
  (map-get? CityTreasuryIds { cityId: cityId, treasuryName: treasuryName })
)

;; returns (some (string-ascii 32)) or none
(define-read-only (get-city-treasury-name (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryNames { cityId: cityId, treasuryId: treasuryId })
)

;; returns (some principal) or none
(define-read-only (get-city-treasury-address (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryAddress { cityId: cityId, treasuryId: treasuryId })
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
      (map-insert CityTreasuryIds { cityId: cityId, treasuryName: name } nonce)
      (map-insert CityTreasuryNames { cityId: cityId, treasuryId: nonce } name)
      (map-insert CityTreasuryAddress { cityId: cityId, treasuryId: nonce } address)
      (ok nonce)
    )
  )
)

;; CITY ACTIVATION

(define-map CityActivation
  uint ;; city ID
  bool ;; status
)

;; returns true if city is activated
(define-read-only (is-city-activated (cityId uint))
  (default-to false (map-get? CityActivation cityId))
)

(define-public (set-city-activation (cityId uint) (status bool))
  (let
    (
      (currentStatus (is-city-activated cityId))
    )
    (try! (is-dao-or-extension))
    (asserts! (not (is-eq currentStatus status)) ERR_UNAUTHORIZED)
    (map-set CityActivation cityId status)
    (ok true)
  )
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

;; guarded: can only be called by the DAO or other extensions
(define-public (set-city-activation-details (cityId uint) (atBlock uint) (delay uint) (target uint) (threshold uint))
  (begin
    (try! (is-dao-or-extension))
    (map-set CityActivationDetails cityId {
      atBlock: atBlock,
      delay: delay,
      target: target,
      threshold: threshold
    })
    (ok true)
  )
)

;; original settings:
;; activation: block height (MIA: 24497 / NYC: 37449)
;; activation: delay (150 blocks)
;; activation: status (bool)
;; activation: target (activation block + delay)
;; activation: threshold (20)

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)