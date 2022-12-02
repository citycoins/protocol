;; Title: CCD003 User Registration
;; Version: 1.0.0
;; Synopsis:
;; A central user registry for the CityCoins protocol.
;; Description:
;; An extension contract that associates an address (principal) with an
;; ID (uint) for use in other CityCoins extensions.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u3200))

;; AUTHORIZATION CHECK

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; USER REGISTRATION

(define-data-var usersNonce uint u0)

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

;; returns (some uint) or none
(define-read-only (get-user-id (user principal))
  (map-get? UserIds user)
)

;; returns (some principal) or none
(define-read-only (get-user (userId uint))
  (map-get? Users userId)
)

;; returns user ID if it has been created, or creates and returns new ID
;; guarded: can only be called by the DAO or other extensions
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

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)
