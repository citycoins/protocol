;; Title: CCD002 Treasury
;; Version: 1.0.0
;; Synopsis: A treasury contract that can manage STX, SIP-009 NFTs, and SIP-010 FTs.
;; Description: An extension contract that holds assets on behalf of the DAO. SIP-009 and SIP-010 assets must be allowed before they are supported. Deposits can be made by anyone either by transferring to the contract or using a deposit function below. Withdrawals are restricted to the DAO through either extensions or proposals.

;; TRAITS

(impl-trait .extension-trait.extension-trait)
(use-trait nft-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u2000))
(define-constant ERR_ASSET_NOT_ALLOWED (err u2001))
(define-constant TREASURY (as-contract tx-sender))

;; DATA MAPS

(define-map AllowedAssets principal bool)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

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

(define-public (set-allowed-list (allowList (list 100 {token: principal, enabled: bool})))
  (begin
    (try! (is-dao-or-extension))
    (ok (map set-allowed-iter allowList))
  )
)

(define-public (deposit-stx (amount uint))
  (begin
    (print {
      event: "deposit-stx",
      amount: amount,
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (stx-transfer? amount tx-sender TREASURY)
  )
)

(define-public (deposit-ft (ft <ft-trait>) (amount uint))
  (begin
    (asserts! (is-allowed (contract-of ft)) ERR_ASSET_NOT_ALLOWED)
    (print {
      event: "deposit-ft",
      amount: amount,
      assetContract: (contract-of ft),
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (contract-call? ft transfer amount tx-sender TREASURY none)
  )
)

(define-public (deposit-nft (nft <nft-trait>) (id uint))
  (begin
    (asserts! (is-allowed (contract-of nft)) ERR_ASSET_NOT_ALLOWED)
    (print {
      event: "deposit-nft",
      assetContract: (contract-of nft),
      tokenId: id,
      caller: contract-caller,
      sender: tx-sender,
      recipient: TREASURY
    })
    (contract-call? nft transfer id tx-sender TREASURY)
  )
)

(define-public (withdraw-stx (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (print {
      event: "withdraw-stx",
      amount: amount,
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (as-contract (stx-transfer? amount TREASURY recipient))
  )
)

(define-public (withdraw-ft (ft <ft-trait>) (amount uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-allowed (contract-of ft)) ERR_ASSET_NOT_ALLOWED)
    (print {
      event: "withdraw-ft",
      assetContract: (contract-of ft),
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (as-contract (contract-call? ft transfer amount TREASURY recipient none))
  )
)

(define-public (withdraw-nft (nft <nft-trait>) (id uint) (recipient principal))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (is-allowed (contract-of nft)) ERR_ASSET_NOT_ALLOWED)
    (print {
      event: "withdraw-nft",
      assetContract: (contract-of nft),
      tokenId: id,
      caller: contract-caller,
      sender: tx-sender,
      recipient: recipient
    })
    (as-contract (contract-call? nft transfer id TREASURY recipient))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (is-allowed (assetContract principal))
  (default-to false (get-allowed-asset assetContract))
)

(define-read-only (get-allowed-asset (assetContract principal))
  (map-get? AllowedAssets assetContract)
)

(define-read-only (get-balance-stx)
  (stx-get-balance TREASURY)
)

;; PRIVATE FUNCTIONS

(define-private (set-allowed-iter (item {token: principal, enabled: bool}))
  (begin
    (print {
      event: "allow-asset",
      token: (get token item),
      enabled: (get enabled item)
    })
    (map-set AllowedAssets (get token item) (get enabled item))
  )
)
