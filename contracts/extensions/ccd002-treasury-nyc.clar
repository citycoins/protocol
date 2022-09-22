;; Title: CCD002 Treasury - NYC
;; Version: 1.0.0
;; Synopsis:
;; A treasury contract that can manage STX, SIP-009 NFTs, and SIP-010 FTs.
;; Description:
;; An extension contract that holds assets on behalf of the DAO. SIP-009
;; and SIP-010 assets must be whitelisted before they are supported.
;; Deposits can be made by anyone either by transferring to the contract
;; or using a deposit function below. Withdrawals are restricted to the DAO
;; through either extensions or proposals.

;; TRAITS

(use-trait nft-trait .sip009-nft-trait.sip009-nft-trait)
(use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u3100))
(define-constant ERR_ASSET_NOT_WHITELISTED (err u3101))
(define-constant TREASURY (as-contract tx-sender))

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
    (print {
      event: "whitelist",
      token: token,
      enabled: enabled
    })
    (ok (map-set WhitelistedAssets token enabled))
  )
)

(define-private (set-whitelist-iter (item {token: principal, enabled: bool}))
  (begin
    (print {
      event: "whitelist",
      token: (get token item),
      enabled: (get enabled item)
    })
    (map-set WhitelistedAssets (get token item) (get enabled item))
  )
)

(define-public (set-whitelists (whitelist (list 100 {token: principal, enabled: bool})))
  (begin
    (try! (is-dao-or-extension))
    (ok (map set-whitelist-iter whitelist))
  )
)

;; Deposit functions

(define-public (deposit-stx (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender TREASURY))
    (print {
      event: "deposit",
      amount: amount,
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (ok true)
  )
)

(define-public (deposit-ft (ft <ft-trait>) (amount uint))
  (begin
    (asserts! (is-whitelisted (contract-of ft)) ERR_ASSET_NOT_WHITELISTED)
    (try! (contract-call? ft transfer amount tx-sender TREASURY none))
    (print {
      event: "deposit-ft",
      amount: amount,
      assetContract: (contract-of ft),
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (ok true)
  )
)

(define-public (deposit-nft (nft <nft-trait>) (id uint))
  (begin
    (asserts! (is-whitelisted (contract-of nft)) ERR_ASSET_NOT_WHITELISTED)
    (try! (contract-call? nft transfer id tx-sender TREASURY))
    (print {
      event: "deposit-nft",
      assetContract: (contract-of nft),
      tokenId: id,
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (ok true)
  )
)

;; Withdraw functions

(define-public (withdraw-stx (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (try! (as-contract (stx-transfer? amount TREASURY recipient)))
    (print {
      event: "withdraw",
      amount: amount,
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (ok true)
  )
)

(define-public (withdraw-ft (ft <ft-trait>) (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-whitelisted (contract-of ft)) ERR_ASSET_NOT_WHITELISTED)
    (try! (as-contract (contract-call? ft transfer amount TREASURY recipient none)))
    (print {
      event: "withdraw-ft",
      assetContract: (contract-of ft),
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (ok true)
  )
)

(define-public (withdraw-nft (nft <nft-trait>) (id uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-whitelisted (contract-of nft)) ERR_ASSET_NOT_WHITELISTED)
    (try! (as-contract (contract-call? nft transfer id TREASURY recipient)))
    (print {
      event: "withdraw-nft",
      assetContract: (contract-of nft),
      tokenId: id,
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (ok true)
  )
)

;; Read only functions

(define-read-only (is-whitelisted (assetContract principal))
  (default-to false (get-whitelisted-asset assetContract))
)

(define-read-only (get-whitelisted-asset (assetContract principal))
  (map-get? WhitelistedAssets assetContract)
)

(define-read-only (get-balance-stx)
  (stx-get-balance TREASURY)
)

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)
