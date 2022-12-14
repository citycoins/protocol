;; Title: CCD005 City Data
;; Version: 1.0.0
;; Synopsis:
;; A datastore for city information in the CityCoins protocol.
;; Description:
;; An extension contract that uses the city ID as the key for
;; storing city information. This contract is used by other
;; CityCoins extensions to store and retrieve city information.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u5000))
(define-constant ERR_ACTIVATION_DETAILS_NOT_FOUND (err u5001))
(define-constant ERR_CONTRACT_ALREADY_ACTIVE (err u5002))
(define-constant ERR_ALREADY_VOTED (err u5003))
(define-constant ERR_INVALID_THRESHOLDS (err u5004))
(define-constant ERR_INVALID_AMOUNTS (err u5005))
(define-constant ERR_INVALID_BONUS_PERIOD (err u5006))

;; DATA MAPS

(define-map CityActivationStatus
  uint ;; city ID
  bool ;; status
)

(define-map CityActivationDetails
  uint
  {
    activated: uint,
    delay: uint,
    target: uint,
    threshold: uint
  }
)

(define-map CityActivationSignals
  uint ;; city ID
  uint ;; vote count
)

(define-map CityActivationVoters
  {
    cityId: uint,
    signaler: principal
  }
  bool
)

;; store nonce for incrementing treasuries per city
(define-map CityTreasuryNonce
  uint ;; city ID
  uint ;; nonce
)

;; store treasury by city ID and nonce
(define-map CityTreasuryNames
  {
    cityId: uint,
    treasuryId: uint
  }
  (string-ascii 32)
)

;; store treasury by city ID and name
(define-map CityTreasuryIds
  {
    cityId: uint,
    treasuryName: (string-ascii 32)
  }
  uint
)

;; store treasury address by city ID and nonce
(define-map CityTreasuryAddress
  {
    cityId: uint,
    treasuryId: uint
  }
  principal
)

;; TODO: what about DECIMAL values?
;; (define-constant DECIMALS u6)
;; (define-constant MICRO_CITYCOINS (pow u10 DECIMALS))
;; use token contract directly? call anyway for transfer

(define-map CityTokenContractNonce
  uint ;; city ID
  uint ;; nonce
)

;; MIA/NYC
;; 2

;; store token contract by city ID and nonce
(define-map CityTokenContracts
  {
    cityId: uint,
    tokenId: uint
  }
  principal ;; tokenAddress
)

;; MIA/0: miamicoin-token-v1
;; MIA/1: miamicoin-token-v2
;; NYC/0: newyorkcitycoin-token-v1
;; NYC/1: newyorkcitycoin-token-v2

;; store token contract by city ID and address
(define-map CityTokenContractIds
  {
    cityId: uint,
    tokenAddress: principal
  }
  uint ;; tokenId
)

;; MIA/miamicoin-token-v1: 0
;; MIA/miamicoin-token-v2: 1
;; NYC/newyorkcitycoin-token-v1: 0
;; NYC/newyorkcitycoin-token-v2: 1

;; store active treasury address by city ID
;; TODO maybe just return the principal here?
(define-map ActiveCityTokenContract
  uint ;; city ID
  {
    tokenId: uint,
    tokenAddress: principal
  }
)

;; MIA: 1/miamicoin-token-v2
;; NYC: 1/newyorkcitycoin-token-v2

;; store coinbase thresholds by city ID
(define-map CityCoinbaseThresholds
  uint ;; city ID
  {
    coinbaseThreshold1: uint,
    coinbaseThreshold2: uint,
    coinbaseThreshold3: uint,
    coinbaseThreshold4: uint,
    coinbaseThreshold5: uint,
  }
)

;; store coinbase amounts by city ID
(define-map CityCoinbaseAmounts
  uint ;; city ID
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

;; store coinbase bonus period length by city ID
(define-map CityCoinbaseBonusPeriod
  uint ;; city ID
  uint ;; length
)

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

;; extension callback
(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

;; guarded: sets activation status for a given city
(define-public (set-city-activation-status (cityId uint) (status bool))
  (let
    (
      (currentStatus (is-city-activated cityId))
    )
    (try! (is-dao-or-extension))
    (asserts! (not (is-eq currentStatus status)) ERR_UNAUTHORIZED)
    (map-set CityActivationStatus cityId status)
    (ok true)
  )
)

;; guarded: sets activation details for a given city
(define-public (set-city-activation-details (cityId uint) (activated uint) (delay uint) (target uint) (threshold uint))
  (begin
    (try! (is-dao-or-extension))
    (map-set CityActivationDetails cityId {
      activated: activated,
      delay: delay,
      target: target,
      threshold: threshold
    })
    (ok true)
  )
)

;; allows voting for the activation of a given city
(define-public (activate-city (cityId uint) (memo (optional (string-ascii 100))))
  (let
    (
      (status (is-city-activated cityId))
      (details (unwrap! (get-city-activation-details cityId) ERR_ACTIVATION_DETAILS_NOT_FOUND))
      (signals (+ (get-city-activation-signals cityId) u1))
    )
    ;; check if already active
    (asserts! (not status) ERR_CONTRACT_ALREADY_ACTIVE)
    ;; check if already voted
    (asserts! (not (get-city-activation-voter cityId tx-sender)) ERR_ALREADY_VOTED)
    ;; set activation signals
    (map-set CityActivationSignals cityId signals)
    ;; record vote
    (map-insert CityActivationVoters { cityId: cityId, signaler: tx-sender } true)
    ;; if signals = threshold
    (and (is-eq signals (get threshold details))
      (let
        (
          (target (+ block-height (get delay details)))
        )
        ;; set city activation status
        (map-set CityActivationStatus cityId true)
        ;; set city activation details
        (map-set CityActivationDetails cityId 
          (merge details {
            activated: block-height,
            target: target
          }))
          ;; TOKEN_BONUS_PERIOD u10000
          ;; TOKEN_EPOCH_LENGTH u25000
          ;; TODO: set coinbase thresholds
          ;;   stacksHeight + bonus + length
          ;;   same * u3
          ;;   same * u7
          ;;   same * u15
          ;;   same * u31
          ;; MICRO_CITYCOINS u1000000 (v2 only, v1 is u1)
          ;; TODO: set coinbase amounts
          ;;   MICRO_CITYCOINS * u250000
          ;;   MICRO_CITYCOINS * u100000
          ;;   MICRO_CITYCOINS * u50000
          ;;   MICRO_CITYCOINS * u25000
          ;;   MICRO_CITYCOINS * u12500
          ;;   MICRO_CITYCOINS * u6250
          ;;   MICRO_CITYCOINS * u3125
          ;; TODO: double check with ccip-008
      )
    )
    (ok true)
  )
)

;; guarded: adds a new treasury definition for a given city
(define-public (add-city-treasury (cityId uint) (address principal) (name (string-ascii 32)))
  (begin
    (let
      (
        (nonce (+ u1 (get-city-treasury-nonce cityId)))
      )
      ;; TODO: check that cityId exists
      (try! (is-dao-or-extension))
      (map-set CityTreasuryNonce cityId nonce)
      (map-insert CityTreasuryIds { cityId: cityId, treasuryName: name } nonce)
      (map-insert CityTreasuryNames { cityId: cityId, treasuryId: nonce } name)
      (map-insert CityTreasuryAddress { cityId: cityId, treasuryId: nonce } address)
      (ok nonce)
    )
  )
)

;; guarded: adds a new token contract definition for a given city
(define-public (add-city-token-contract (cityId uint) (address principal))
  (let
    (
      (nonce (+ u1 (get-city-token-contract-nonce cityId)))
    )
    (try! (is-dao-or-extension))
    (map-set CityTokenContractNonce cityId nonce)
    (map-insert CityTokenContractIds { cityId: cityId, tokenAddress: address } nonce)
    (map-insert CityTokenContracts { cityId: cityId, tokenId: nonce } address)
    (ok nonce)
  )
)

;; guarded: sets the active token contract for a given city
(define-public (set-active-city-token-contract (cityId uint) (tokenId uint))
  (begin
    (try! (is-dao-or-extension))
    (map-set ActiveCityTokenContract cityId {
      tokenId: tokenId,
      tokenAddress: (unwrap! (get-city-token-contract-address cityId tokenId) ERR_UNAUTHORIZED)
    })
    (ok true)
  )
)

;; guarded: sets coinbase thresholds for a given city
(define-public (set-city-coinbase-thresholds (cityId uint) (threshold1 uint) (threshold2 uint) (threshold3 uint) (threshold4 uint) (threshold5 uint))
  (begin
    (try! (is-dao-or-extension))
    ;; check that all thresholds increase in value
    (asserts! (and (> threshold1 u0) (> threshold2 threshold1) (> threshold3 threshold2) (> threshold4 threshold3) (> threshold5 threshold4)) ERR_INVALID_THRESHOLDS)
    (map-set CityCoinbaseThresholds cityId {
      coinbaseThreshold1: threshold1,
      coinbaseThreshold2: threshold2,
      coinbaseThreshold3: threshold3,
      coinbaseThreshold4: threshold4,
      coinbaseThreshold5: threshold5
    })
    (ok true)
  )
)

;; guarded: sets coinbase amounts for a given city
(define-public (set-city-coinbase-amounts (cityId uint) (amountBonus uint) (amount1 uint) (amount2 uint) (amount3 uint) (amount4 uint) (amount5 uint) (amountDefault uint))
  (begin
    (try! (is-dao-or-extension))
    ;; check that all amounts are greater than zero
    (asserts! (and (> amountBonus u0) (> amount1 u0) (> amount2 u0) (> amount3 u0) (> amount4 u0) (> amount5 u0) (> amountDefault u0)) ERR_INVALID_AMOUNTS)
    (map-set CityCoinbaseAmounts cityId {
      coinbaseAmountBonus: amountBonus,
      coinbaseAmount1: amount1,
      coinbaseAmount2: amount2,
      coinbaseAmount3: amount3,
      coinbaseAmount4: amount4,
      coinbaseAmount5: amount5,
      coinbaseAmountDefault: amountDefault
    })
    (ok true)
  )
)

;; guarded: sets coinbase bonus period length for a given city
(define-public (set-city-coinbase-bonus-period (cityId uint) (bonusPeriod uint))
  (begin
    (try! (is-dao-or-extension))
    ;; check that bonus period is greater than zero
    (asserts! (> bonusPeriod u0) ERR_INVALID_BONUS_PERIOD)
    (map-set CityCoinbaseBonusPeriod cityId bonusPeriod)
    (ok true)
  )
)

;; TODO: how to handle epoch length?

;; READ ONLY FUNCTIONS

;; returns true if city is activated
(define-read-only (is-city-activated (cityId uint))
  (default-to false (map-get? CityActivationStatus cityId))
)

;; returns (some) or none
(define-read-only (get-city-activation-details (cityId uint))
  (map-get? CityActivationDetails cityId)
)

;; original settings:
;;   activation: block height (MIA: 24497 / NYC: 37449)
;;   activation: delay (150 blocks)
;;   activation: status (bool)
;;   activation: target (activation block + delay)
;;   activation: threshold (20)

(define-read-only (get-city-activation-signals (cityId uint))
  (default-to u0 (map-get? CityActivationSignals cityId))
)

(define-read-only (get-city-activation-voter (cityId uint) (voter principal))
  (default-to false (map-get? CityActivationVoters { cityId: cityId, signaler: voter }))
)

;; returns current nonce or default of u0
(define-read-only (get-city-treasury-nonce (cityId uint))
  (default-to u0 (map-get? CityTreasuryNonce cityId))
)

;; returns (some uint) or none
(define-read-only (get-city-treasury-id (cityId uint) (treasuryName (string-ascii 32)))
  (map-get? CityTreasuryIds { cityId: cityId, treasuryName: treasuryName })
)

;; returns (some (string-ascii 32)) or none
(define-read-only (get-city-treasury-name (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryNames { cityId: cityId, treasuryId: treasuryId })
)

;; returns (some principal) or none
(define-read-only (get-city-treasury-address (cityId uint) (treasuryId uint))
  (map-get? CityTreasuryAddress { cityId: cityId, treasuryId: treasuryId })
)

;; returns current nonce or default of u0
(define-read-only (get-city-token-contract-nonce (cityId uint))
  (default-to u0 (map-get? CityTokenContractNonce cityId))
)

;; returns (some uint) or none
(define-read-only (get-city-token-contract-id (cityId uint) (tokenAddress principal))
  (map-get? CityTokenContractIds { cityId: cityId, tokenAddress: tokenAddress })
)

;; returns (some principal) or none
(define-read-only (get-city-token-contract-address (cityId uint) (tokenId uint))
  (map-get? CityTokenContracts { cityId: cityId, tokenId: tokenId })
)

;; returns (some principal) or none
(define-read-only (get-active-city-token-contract (cityId uint))
  (map-get? ActiveCityTokenContract cityId)
)

;; returns (some thresholds) or none
(define-read-only (get-city-coinbase-thresholds (cityId uint))
  (map-get? CityCoinbaseThresholds cityId)
)

;; returns (some amounts) or none
(define-read-only (get-city-coinbase-amounts (cityId uint))
  (map-get? CityCoinbaseAmounts cityId)
)

;; returns (some uint) or none
(define-read-only (get-city-coinbase-bonus-period (cityId uint))
  (map-get? CityCoinbaseBonusPeriod cityId)
)
