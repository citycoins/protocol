;; Title: Governance Token 
;; Version: 0.0.0
;; Synopsis: Simple SIP-010 asset for clarinet testing.
;; Description:
;; A dummy SIP-010 asset for use in tests.

;; TRAITS

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; TOKEN DEFINITIONS

(define-fungible-token newyorkcitycoin)
(define-fungible-token newyorkcitycoin-locked)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u3000))
(define-constant ERR_NOT_TOKEN_OWNER (err u4))

;; DATA VARS

(define-data-var token-name (string-ascii 32) "CityCoins Governance Token")
(define-data-var token-symbol (string-ascii 10) "NYC")
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var token-decimals uint u6)

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

;; unguarded: simple mint function
(define-public (mint (amount uint) (recipient principal))
    (ft-mint? newyorkcitycoin amount recipient)
)

;; guarded: burn function (by user only)
(define-public (burn (amount uint) (owner principal))
	(begin
		(asserts! (or (is-eq tx-sender owner) (is-eq contract-caller owner)) ERR_NOT_TOKEN_OWNER)
		(ft-burn? newyorkcitycoin amount owner)
	)
)

;; guarded: mint governance token
(define-public (edg-mint (amount uint) (recipient principal))
	(begin
		(try! (is-dao-or-extension))
		(ft-mint? newyorkcitycoin amount recipient)
	)
)

;; guarded: mint governance token to multiple recipients
(define-public (edg-mint-many (recipients (list 200 {amount: uint, recipient: principal})))
	(begin
		(try! (is-dao-or-extension))
		(ok (map edg-mint-many-iter recipients))
	)
)

;; guarded: burn governance token
(define-public (edg-burn (amount uint) (owner principal))
	(begin
		(try! (is-dao-or-extension))
		(ft-burn? newyorkcitycoin amount owner)
	)
)

;; guarded: set token name
(define-public (set-name (new-name (string-ascii 32)))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-name new-name))
	)
)

;; guarded: set token symbol
(define-public (set-symbol (new-symbol (string-ascii 10)))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-symbol new-symbol))
	)
)

;; guarded: set token decimals
(define-public (set-decimals (new-decimals uint))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-decimals new-decimals))
	)
)

;; guarded: set token uri
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-uri new-uri))
	)
)

;; SIP-010: transfer
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
	(begin
		(asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_TOKEN_OWNER)
		(ft-transfer? newyorkcitycoin amount sender recipient)
	)
)

;; READ ONLY FUNCTIONS

;; SIP-010 functions

(define-read-only (get-name)
	(ok (var-get token-name))
)

(define-read-only (get-symbol)
	(ok (var-get token-symbol))
)

(define-read-only (get-decimals)
	(ok (var-get token-decimals))
)

(define-read-only (get-balance (who principal))
	(ok (+ (ft-get-balance newyorkcitycoin who) (ft-get-balance newyorkcitycoin-locked who)))
)

(define-read-only (get-total-supply)
	(ok (+ (ft-get-supply newyorkcitycoin) (ft-get-supply newyorkcitycoin-locked)))
)

(define-read-only (get-token-uri)
	(ok (var-get token-uri))
)

;; PRIVATE FUNCTIONS

(define-private (edg-mint-many-iter (item {amount: uint, recipient: principal}))
	(ft-mint? newyorkcitycoin (get amount item) (get recipient item))
)
