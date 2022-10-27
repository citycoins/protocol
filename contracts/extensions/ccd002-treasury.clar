;; Title: CCD002 Treasury
;; Version: 1.0.0
;; Synopsis:
;; A treasury contract that can manage STX, SIP-009 NFTs, and SIP-010 FTs.
;; Description:
;; An extension contract that holds assets on behalf of the DAO. SIP-009
;; and SIP-010 assets must be allowed before they are supported.
;; Deposits can be made by anyone either by transferring to the contract
;; or using a deposit function below. Withdrawals are restricted to the DAO
;; through either extensions or proposals.

;; TRAITS

(use-trait nft-trait .sip009-nft-trait.sip009-nft-trait)
(use-trait ft-trait .sip010-ft-trait.sip010-ft-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u3100))
(define-constant ERR_ASSET_NOT_ALLOWED (err u3101))
(define-constant TREASURY (as-contract tx-sender))

;; DATA MAPS AND VARS

(define-map AllowedAssets
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

(define-public (set-allowed (token principal) (enabled bool))
  (begin
    (try! (is-dao-or-extension))
    (print {
      event: "allow-asset",
      token: token,
      enabled: enabled
    })
    (ok (map-set AllowedAssets token enabled))
  )
)

(define-private (set-allowed-iter (item {token: principal, enabled: bool}))
  (set-allowed (get token item) (get enabled item))
  ;;(begin (try! (set-allowed (get token item) (get enabled item))))
  ;;(begin
  ;;  (print {
  ;;    event: "allow-asset",
  ;;    token: (get token item),
  ;;    enabled: (get enabled item)
  ;;  })
  ;;  (map-set AllowedAssets (get token item) (get enabled item))
  ;;)
)

(define-public (set-allowed-list (allowList (list 100 {token: principal, enabled: bool})))
  (begin
    (try! (is-dao-or-extension))
    (ok (map set-allowed-iter allowList))
  )
)

;; Deposit functions

(define-public (deposit-stx (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender TREASURY))
    (print {
      event: "deposit-stx",
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
    (asserts! (is-allowed (contract-of ft)) ERR_ASSET_NOT_ALLOWED)
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
    (asserts! (is-allowed (contract-of nft)) ERR_ASSET_NOT_ALLOWED)
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
      event: "withdraw-stx",
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
    (asserts! (is-allowed (contract-of ft)) ERR_ASSET_NOT_ALLOWED)
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
    (asserts! (is-allowed (contract-of nft)) ERR_ASSET_NOT_ALLOWED)
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

(define-read-only (is-allowed (assetContract principal))
  (default-to false (get-allowed-asset assetContract))
)

(define-read-only (get-allowed-asset (assetContract principal))
  (map-get? AllowedAssets assetContract)
)

(define-read-only (get-balance-stx)
  (stx-get-balance TREASURY)
)

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)
