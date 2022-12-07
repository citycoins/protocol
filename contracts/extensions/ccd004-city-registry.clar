;; Title: CCD004 City Registration
;; Version: 1.0.0
;; Synopsis:
;; A central city registry for the CityCoins protocol.
;; Description:
;; An extension contract that associates a city name (string-ascii 32)
;; with an ID (uint) for use in other CityCoins extensions.

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

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)