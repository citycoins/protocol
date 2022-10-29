;; Title: Governance Test Token 
;; Version: 0.0.0
;; Synopsis: Simple SIP-010 asset for clarinet testing.
;; Description:
;; A dummy SIP-010 asset for use in tests.

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant ERR_UNAUTHORIZED (err u3000))
(define-constant ERR_NOT_TOKEN_OWNER (err u4))

(define-data-var token-name (string-ascii 32) "City Coins Governance Token")
(define-data-var token-symbol (string-ascii 10) "MIA")
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var token-decimals uint u6)

(define-fungible-token edg-token)
(define-fungible-token edg-token-locked)

;; --- Authorisation check

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; --- Internal DAO functions

;; governance-token-trait
(define-public (edg-mint (amount uint) (recipient principal))
	(begin
		(try! (is-dao-or-extension))
		(ft-mint? edg-token amount recipient)
	)
)

(define-public (edg-burn (amount uint) (owner principal))
	(begin
		(try! (is-dao-or-extension))
		(ft-burn? edg-token amount owner)
		
	)
)

;; Other

(define-public (set-name (new-name (string-ascii 32)))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-name new-name))
	)
)

(define-public (set-symbol (new-symbol (string-ascii 10)))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-symbol new-symbol))
	)
)

(define-public (set-decimals (new-decimals uint))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-decimals new-decimals))
	)
)

(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
	(begin
		(try! (is-dao-or-extension))
		(ok (var-set token-uri new-uri))
	)
)

(define-private (edg-mint-many-iter (item {amount: uint, recipient: principal}))
	(ft-mint? edg-token (get amount item) (get recipient item))
)

(define-public (edg-mint-many (recipients (list 200 {amount: uint, recipient: principal})))
	(begin
		(try! (is-dao-or-extension))
		(ok (map edg-mint-many-iter recipients))
	)
)

;; --- Public functions

;; sip010-ft-trait

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
	(begin
		(asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_TOKEN_OWNER)
		(ft-transfer? edg-token amount sender recipient)
	)
)

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
	(ok (+ (ft-get-balance edg-token who) (ft-get-balance edg-token-locked who)))
)

(define-read-only (get-total-supply)
	(ok (+ (ft-get-supply edg-token) (ft-get-supply edg-token-locked)))
)

(define-read-only (get-token-uri)
	(ok (var-get token-uri))
)
