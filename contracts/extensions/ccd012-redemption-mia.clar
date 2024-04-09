;; Title: CCD012 - CityCoin Redemption (MIA)
;; Version: 1.0.0
;; Summary: A redemption extension that allows users to redeem CityCoins for a portion of the city treasury.
;; Description: An extension that provides the ability to claim a portion of the city treasury in exchange for CityCoins.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u12000))
(define-constant ERR_PANIC (err u12001))
(define-constant ERR_GETTING_TOTAL_SUPPLY (err u12002))
(define-constant ERR_GETTING_REDEMPTION_BALANCE (err u12003))
(define-constant ERR_ALREADY_ENABLED (err u12004))
(define-constant ERR_NOT_ENABLED (err u12005))
(define-constant ERR_BALANCE_NOT_FOUND (err u12006))
(define-constant ERR_NOTHING_TO_REDEEM (err u12007))

;; helpers
(define-constant MICRO_CITYCOINS (pow u10 u6)) ;; 6 decimal places

;; DATA VARS

(define-data-var redemptionsEnabled bool false)
(define-data-var blockHeight uint u0)
(define-data-var totalSupply uint u0)
(define-data-var contractBalance uint u0)
(define-data-var redemptionRatio uint u0)

;; DATA MAPS

;; track totals per principal
(define-map RedemptionClaims
  principal ;; address
  uint      ;; total redemption amount
)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

;; initialize contract after deployment to start redemptions
(define-public (initialize-redemptions)
  (let
    (
      ;; MAINNET: TODO
      (miaTotalSupplyV1 (unwrap! (contract-call? .miamicoin-token get-total-supply) ERR_PANIC))
      (miaTotalSupplyV2 (unwrap! (contract-call? .miamicoin-token-v2 get-total-supply) ERR_PANIC))
      (miaTotalSupply (+ (* miaTotalSupplyV1 MICRO_CITYCOINS) miaTotalSupplyV2))
      (miaRedemptionBalance (as-contract (stx-get-balance tx-sender)))
    )
    ;; check if sender is DAO or extension
    (try! (is-dao-or-extension))
    ;; check that total supply is greater than 0
    (asserts! (and (> miaTotalSupplyV1 u0) (> miaTotalSupplyV2 u0)) ERR_GETTING_TOTAL_SUPPLY)
    ;; check that redemption balance is greater than 0
    (asserts! (> miaRedemptionBalance u0) ERR_GETTING_REDEMPTION_BALANCE)
    ;; check if redemptions are already enabled
    (asserts! (not (var-get redemptionsEnabled)) ERR_ALREADY_ENABLED)
    ;; record current block height
    (var-set blockHeight block-height)
    ;; record total supply at block height
    (var-set totalSupply miaTotalSupply)
    ;; record contract balance at block height
    (var-set contractBalance miaRedemptionBalance)
    ;; calculate redemption ratio
    (var-set redemptionRatio (/ miaRedemptionBalance miaTotalSupply))
    ;; set redemptionsEnabled to true, can only run once
    (ok (var-set redemptionsEnabled true))
  )
)

(define-public (redeem-mia)
  (let
    (
      (userAddress tx-sender)
      (balanceV1 (unwrap! (contract-call? .miamicoin-token get-balance userAddress) ERR_BALANCE_NOT_FOUND))
      (balanceV2 (unwrap! (contract-call? .miamicoin-token-v2 get-balance userAddress) ERR_BALANCE_NOT_FOUND))
      (totalBalance (+ (* balanceV1 MICRO_CITYCOINS) balanceV2))
      (redemptionAmount (unwrap! (get-redemption-for-balance totalBalance) ERR_NOTHING_TO_REDEEM))
      (redemptionClaims (default-to u0 (get-redemption-amount-claimed userAddress)))
    )
    ;; check if redemptions are enabled
    (asserts! (var-get redemptionsEnabled) ERR_NOT_ENABLED)
    ;; check that redemption amount is > 0
    (asserts! (> redemptionAmount u0) ERR_NOTHING_TO_REDEEM)
    ;; burn MIA
    (and (> u0 balanceV1) (try! (contract-call? .miamicoin-core-v1-patch burn-mia-v1 balanceV1 userAddress)))
    (and (> u0 balanceV2) (try! (contract-call? .miamicoin-token-v2 burn balanceV2 userAddress)))
    ;; transfer STX
    (try! (as-contract (stx-transfer? redemptionAmount tx-sender userAddress)))
    ;; update redemption claims
    (map-set RedemptionClaims userAddress (+ redemptionClaims redemptionAmount))
    ;; return redemption amount
    (ok redemptionAmount)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (is-redemption-enabled)
  (var-get redemptionsEnabled)
)

(define-read-only (get-redemption-block-height)
  (var-get blockHeight)
)

(define-read-only (get-redemption-total-supply)
  (var-get totalSupply)
)

(define-read-only (get-redemption-contract-balance)
  (var-get contractBalance)
)

(define-read-only (get-redemption-ratio)
  (var-get redemptionRatio)
)

;; aggregate all exposed vars above
(define-read-only (get-redemption-info)
  {
    redemptionsEnabled: (var-get redemptionsEnabled),
    blockHeight: (var-get blockHeight),
    totalSupply: (var-get totalSupply),
    contractBalance: (var-get contractBalance),
    redemptionRatio: (var-get redemptionRatio)
  }
)

(define-read-only (get-mia-balances)
  (let
    (
      (balanceV1 (unwrap! (contract-call? .miamicoin-token get-balance tx-sender) ERR_BALANCE_NOT_FOUND))
      (balanceV2 (unwrap! (contract-call? .miamicoin-token-v2 get-balance tx-sender) ERR_BALANCE_NOT_FOUND))
      (totalBalance (+ (* balanceV1 MICRO_CITYCOINS) balanceV2))
    )
    (ok {
      balanceV1: balanceV1,
      balanceV2: balanceV2,
      totalBalance: totalBalance
    })
  )
)

(define-read-only (get-redemption-for-balance (balance uint))
  (begin
    (asserts! (var-get redemptionsEnabled) none)
    (some (* balance (var-get redemptionRatio)))
  )
)

(define-read-only (get-redemption-amount-claimed (address principal))
    (map-get? RedemptionClaims tx-sender)
)

;; aggregate all exposed vars above
(define-read-only (get-user-redemption-info)
  (let
    (
      (miaBalances (try! (get-mia-balances)))
      (redemptionAmount (default-to u0 (get-redemption-for-balance (get totalBalance miaBalances))))
      (redemptionClaims (default-to u0 (get-redemption-amount-claimed tx-sender)))
    )
    (ok {
      address: tx-sender,
      miaBalances: miaBalances,
      redemptionAmount: redemptionAmount,
      redemptionClaims: redemptionClaims
    })
  )
)

;; PRIVATE FUNCTIONS
