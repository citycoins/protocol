;; Title: CCD005 City Data
;; Version: 1.0.0
;; Summary: A datastore for city information in the CityCoins protocol.
;; Description: An extension contract that uses the city ID as the key for storing city information. This contract is used by other CityCoins extensions to store and retrieve city information.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u5000))
(define-constant ERR_TREASURY_ALREADY_EXISTS (err u5001))
(define-constant ERR_INVALID_THRESHOLDS (err u5002))
(define-constant ERR_INVALID_AMOUNTS (err u5003))
(define-constant ERR_INVALID_DETAILS (err u5004))
(define-constant ERR_INVALID_CITY (err u5005))

;; DATA MAPS

(define-map CityActivationStatus uint bool)

(define-map CityActivationDetails
  uint
  { succeeded: uint, delay: uint, activated: uint, threshold: uint }
)

(define-map CityTreasuryNonce uint uint)

(define-map CityTreasuryNames
  { cityId: uint, treasuryId: uint }
  (string-ascii 10)
)

(define-map CityTreasuryIds
  { cityId: uint, treasuryName: (string-ascii 10) }
  uint
)

(define-map CityTreasuryAddress
  { cityId: uint, treasuryId: uint }
  principal
)

(define-map CityTokenContractNonce uint uint)

(define-map CityTokenContracts
  { cityId: uint, tokenId: uint }
  principal
)

(define-map CityTokenContractIds
  { cityId: uint, tokenAddress: principal }
  uint
)

(define-map ActiveCityTokenContract
  uint
  { tokenId: uint, tokenAddress: principal }
)

(define-map CityCoinbaseThresholds
  uint
  {
    coinbaseThreshold1: uint,
    coinbaseThreshold2: uint,
    coinbaseThreshold3: uint,
    coinbaseThreshold4: uint,
    coinbaseThreshold5: uint,
  }
)

(define-map CityCoinbaseAmounts
  uint
  {
    coinbaseAmountBonus: uint,
    coinbaseAmount1: uint,
    coinbaseAmount2: uint,
    coinbaseAmount3: uint,
    coinbaseAmount4: uint,
    coinbaseAmount5: uint,
    coinbaseAmountDefault: uint
  }
)

(define-map CityCoinbaseDetails
  uint
  { coinbaseBonusPeriod: uint, coinbaseEpochLength: uint }
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

(define-public (set-city-activation-status (cityId uint) (status bool))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (not (is-eq (is-city-activated cityId) status)) ERR_UNAUTHORIZED)
    (ok (map-set CityActivationStatus cityId status))
  )
)

(define-public (set-city-activation-details (cityId uint) (succeeded uint) (delay uint) (activated uint) (threshold uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (ok (map-set CityActivationDetails cityId {
      succeeded: succeeded,
      delay: delay,
      activated: activated,
      threshold: threshold
    }))
  )
)

(define-public (add-city-treasury (cityId uint) (address principal) (name (string-ascii 10)))
  (begin
    (let
      ((nonce (+ u1 (get-city-treasury-nonce cityId))))
      (try! (is-dao-or-extension))
      (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
      (asserts! (is-none (map-get? CityTreasuryIds { cityId: cityId, treasuryName: name })) ERR_TREASURY_ALREADY_EXISTS)
      (map-set CityTreasuryNonce cityId nonce)
      (map-insert CityTreasuryIds { cityId: cityId, treasuryName: name } nonce)
      (map-insert CityTreasuryNames { cityId: cityId, treasuryId: nonce } name)
      (map-insert CityTreasuryAddress { cityId: cityId, treasuryId: nonce } address)
      (ok nonce)
    )
  )
)

(define-public (add-city-token-contract (cityId uint) (address principal))
  (let
    ((nonce (+ u1 (get-city-token-contract-nonce cityId))))
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (map-set CityTokenContractNonce cityId nonce)
    (map-insert CityTokenContractIds { cityId: cityId, tokenAddress: address } nonce)
    (map-insert CityTokenContracts { cityId: cityId, tokenId: nonce } address)
    (ok nonce)
  )
)

(define-public (set-active-city-token-contract (cityId uint) (tokenId uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (ok (map-set ActiveCityTokenContract cityId {
      tokenId: tokenId,
      tokenAddress: (unwrap! (get-city-token-contract-address cityId tokenId) ERR_UNAUTHORIZED)
    }))
  )
)

(define-public (set-city-coinbase-thresholds (cityId uint) (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> threshold1 u0) (> threshold2 threshold1) (> threshold3 threshold2) (> threshold4 threshold3) (> threshold5 threshold4)) ERR_INVALID_THRESHOLDS)
    (ok (map-set CityCoinbaseThresholds cityId {
      coinbaseThreshold1: threshold1,
      coinbaseThreshold2: threshold2,
      coinbaseThreshold3: threshold3,
      coinbaseThreshold4: threshold4,
      coinbaseThreshold5: threshold5
    }))
  )
)

(define-public (set-city-coinbase-amounts (cityId uint) (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> amountBonus u0) (> amount1 u0) (> amount2 u0) (> amount3 u0) (> amount4 u0) (> amount5 u0) (> amountDefault u0)) ERR_INVALID_AMOUNTS)
    (ok (map-set CityCoinbaseAmounts cityId {
      coinbaseAmountBonus: amountBonus,
      coinbaseAmount1: amount1,
      coinbaseAmount2: amount2,
      coinbaseAmount3: amount3,
      coinbaseAmount4: amount4,
      coinbaseAmount5: amount5,
      coinbaseAmountDefault: amountDefault
    }))
  )
)

(define-public (set-city-coinbase-details (cityId uint) (bonusPeriod uint) (epochLength uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> bonusPeriod u0) (> epochLength u0)) ERR_INVALID_DETAILS)
    (ok (map-set CityCoinbaseDetails cityId {
      coinbaseBonusPeriod: bonusPeriod,
      coinbaseEpochLength: epochLength
    }))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-city-info (cityId uint) (treasuryName (string-ascii 10)))
  {
    activated: (is-city-activated cityId),
    details: (get-city-activation-details cityId),
    treasury: (get-city-treasury-by-name cityId treasuryName),
  }
)

(define-read-only (is-city-activated (cityId uint))
  (default-to false (map-get? CityActivationStatus cityId))
)

(define-read-only (get-city-activation-details (cityId uint))
  (map-get? CityActivationDetails cityId)
)

(define-read-only (get-city-treasury-nonce (cityId uint))
  (default-to u0 (map-get? CityTreasuryNonce cityId))
)

(define-read-only (get-city-treasury-id (cityId uint) (treasuryName (string-ascii 10)))
  (map-get? CityTreasuryIds { cityId: cityId, treasuryName: treasuryName })
)

(define-read-only (get-city-treasury-name (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryNames { cityId: cityId, treasuryId: treasuryId })
)

(define-read-only (get-city-treasury-address (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryAddress { cityId: cityId, treasuryId: treasuryId })
)

(define-read-only (get-city-treasury-by-name (cityId uint) (treasuryName (string-ascii 10)))
  (let
    ((treasuryId (unwrap! (map-get? CityTreasuryIds { cityId: cityId, treasuryName: treasuryName }) none)))
    (map-get? CityTreasuryAddress { cityId: cityId, treasuryId: treasuryId })
  )
)

(define-read-only (get-city-token-contract-nonce (cityId uint))
  (default-to u0 (map-get? CityTokenContractNonce cityId))
)

(define-read-only (get-city-token-contract-id (cityId uint) (tokenAddress principal))
  (map-get? CityTokenContractIds { cityId: cityId, tokenAddress: tokenAddress })
)

(define-read-only (get-city-token-contract-address (cityId uint) (tokenId uint))
  (map-get? CityTokenContracts { cityId: cityId, tokenId: tokenId })
)

(define-read-only (get-active-city-token-contract (cityId uint))
  (map-get? ActiveCityTokenContract cityId)
)

(define-read-only (get-city-coinbase-info (cityId uint))
  {
    thresholds: (map-get? CityCoinbaseThresholds cityId),
    amounts: (map-get? CityCoinbaseAmounts cityId),
    details: (map-get? CityCoinbaseDetails cityId)
  }
)
