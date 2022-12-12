;; Title: CCD003 User Registration
;; Version: 1.0.0
;; Synopsis:
;; A central user registry for the CityCoins protocol.
;; Description:
;; An extension contract that associates an address (principal) with an
;; ID (uint) for use in other CityCoins extensions.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u3200))

;; DATA VARS

(define-data-var usersNonce uint u0)

;; DATA MAPS

;; store user principal by user id
(define-map Users
  uint
  principal
)

;; store user id by user principal
(define-map UserIds
  principal
  uint
)

;; PUBLIC FUNCTIONS

;; authorization check
(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; extension callback
(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

;; guarded: returns user ID or creates a new one
(define-public (get-or-create-user-id (user principal))
  (begin 
    (try! (is-dao-or-extension))
    (match
      (map-get? UserIds user)
      value (ok value)
      (let
        (
          (newId (+ u1 (var-get usersNonce)))
        )
        (map-insert Users newId user)
        (map-insert UserIds user newId)
        (var-set usersNonce newId)
        (ok newId)
      )
    )
  )
)

;; READ ONLY FUNCTIONS

;; returns (some uint) or none
(define-read-only (get-user-id (user principal))
  (map-get? UserIds user)
)

;; returns (some principal) or none
(define-read-only (get-user (userId uint))
  (map-get? Users userId)
)
