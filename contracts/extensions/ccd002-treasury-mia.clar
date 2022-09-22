;; Title: CCD002 Treasury - MIA
;; Synopsis:
;; A treasury that can manage STX, SIP009, SIP010, and SIP013 tokens.
;; Description:
;; An extension contract that is meant to hold tokens on behalf of the
;; DAO. It can hold and transfer STX, SIP009 and SIP010 tokens.
;; They can be deposited by simply transferring them to the contract.
;; Any extension or executing proposal can trigger transfers.

;; TRAITS

(use-trait nft-trait .sip009-nft-trait.sip009-nft-trait)
(use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u3100))
(define-constant ERR_ASSET_NOT_WHITELISTED (err u3101))
(define-constant ERR_FAILED_TO_TRANSFER_STX (err u3102))
(define-constant ERR_FAILED_TO_TRANSFER_FT (err u3103))
(define-constant ERR_FAILED_TO_TRANSFER_NFT (err u3104))
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))

;; DATA MAPS AND VARS

(define-map WhitelistedAssets
  principal ;; token contract
  bool      ;; enabled
)

;; Authorization Check

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; Internal DAO functions

(define-public (set-whitelist (token principal) (enabled bool))
  (begin
    (try! (is-dao-or-extension))
    (ok (map-set WhitelistedAssets token enabled))
  )
)

(define-private (set-whitelist-iter (item {token: principal, enabled: bool}))
  (begin
    (print {event: "whitelist", token: (get token item), enabled: (get enabled item)})
    (map-set WhitelistedAssets (get token item) (get enabled item))
  )
)

(define-public (set-whitelists (whitelist (list 100 {token: principal, enabled: bool})))
  (begin
    (try! (is-dao-or-extension))
    (ok (map set-whitelist-iter whitelist))
  )
)

;; Public functions

;; Q: why try! vs unwrap!

;; TODO: print tx-sender and contract-caller? (sender, caller)

(define-public (deposit (amount uint))
  (begin
    (unwrap! (stx-transfer? amount tx-sender CONTRACT_ADDRESS) ERR_FAILED_TO_TRANSFER_STX)
    (print {event: "deposit", amount: amount, caller: tx-sender})
    (ok true)
  )
)

(define-public (deposit-ft (ft <ft-trait>) (amount uint))
  (begin
    (asserts! (is-whitelisted (contract-of ft)) ERR_ASSET_NOT_WHITELISTED)
    (unwrap! (contract-call? ft transfer amount tx-sender CONTRACT_ADDRESS none) ERR_FAILED_TO_TRANSFER_FT)
    (print {event: "deposit-ft", amount: amount, assetContract: (contract-of ft), caller: tx-sender})
    (ok true)
  )
)

(define-public (deposit-nft (nft <nft-trait>) (id uint))
  (begin
    (asserts! (is-whitelisted (contract-of nft)) ERR_ASSET_NOT_WHITELISTED)
    (unwrap! (contract-call? nft transfer id tx-sender CONTRACT_ADDRESS) ERR_FAILED_TO_TRANSFER_NFT)
    (print {event: "deposit-nft", assetContract: (contract-of nft), tokenId: id, caller: tx-sender})
    (ok true)
  )
)

(define-public (transfer (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (as-contract (stx-transfer? amount CONTRACT_ADDRESS recipient)) ERR_FAILED_TO_TRANSFER_STX)
    (print {event: "transfer", amount: amount, caller: tx-sender, recipient: recipient})
    (ok true)
  )
)

(define-public (transfer-ft (ft <ft-trait>) (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-whitelisted (contract-of ft)) ERR_ASSET_NOT_WHITELISTED)
    (unwrap! (as-contract (contract-call? ft transfer amount CONTRACT_ADDRESS recipient none)) ERR_FAILED_TO_TRANSFER_FT)
    (print {event: "transfer-ft", assetContract: (contract-of ft), caller: tx-sender, recipient: recipient})
    (ok true)
  )
)

(define-public (transfer-nft (nft <nft-trait>) (id uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-whitelisted (contract-of nft)) ERR_ASSET_NOT_WHITELISTED)
    (unwrap! (as-contract (contract-call? nft transfer id CONTRACT_ADDRESS recipient)) ERR_FAILED_TO_TRANSFER_NFT)
    (print {event: "transfer-nft", assetContract: (contract-of nft), tokenId: id, caller: tx-sender, recipient: recipient})
    (ok true)
  )
)

;; Read only functions

;; Q: why chain/expose these two functions?

(define-read-only (is-whitelisted (assetContract principal))
  (default-to false (get-whitelisted-asset assetContract))
)

(define-read-only (get-whitelisted-asset (assetContract principal))
  (map-get? WhitelistedAssets assetContract)
)

(define-read-only (get-balance)
  (stx-get-balance CONTRACT_ADDRESS)
)

(define-public (get-balance-of (assetContract <ft-trait>))
  (contract-call? assetContract get-balance CONTRACT_ADDRESS)
)

;; Q: add get-owner pass-through from SIP-009?

;; --- Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)
