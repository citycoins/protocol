;; Title: Simple NFT
;; Version: 0.0.0
;; Synopsis: Simple SIP-009 asset for clarinet testing.
;; Description:
;; A dummy SIP-009 asset for use in tests with a mint function.

;; TRAITS

(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

;; TOKEN DEFINITION

(define-non-fungible-token nyc uint)

;; CONSTANTS

;; error codes
(define-constant err-owner-only (err u100))
(define-constant err-token-id-failure (err u101))
(define-constant err-not-token-owner (err u102))

(define-constant contract-owner tx-sender)

;; DATA VARS

(define-data-var token-id-nonce uint u0)

;; PUBLIC FUNCTIONS

;; guarded: only owner can mint
(define-public (mint (recipient principal))
	(let ((token-id (+ (var-get token-id-nonce) u1)))
		(asserts! (is-eq tx-sender contract-owner) err-owner-only)
		(try! (nft-mint? nyc token-id recipient))
		(asserts! (var-set token-id-nonce token-id) err-token-id-failure)
		(ok token-id)
	)
)

;; SIP-009: transfer
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(begin
		(asserts! (is-eq tx-sender sender) err-not-token-owner)
		(nft-transfer? nyc token-id sender recipient)
	)
)

;; READ ONLY FUNCTIONS

;; SIP-009 functions

(define-read-only (get-last-token-id)
	(ok (var-get token-id-nonce))
)

(define-read-only (get-token-uri (token-id uint))
	(ok none)
)

(define-read-only (get-owner (token-id uint))
	(ok (nft-get-owner? nyc token-id))
)
