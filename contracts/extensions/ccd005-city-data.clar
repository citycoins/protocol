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

(define-map AcitvationStatus uint bool)

(define-map ActivationDetails
  uint
  { succeededAt: uint, delay: uint, activatedAt: uint, threshold: uint }
)

(define-map TreasuryNonce uint uint)

(define-map TreasuryNames
  { cityId: uint, treasuryId: uint }
  (string-ascii 10)
)

(define-map TreasuryIds
  { cityId: uint, treasuryName: (string-ascii 10) }
  uint
)

(define-map TreasuryAddress
  { cityId: uint, treasuryId: uint }
  principal
)

(define-map CoinbaseThresholds
  uint
  {
    cbt1: uint,
    cbt2: uint,
    cbt3: uint,
    cbt4: uint,
    cbt5: uint,
  }
)

(define-map CoinbaseAmounts
  uint
  {
    cbaBonus: uint,
    cba1: uint,
    cba2: uint,
    cba3: uint,
    cba4: uint,
    cba5: uint,
    cbaDefault: uint
  }
)

(define-map CoinbaseDetails
  uint
  { bonus: uint, epoch: uint }
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
    (ok (map-set AcitvationStatus cityId status))
  )
)

(define-public (set-city-activation-details (cityId uint) (succeededAt uint) (delay uint) (activatedAt uint) (threshold uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (ok (map-set ActivationDetails cityId {
      succeededAt: succeededAt,
      delay: delay,
      activatedAt: activatedAt,
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
      (asserts! (is-none (map-get? TreasuryIds { cityId: cityId, treasuryName: name })) ERR_TREASURY_ALREADY_EXISTS)
      (map-set TreasuryNonce cityId nonce)
      (map-insert TreasuryIds { cityId: cityId, treasuryName: name } nonce)
      (map-insert TreasuryNames { cityId: cityId, treasuryId: nonce } name)
      (map-insert TreasuryAddress { cityId: cityId, treasuryId: nonce } address)
      (ok nonce)
    )
  )
)

(define-public (set-city-coinbase-thresholds (cityId uint) (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> threshold1 u0) (> threshold2 threshold1) (> threshold3 threshold2) (> threshold4 threshold3) (> threshold5 threshold4)) ERR_INVALID_THRESHOLDS)
    (ok (map-set CoinbaseThresholds cityId {
      cbt1: threshold1,
      cbt2: threshold2,
      cbt3: threshold3,
      cbt4: threshold4,
      cbt5: threshold5
    }))
  )
)

(define-public (set-city-coinbase-amounts (cityId uint) (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> amountBonus u0) (> amount1 u0) (> amount2 u0) (> amount3 u0) (> amount4 u0) (> amount5 u0) (> amountDefault u0)) ERR_INVALID_AMOUNTS)
    (ok (map-set CoinbaseAmounts cityId {
      cbaBonus: amountBonus,
      cba1: amount1,
      cba2: amount2,
      cba3: amount3,
      cba4: amount4,
      cba5: amount5,
      cbaDefault: amountDefault
    }))
  )
)

(define-public (set-city-coinbase-details (cityId uint) (bonusPeriod uint) (epochLength uint))
  (begin
    (try! (is-dao-or-extension))
    (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_INVALID_CITY)
    (asserts! (and (> bonusPeriod u0) (> epochLength u0)) ERR_INVALID_DETAILS)
    (ok (map-set CoinbaseDetails cityId {
      bonus: bonusPeriod,
      epoch: epochLength
    }))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-city-info (cityId uint) (treasuryName (string-ascii 10)))
  {
    activatedAt: (is-city-activated cityId),
    details: (get-city-activation-details cityId),
    treasury: (get-city-treasury-by-name cityId treasuryName),
  }
)

(define-read-only (is-city-activated (cityId uint))
  (default-to false (map-get? AcitvationStatus cityId))
)

(define-read-only (get-city-activation-details (cityId uint))
  (map-get? ActivationDetails cityId)
)

(define-read-only (get-city-treasury-nonce (cityId uint))
  (default-to u0 (map-get? TreasuryNonce cityId))
)

(define-read-only (get-city-treasury-id (cityId uint) (treasuryName (string-ascii 10)))
  (map-get? TreasuryIds { cityId: cityId, treasuryName: treasuryName })
)

(define-read-only (get-city-treasury-name (cityId uint) (treasuryId uint))
  (map-get? TreasuryNames { cityId: cityId, treasuryId: treasuryId })
)

(define-read-only (get-city-treasury-address (cityId uint) (treasuryId uint))
  (map-get? TreasuryAddress { cityId: cityId, treasuryId: treasuryId })
)

(define-read-only (get-city-treasury-by-name (cityId uint) (treasuryName (string-ascii 10)))
  (let
    ((treasuryId (unwrap! (map-get? TreasuryIds { cityId: cityId, treasuryName: treasuryName }) none)))
    (map-get? TreasuryAddress { cityId: cityId, treasuryId: treasuryId })
  )
)

(define-read-only (get-city-coinbase-info (cityId uint))
  {
    thresholds: (map-get? CoinbaseThresholds cityId),
    amounts: (map-get? CoinbaseAmounts cityId),
    details: (map-get? CoinbaseDetails cityId)
  }
)
