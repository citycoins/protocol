;; Title: CCD006 City Mining
;; Version: 1.0.0
;; Synopsis:
;; A central city mining contract for the CityCoins protocol.
;; Description:
;; An extension that provides a mining interface per city, in which
;; each mining participant spends STX per block for a weighted chance
;; to mint new CityCoins per the issuance schedule.

;; TRAITS

;; TODO: protocol traits?
(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u6000))
(define-constant ERR_INVALID_DELAY (err u6001))
(define-constant ERR_INVALID_COMMIT_AMOUNTS (err u6002))
(define-constant ERR_INSUFFICIENT_BALANCE (err u6003))
(define-constant ERR_ALREADY_MINED (err u6004))
(define-constant ERR_INSUFFICIENT_COMMIT (err u6005))
(define-constant ERR_REWARD_NOT_MATURE (err u6006))
(define-constant ERR_VRF_SEED_NOT_FOUND (err u6007))
(define-constant ERR_DID_NOT_MINE (err u6008))
(define-constant ERR_MINER_DATA_NOT_FOUND (err u6009))
(define-constant ERR_ALREADY_CLAIMED (err u6010))
(define-constant ERR_MINER_NOT_WINNER (err u6011))
(define-constant ERR_NOTHING_TO_MINT (err u6012))
(define-constant ERR_USER_ID_NOT_FOUND (err u6013))
(define-constant ERR_CITY_ID_NOT_FOUND (err u6014))
(define-constant ERR_CITY_NAME_NOT_FOUND (err u6015))
(define-constant ERR_CITY_NOT_ACTIVATED (err u6016))
(define-constant ERR_CITY_DETAILS_NOT_FOUND (err u6017))
(define-constant ERR_CITY_TREASURY_NOT_FOUND (err u6018))
(define-constant ERR_CITY_COINBASE_THRESHOLDS_NOT_FOUND (err u6019))
(define-constant ERR_CITY_COINBASE_AMOUNTS_NOT_FOUND (err u6020))
(define-constant ERR_CITY_COINBASE_BONUS_PERIOD_NOT_FOUND (err u6021))

;; DATA VARS

;; delay before mining rewards can be claimed
(define-data-var rewardDelay uint u100)

;; DATA MAPS

;; For a given city and Stacks block height
;; - how many miners were there
;; - what was the total amount submitted
;; - was the block reward claimed
(define-map MiningStatsAtBlock
  {
    cityId: uint,
    height: uint
  }
  {
    miners: uint,
    amount: uint,
    claimed: bool
  }
)

;; For a given Stacks block height and user ID:
;; - what is their ustx commitment
;; - what are the low/high values (used for VRF)
(define-map MinerAtBlock
  {
    cityId: uint,
    height: uint,
    userId: uint
  }
  {
    commit: uint,
    low: uint,
    high: uint,
    winner: bool
  }
)

;; For a given city and Stacks block height
;; - what is the high value from MinerAtBlock
(define-map HighValueAtBlock
  {
    cityId: uint,
    height: uint
  }
  uint
)

;; For a given city and Stacks block height
;; - what is the ID of the miner who won the block?
;; (only known after the miner claims the block)
(define-map WinnerAtBlock
  {
    cityId: uint,
    height: uint
  }
  uint
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

;; guarded: set the delay before mining rewards can be claimed
(define-public (set-reward-delay (delay uint))
  (begin 
    (try! (is-dao-or-extension))
    (asserts! (> delay u0) ERR_INVALID_DELAY)
    (ok (var-set rewardDelay delay))
  )
)

(define-public (mine (cityName (string-ascii 32)) (amounts (list 200 uint)))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
      (cityDetails (try! (get-city-activation-details cityId)))
      (cityTreasury (try! (get-city-treasury-by-name cityId "mining")))
      (userId (try! (as-contract
        (contract-call? .ccd003-user-registry get-or-create-user-id tx-sender)
      )))
    )
    (asserts! cityActivated ERR_CITY_NOT_ACTIVATED)
    (asserts! (> (len amounts) u0) ERR_INVALID_COMMIT_AMOUNTS)
    (match (fold mine-block amounts (ok {
      cityId: cityId,
      userId: userId,
      height: block-height,
      totalAmount: u0,
    }))
      okReturn
      (let
        (
          (totalAmount (get totalAmount okReturn))
        )
        (asserts! (>= (stx-get-balance tx-sender) totalAmount) ERR_INSUFFICIENT_BALANCE)
        (try! (stx-transfer? totalAmount tx-sender cityTreasury))
        (print {
          action: "mining",
          userId: userId,
          cityName: cityName,
          cityId: cityId,
          cityTreasury: cityTreasury,
          firstBlock: block-height,
          lastBlock: (- (+ block-height (len amounts)) u1),
          totalBlocks: (len amounts),
          totalAmount: totalAmount
        })
        (ok true)
      )
      errReturn (err errReturn)
    )
  )
)

(define-public (claim-mining-reward (cityName (string-ascii 32)) (claimHeight uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
    )
    (claim-mining-reward-at-block cityName cityId tx-sender block-height claimHeight)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-reward-delay)
  (var-get rewardDelay)
)

(define-read-only (get-mining-stats-at-block (cityId uint) (height uint))
  (default-to {
      miners: u0,
      amount: u0,
      claimed: false
    }
    (map-get? MiningStatsAtBlock {
      cityId: cityId,
      height: height
    })
  )
)

;; returns true if a miner already mined at a given city and block height
(define-read-only (has-mined-at-block (cityId uint) (height uint) (userId uint))
  (is-some (map-get? MinerAtBlock {
    cityId: cityId,
    height: height,
    userId: userId
  }))
)

;; returns miner statistics if found
(define-read-only (get-miner-at-block (cityId uint) (height uint) (userId uint))
  (default-to {
      commit: u0,
      low: u0,
      high: u0
    }
    (map-get? MinerAtBlock {
      cityId: cityId,
      height: height,
      userId: userId
    })
  )
)

(define-read-only (get-high-value (cityId uint) (height uint))
  (default-to u0
    (map-get? HighValueAtBlock {
      cityId: cityId,
      height: height
    })
  )
)

(define-read-only (get-block-winner (cityId uint) (height uint))
  (map-get? WinnerAtBlock {
    cityId: cityId,
    height: height
  })
)

(define-read-only (is-block-winner (cityId uint) (user principal) (claimHeight uint))
  (let
    (
      (userId (default-to u0 (contract-call? .ccd003-user-registry get-user-id user)))
      (blockStats (get-mining-stats-at-block cityId claimHeight))
      (minerStats (get-miner-at-block cityId claimHeight userId))
      (maturityHeight (+ (get-reward-delay) claimHeight))
      (vrfSample (unwrap-panic (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2 get-rnd maturityHeight)))
      (commitTotal (get-high-value cityId claimHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    ;; check that user ID was found and if user is winner
    (if (and (> userId u0) (>= winningValue (get low minerStats)) (<= winningValue (get high minerStats)))
      ;; true
      (some {
        winner: true,
        claimed: (get claimed blockStats),
      })
      ;; false
      (some {
        winner: false,
        claimed: (get claimed blockStats),
      })
    )
  )
)

(define-read-only (get-coinbase-amount (cityId uint) (blockHeight uint))
  (let
    (
      (thresholds (unwrap! (get-city-coinbase-thresholds cityId) u0))
      (amounts (unwrap! (get-city-coinbase-amounts cityId) u0))
      (cityActivated (unwrap! (is-city-activated cityId) u0))
      (cityDetails (unwrap! (get-city-activation-details cityId) u0))
      (cityBonusPeriod (unwrap! (get-city-coinbase-bonus-period cityId) u0))
    )
    ;; if contract is not active, return 0
    (asserts! (is-eq cityActivated true) u0)
    ;; if contract is active, return amount based on thresholds
    (asserts! (> blockHeight (get activated cityDetails))
      (if (<= (- blockHeight (get activated cityDetails)) cityBonusPeriod)
        ;; bonus reward for initial miners
        (get coinbaseAmountBonus amounts)
        ;; standard reward until 1st halving
        (get coinbaseAmount1 amounts)
      )
    )
    (asserts! (> blockHeight (get coinbaseThreshold2 thresholds)) (get coinbaseAmount2 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold3 thresholds)) (get coinbaseAmount3 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold4 thresholds)) (get coinbaseAmount4 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold5 thresholds)) (get coinbaseAmount5 amounts))
    ;; default value after final halving
    (get coinbaseAmountDefault amounts)
  )
)

;; PRIVATE FUNCTIONS

(define-private (mine-block (amount uint)
  (return (response
    {
      cityId: uint,
      userId: uint,
      height: uint,
      totalAmount: uint
    }
    uint
  )))
  (match return
    okReturn
    (let
      (
        (cityId (get cityId okReturn))
        (userId (get userId okReturn))
        (height (get height okReturn))
        (totalAmount (get totalAmount okReturn))
      )
      (asserts! (not (has-mined-at-block cityId height userId)) ERR_ALREADY_MINED)
      (asserts! (> amount u0) ERR_INSUFFICIENT_COMMIT)
      (set-mining-data cityId height userId amount)
      (ok (merge okReturn
        {
          height: (+ height u1),
          totalAmount: (+ totalAmount amount)
        }
      ))
    )
    errReturn (err errReturn)
  )
)

(define-private (set-mining-data (cityId uint) (userId uint) (height uint) (amount uint))
  (let
    (
      (blockStats (get-mining-stats-at-block cityId height))
      (minerCount (+ (get miners blockStats) u1))
      (vrfLowVal (get-high-value cityId height))
    )
    ;; update mining stats at block
    (map-set MiningStatsAtBlock
      {
        cityId: cityId,
        height: height
      }
      {
        miners: minerCount,
        amount: (+ (get amount blockStats) amount),
        claimed: false
      }
    )
    ;; set miner details at block
    (map-insert MinerAtBlock
      {
        cityId: cityId,
        height: height,
        userId: userId
      }
      {
        commit: amount,
        low: (if (> vrfLowVal u0) (+ vrfLowVal u1) u0),
        high: (+ vrfLowVal amount),
        winner: false
      }
    )
    ;; set new high value for VRF
    (map-set HighValueAtBlock
      {
        cityId: cityId,
        height: height
      }
      (+ vrfLowVal amount)
    )
  )
)

(define-private (claim-mining-reward-at-block (cityName (string-ascii 32)) (cityId uint) (user principal) (stacksHeight uint) (claimHeight uint))
  (let
    (
      (maturityHeight (+ (get-reward-delay) claimHeight))
      (isMature (asserts! (> stacksHeight maturityHeight) ERR_REWARD_NOT_MATURE))
      (userId (try! (get-user-id user)))
      (blockStats (get-mining-stats-at-block cityId claimHeight))
      (minerStats (get-miner-at-block cityId claimHeight userId))
      (vrfSample (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2 get-save-rnd maturityHeight) ERR_VRF_SEED_NOT_FOUND))
      (commitTotal (get-high-value cityId claimHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    ;; check that user mined in this block
    (asserts! (has-mined-at-block cityId claimHeight userId) ERR_DID_NOT_MINE)
    ;; check that stats and miner data are populated
    (asserts! (and
      (> (get miners blockStats) u0)
      (> (get commit minerStats) u0))
      ERR_MINER_DATA_NOT_FOUND)
    ;; check that block has not already been claimed
    (asserts! (not (get claimed blockStats)) ERR_ALREADY_CLAIMED)
    ;; check that user is the winner
    (asserts! (and
      (>= winningValue (get low minerStats))
      (<= winningValue (get high minerStats)))
      ERR_MINER_NOT_WINNER)
    ;; update mining stats at block
    (map-set MiningStatsAtBlock
      { cityId: cityId, height: claimHeight }
      (merge blockStats { claimed: true })
    )
    ;; set miner details at block
    (map-set MinerAtBlock
      { cityId: cityId, height: claimHeight, userId: userId }
      (merge minerStats { winner: true })
    )
    ;; set winner at block
    (map-set WinnerAtBlock
      { cityId: cityId, height: claimHeight }
      userId
    )
    (try! (mint-coinbase cityName cityId user claimHeight))
    (print {
      action: "mining-claim",
      userId: userId,
      cityName: cityName,
      cityId: cityId,
      claimHeight: claimHeight
      ;; TODO: any way to get amount here?
    })
    (ok true)
  )
)

(define-private (mint-coinbase (cityName (string-ascii 32)) (cityId uint) (recipient principal) (blockHeight uint))
  (let
    (
      (amount (get-coinbase-amount cityId blockHeight))
    )
    ;; check that amount is greater than 0
    (asserts! (> amount u0) ERR_NOTHING_TO_MINT)
    ;; temporarily hardcoded to cities until Stacks 2.1
    ;; next version can use traits as stored principals
    (and
      (is-eq cityName "mia")
      (is-ok (as-contract
        (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 mint amount recipient)
      ))
    )
    (and
      (is-eq cityName "nyc")
      (is-ok (as-contract
        (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 mint amount recipient)
      ))
    )
    (ok true)
  )
)

;; get user ID from ccd003-user-registry
;; returns (ok uint) or ERR_USER_ID_NOT_FOUND if not found
(define-private (get-user-id (user principal))
  ;; #[filter(user)]
  (ok (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_USER_ID_NOT_FOUND))
)

;; get city ID from ccd004-city-registry
;; returns (ok uint) or ERR_CITY_ID_NOT_FOUND if not found
(define-private (get-city-id (cityName (string-ascii 32)))
  ;; #[filter(cityName)]
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND))
)

;; get city name from ccd004-city-registry
;; returns (ok (string-ascii 32)) or ERR_CITY_NAME_NOT_FOUND if not found
(define-private (get-city-name (cityId uint))
  ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-name cityId) ERR_CITY_NAME_NOT_FOUND))
)

;; get city activation status from .ccd005-city-data
;; returns (ok true) or ERR_CITY_NOT_ACTIVATED if not found
(define-private (is-city-activated (cityId uint))
  (ok (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_CITY_NOT_ACTIVATED))
)

;; get city activation details from ccd005-city-data
;; returns (ok tuple) or ERR_CITY_DETAILS_NOT_FOUND if not found
(define-private (get-city-activation-details (cityId uint))
  ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) ERR_CITY_DETAILS_NOT_FOUND))
)

;; get city treasury details from ccd005-city-data
;; returns (ok principal) or ERR_CITY_TREASURY_NOT_FOUND if not found
(define-private (get-city-treasury-by-name (cityId uint) (treasuryName (string-ascii 32)))
  (let
    (
      (treasuryId (unwrap! (contract-call? .ccd005-city-data get-city-treasury-id cityId treasuryName) ERR_CITY_TREASURY_NOT_FOUND))
    )
    ;; #[filter(cityId, treasuryName)]
    (ok (unwrap! (contract-call? .ccd005-city-data get-city-treasury-address cityId treasuryId) ERR_CITY_TREASURY_NOT_FOUND))
  )
)

;; get city coinbase thresholds from ccd005-city-data
;; returns (ok tuple) or ERR_CITY_COINBASE_THRESHOLDS_NOT_FOUND if not found
(define-private (get-city-coinbase-thresholds (cityId uint))
  ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-coinbase-thresholds cityId) ERR_CITY_COINBASE_THRESHOLDS_NOT_FOUND))
)

;; get city coinbase amounts from ccd005-city-data
;; returns (ok tuple) or ERR_CITY_COINBASE_AMOUNTS_NOT_FOUND if not found
(define-private (get-city-coinbase-amounts (cityId uint))
  ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-coinbase-amounts cityId) ERR_CITY_COINBASE_AMOUNTS_NOT_FOUND))
)

;; get city coinbase bonus period from ccd005-city-data
;; returns (ok uint) or ERR_CITY_COINBASE_BONUS_PERIOD_NOT_FOUND if not found
(define-private (get-city-coinbase-bonus-period (cityId uint))
  ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-coinbase-bonus-period cityId) ERR_CITY_COINBASE_BONUS_PERIOD_NOT_FOUND))
)
