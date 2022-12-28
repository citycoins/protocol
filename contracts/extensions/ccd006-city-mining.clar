;; Title: CCD006 City Mining
;; Version: 1.0.0
;; Synopsis: A central city mining contract for the CityCoins protocol.
;; Description: An extension that provides a mining interface per city, in which each mining participant spends STX per block for a weighted chance to mint new CityCoins per the issuance schedule.

;; TRAITS

(impl-trait .extension-trait.extension-trait)
(impl-trait 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-core-v2-trait.citycoin-core-v2)

;; CONSTANTS

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
(define-constant ERR_FUNCTION_DISABLED (err u6022))

;; DATA VARS

(define-data-var rewardDelay uint u100)

;; DATA MAPS

(define-map MiningStatsAtBlock
  { cityId: uint, height: uint }
  { miners: uint, amount: uint, claimed: bool }
)

(define-map MinerAtBlock
  { cityId: uint, height: uint, userId: uint }
  { commit: uint, low: uint, high: uint, winner: bool }
)

(define-map HighValueAtBlock
  { cityId: uint, height: uint }
  uint
)

(define-map WinnerAtBlock
  { cityId: uint, height: uint }
  uint
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

(define-public (set-reward-delay (delay uint))
  (begin 
    (try! (is-dao-or-extension))
    (asserts! (> delay u0) ERR_INVALID_DELAY)
    (ok (var-set rewardDelay delay))
  )
)

(define-public (mine (cityName (string-ascii 10)) (amounts (list 200 uint)))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND))
      (cityInfo (contract-call? .ccd005-city-data get-city-info cityId "mining"))
      (cityDetails (unwrap! (get details cityInfo) ERR_CITY_DETAILS_NOT_FOUND))
      (cityTreasury (unwrap! (get treasury cityInfo) ERR_CITY_TREASURY_NOT_FOUND))
      (user tx-sender)
      (userId (try! (as-contract (contract-call? .ccd003-user-registry get-or-create-user-id user))))
      (totalAmount (fold + amounts u0))
    )
    (asserts! (get activated cityInfo) ERR_CITY_NOT_ACTIVATED)
    (asserts! (>= (stx-get-balance tx-sender) totalAmount) ERR_INSUFFICIENT_BALANCE)
    (asserts! (> (len amounts) u0) ERR_INVALID_COMMIT_AMOUNTS)
    (begin
      (try! (fold mine-block amounts (ok {
        cityId: cityId,
        userId: userId,
        height: block-height,
        totalAmount: u0,
      })))
      (print {
        action: "mining",
        userId: userId,
        cityName: cityName,
        cityId: cityId,
        cityTreasury: cityTreasury,
        firstBlock: block-height,  
        lastBlock: (- (+ block-height (len amounts)) u1),
        totalBlocks: (len amounts),
        totalAmount: totalAmount,
      })                
      (stx-transfer? totalAmount tx-sender cityTreasury)
    )
  )
)

(define-public (claim-mining-block (cityName (string-ascii 10)) (claimHeight uint))
  (let
    ((cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND)))
    (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_CITY_NOT_ACTIVATED)
    (claim-mining-reward-at-block cityName cityId tx-sender block-height claimHeight)
  )
)

;; DISABLED PUBLIC FUNCTIONS
;; from the original CityCoins Protocol v2
;; only used for backwards-compatibility
(define-public (register-user (memo (optional (string-utf8 50)))) ERR_FUNCTION_DISABLED)
(define-public (mine-tokens (amount uint) (memo (optional (buff 34)))) ERR_FUNCTION_DISABLED)
(define-public (mine-many (amounts (list 200 uint))) ERR_FUNCTION_DISABLED)
(define-public (claim-mining-reward (minerBlockHeight uint)) ERR_FUNCTION_DISABLED)
(define-public (stack-tokens (amountTokens uint) (lockPeriod uint)) ERR_FUNCTION_DISABLED)
(define-public (claim-stacking-reward (targetCycle uint)) ERR_FUNCTION_DISABLED)
(define-public (set-city-wallet (newCityWallet principal)) ERR_FUNCTION_DISABLED)
(define-public (update-coinbase-thresholds) ERR_FUNCTION_DISABLED)
(define-public (update-coinbase-amounts) ERR_FUNCTION_DISABLED)
(define-public (shutdown-contract (stacksHeight uint)) ERR_FUNCTION_DISABLED)

;; READ ONLY FUNCTIONS

(define-read-only (get-reward-delay)
  (var-get rewardDelay)
)

(define-read-only (get-mining-stats-at-block (cityId uint) (height uint))
  (default-to { miners: u0, amount: u0, claimed: false }
    (map-get? MiningStatsAtBlock { cityId: cityId, height: height })
  )
)

(define-read-only (has-mined-at-block (cityId uint) (height uint) (userId uint))
  (is-some (map-get? MinerAtBlock { cityId: cityId, height: height, userId: userId }))
)

(define-read-only (get-miner-at-block (cityId uint) (height uint) (userId uint))
  (default-to { commit: u0, low: u0, high: u0 }
    (map-get? MinerAtBlock { cityId: cityId, height: height, userId: userId })
  )
)

(define-read-only (get-high-value (cityId uint) (height uint))
  (default-to u0
    (map-get? HighValueAtBlock { cityId: cityId, height: height })
  )
)

(define-read-only (get-block-winner (cityId uint) (height uint))
  (map-get? WinnerAtBlock { cityId: cityId, height: height })
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
    (if (and (> userId u0) (>= winningValue (get low minerStats)) (<= winningValue (get high minerStats)))
      (some { winner: true, claimed: (get claimed blockStats) })
      (some { winner: false, claimed: (get claimed blockStats) })
    )
  )
)

(define-read-only (get-coinbase-amount (cityId uint) (blockHeight uint))
  (let
    (
      (coinbaseInfo (contract-call? .ccd005-city-data get-city-coinbase-info cityId))
      (thresholds (unwrap! (get thresholds coinbaseInfo) u0))
      (amounts (unwrap! (get amounts coinbaseInfo) u0))
      (details (unwrap! (get details coinbaseInfo) u0))
      (bonusPeriod (get coinbaseBonusPeriod details))
      (cityActivated (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) u0))
      (cityDetails (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) u0))
    )
    (asserts! (> blockHeight (get activated cityDetails))
      (if (<= (- blockHeight (get activated cityDetails)) bonusPeriod)
        (get coinbaseAmountBonus amounts)
        (get coinbaseAmount1 amounts)
      )
    )
    (asserts! (> blockHeight (get coinbaseThreshold2 thresholds)) (get coinbaseAmount2 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold3 thresholds)) (get coinbaseAmount3 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold4 thresholds)) (get coinbaseAmount4 amounts))
    (asserts! (> blockHeight (get coinbaseThreshold5 thresholds)) (get coinbaseAmount5 amounts))
    (get coinbaseAmountDefault amounts)
  )
)

;; PRIVATE FUNCTIONS

(define-private (mine-block (amount uint)
  (return (response
    { cityId: uint, userId: uint, height: uint, totalAmount: uint }
    uint
  )))
  (let
    (
      (okReturn (try! return))
      (cityId (get cityId okReturn))
      (userId (get userId okReturn))
      (height (get height okReturn))
    )
    (asserts! (> amount u0) ERR_INSUFFICIENT_COMMIT)
    (let
      (
        (blockStats (get-mining-stats-at-block cityId height))
        (vrfLowVal (get-high-value cityId height))
      )
      (map-set MiningStatsAtBlock
        { cityId: cityId, height: height }
        { miners: (+ (get miners blockStats) u1), amount: (+ (get amount blockStats) amount), claimed: false }
      )
      (asserts! (map-insert MinerAtBlock
        { cityId: cityId, height: height, userId: userId }
        {
          commit: amount,
          low: (if (> vrfLowVal u0) (+ vrfLowVal u1) u0),
          high: (+ vrfLowVal amount),
          winner: false
        }
      ) ERR_ALREADY_MINED)
      (map-set HighValueAtBlock
        { cityId: cityId, height: height }
        (+ vrfLowVal amount)
      )
    )
    (ok (merge okReturn
      { height: (+ height u1), totalAmount: (+ (get totalAmount okReturn) amount) }
    ))
  )
)

(define-private (claim-mining-reward-at-block (cityName (string-ascii 10)) (cityId uint) (user principal) (stacksHeight uint) (claimHeight uint))
  (let
    (
      (maturityHeight (+ (get-reward-delay) claimHeight))
      (isMature (asserts! (> stacksHeight maturityHeight) ERR_REWARD_NOT_MATURE))
      (userId (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_USER_ID_NOT_FOUND))
      (blockStats (get-mining-stats-at-block cityId claimHeight))
      (minerStats (get-miner-at-block cityId claimHeight userId))
      (vrfSample (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2 get-save-rnd maturityHeight) ERR_VRF_SEED_NOT_FOUND))
      (commitTotal (get-high-value cityId claimHeight))
      (commitValid (asserts! (> commitTotal u0) ERR_MINER_DATA_NOT_FOUND))
      (winningValue (mod vrfSample commitTotal))
    )
    (asserts! (has-mined-at-block cityId claimHeight userId) ERR_DID_NOT_MINE)
    (asserts! (and (> (get miners blockStats) u0) (> (get commit minerStats) u0)) ERR_MINER_DATA_NOT_FOUND)
    (asserts! (not (get claimed blockStats)) ERR_ALREADY_CLAIMED)
    (asserts! (and (>= winningValue (get low minerStats)) (<= winningValue (get high minerStats))) ERR_MINER_NOT_WINNER)
    (map-set MiningStatsAtBlock
      { cityId: cityId, height: claimHeight }
      (merge blockStats { claimed: true })
    )
    (map-set MinerAtBlock
      { cityId: cityId, height: claimHeight, userId: userId }
      (merge minerStats { winner: true })
    )
    (map-set WinnerAtBlock
      { cityId: cityId, height: claimHeight }
      userId
    )
    (print {
      action: "mining-claim",
      userId: userId,
      cityName: cityName,
      cityId: cityId,
      claimHeight: claimHeight
    })
    (mint-coinbase cityName cityId user claimHeight)
  )
)

(define-private (mint-coinbase (cityName (string-ascii 10)) (cityId uint) (recipient principal) (blockHeight uint))
  (let
    ((amount (get-coinbase-amount cityId blockHeight)))
    (asserts! (> amount u0) ERR_NOTHING_TO_MINT)
    ;; contract addresses hardcoded for this version
    (and (is-eq cityName "mia") (try! (as-contract (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 mint amount recipient))))
    (and (is-eq cityName "nyc") (try! (as-contract (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 mint amount recipient))))
    (ok true)
  )
)
