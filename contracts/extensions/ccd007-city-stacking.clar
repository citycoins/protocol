;; Title: CCD007 City Stacking
;; Version: 1.0.0
;; Summary: A central city stacking contract for the CityCoins protocol.
;; Description: An extension that provides a stacking interface per city, in which a user can lock their CityCoins for a specified number of cycles, in return for a proportion of the stacking rewards accrued by the related city wallet.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u7000))
(define-constant ERR_INVALID_CYCLE_LENGTH (err u7001))
(define-constant ERR_INVALID_STACKING_PARAMS (err u7002))
(define-constant ERR_STACKING_NOT_AVAILABLE (err u7003))
(define-constant ERR_REWARD_CYCLE_NOT_COMPLETE (err u7004))
(define-constant ERR_NOTHING_TO_CLAIM (err u7005))
(define-constant ERR_INVALID_STACKING_PAYOUT (err u7006))
(define-constant ERR_USER_ID_NOT_FOUND (err u7007))
(define-constant ERR_CITY_ID_NOT_FOUND (err u7008))
(define-constant ERR_CITY_NOT_ACTIVATED (err u7009))
(define-constant ERR_CITY_TREASURY_NOT_FOUND (err u7010))
(define-constant SCALE_FACTOR (pow u10 u16))
(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

;; DATA VARS

(define-data-var rewardCycleLength uint u2100)
(define-data-var poolOperator principal 'SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M)

;; DATA MAPS

(define-map StackingStatsAtCycle
  { cityId: uint, cycle: uint }
  { total: uint, reward: (optional uint) }
)

(define-map StackerAtCycle
  { cityId: uint, cycle: uint, userId: uint }
  { stacked: uint, claimable: uint }
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

(define-public (set-reward-cycle-length (length uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (> length u0) ERR_INVALID_CYCLE_LENGTH)
    (ok (var-set rewardCycleLength length))
  )
)

(define-public (stack (cityName (string-ascii 10)) (amount uint) (lockPeriod uint))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND))
      (user tx-sender)
      (userId (try! (as-contract (contract-call? .ccd003-user-registry get-or-create-user-id user))))
      (cityTreasury (unwrap! (contract-call? .ccd005-city-data get-city-treasury-by-name cityId "stacking") ERR_CITY_TREASURY_NOT_FOUND))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (targetCycle (+ u1 currentCycle))
      (stackingInfo { cityId: cityId, userId: userId, amount: amount, first: targetCycle, last: (+ targetCycle lockPeriod)})
    )
    (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_CITY_NOT_ACTIVATED)
    (asserts! (and (> amount u0) (> lockPeriod u0) (<= lockPeriod MAX_REWARD_CYCLES)) ERR_INVALID_STACKING_PARAMS)
    (try! (fold stack-tokens-closure REWARD_CYCLE_INDEXES (ok stackingInfo)))
    ;; contract addresses hardcoded for this version
    (and (is-eq cityName "mia") (try! (contract-call? .ccd002-treasury-mia-stacking deposit-ft 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 amount)))
    (and (is-eq cityName "nyc") (try! (contract-call? .ccd002-treasury-nyc-stacking deposit-ft 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 amount)))
    (print {
      event: "stacking",
      amountStacked: amount,
      cityId: cityId,
      cityName: cityName,
      cityTreasury: cityTreasury,
      currentCycle: currentCycle,
      firstCycle: targetCycle,
      lastCycle: (- (+ targetCycle lockPeriod) u1),
      lockPeriod: lockPeriod,
      userId: userId
    })
    (ok true)
  )
)

(define-public (set-pool-operator (operator principal))
  (begin
    (try! (is-dao-or-extension))
    (ok (var-set poolOperator operator))
  )
)

(define-public (send-stacking-reward (cityName (string-ascii 10)) (targetCycle uint) (amount uint))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND))
      (cityTreasury (unwrap! (contract-call? .ccd005-city-data get-city-treasury-by-name cityId "stacking") ERR_CITY_TREASURY_NOT_FOUND))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (stackingStatsAtCycle (get-stacking-stats-at-cycle cityId targetCycle))
    )
    (asserts! (is-eq tx-sender (var-get poolOperator)) ERR_UNAUTHORIZED)
    (asserts! (> amount u0) ERR_INVALID_STACKING_PAYOUT)
    (asserts! (< targetCycle currentCycle) ERR_REWARD_CYCLE_NOT_COMPLETE)
    ;; contract addresses hardcoded for this version
    (and (is-eq cityName "mia") (try! (contract-call? .ccd002-treasury-mia-stacking deposit-stx amount)))
    (and (is-eq cityName "nyc") (try! (contract-call? .ccd002-treasury-nyc-stacking deposit-stx amount)))
    (print {
      event: "stacking-reward-payout",
      amount: amount,
      cityId: cityId,
      cityName: cityName,
      cityTreasury: cityTreasury,
      currentCycle: currentCycle,
      targetCycle: targetCycle,
    })
    (ok (map-set StackingStatsAtCycle
      { cityId: cityId, cycle: targetCycle }
      (merge stackingStatsAtCycle { reward: (some amount) })
    ))
  )
)

(define-public (claim-stacking-reward (cityName (string-ascii 10)) (targetCycle uint))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_CITY_ID_NOT_FOUND))
      (user tx-sender)
      (userId (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_USER_ID_NOT_FOUND))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (stackerAtCycle (get-stacker-at-cycle cityId targetCycle userId))
      (reward (unwrap! (get-stacking-reward cityId userId targetCycle) ERR_NOTHING_TO_CLAIM))
      (claimable (get claimable stackerAtCycle))
    )
    (asserts! (> currentCycle targetCycle) ERR_REWARD_CYCLE_NOT_COMPLETE)
    (asserts! (or (> reward u0) (> claimable u0)) ERR_NOTHING_TO_CLAIM)
    ;; contract addresses hardcoded for this version
    (and (is-eq cityName "mia")
      (begin
        (and (> reward u0) (try! (as-contract (contract-call? .ccd002-treasury-mia-stacking withdraw-stx reward user))))
        (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-mia-stacking withdraw-ft 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 claimable user))))
      )
    )
    (and (is-eq cityName "nyc")
      (begin
        (and (> reward u0) (try! (as-contract (contract-call? .ccd002-treasury-nyc-stacking withdraw-stx reward user))))
        (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-nyc-stacking withdraw-ft 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 claimable user))))
      )
    )
    (print {
      event: "stacking-claim",
      cityId: cityId,
      cityName: cityName,
      claimable: claimable,
      reward: reward,
      targetCycle: targetCycle,
      userId: userId
    })
    (ok (map-set StackerAtCycle
      { cityId: cityId, cycle: targetCycle, userId: userId }
      { stacked: u0, claimable: u0 }
    ))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-reward-cycle-length)
  (var-get rewardCycleLength)
)

(define-read-only (get-stacking-stats-at-cycle (cityId uint) (cycle uint))
  (default-to { total: u0, reward: none }
    (map-get? StackingStatsAtCycle { cityId: cityId, cycle: cycle })
  )
)

(define-read-only (get-stacker-at-cycle (cityId uint) (cycle uint) (userId uint))
  (default-to { stacked: u0, claimable: u0 }
    (map-get? StackerAtCycle { cityId: cityId, cycle: cycle, userId: userId })
  )
)

(define-read-only (get-reward-cycle (cityId uint) (blockHeight uint))
  (let
    (
      (activationDetails (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) none))
      (activationBlock (get activated activationDetails))
    )
    (if (>= blockHeight activationBlock)
      (some (/ (- blockHeight activationBlock) (get-reward-cycle-length)))
      none)
  )
)

(define-read-only (get-first-block-in-reward-cycle (cityId uint) (cycle uint))
  (let
    ((activationDetails (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) none)))
    (some (+ (get activated activationDetails) (* cycle (get-reward-cycle-length))))
  )
)

(define-read-only (is-stacking-active (cityId uint) (cycle uint))
  (is-some (map-get? StackingStatsAtCycle { cityId: cityId, cycle: cycle }))
)

(define-read-only (is-cycle-paid (cityId uint) (cycle uint))
  (let
    ((rewardCycleStats (get-stacking-stats-at-cycle cityId cycle)))
    (is-some (get reward rewardCycleStats))
  )
)

(define-read-only (get-stacking-reward (cityId uint) (userId uint) (cycle uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle cityId cycle))
      (stackerAtCycle (get-stacker-at-cycle cityId cycle userId))
      (userStacked (get stacked stackerAtCycle))
    )
    (if (or (<= (unwrap! (get-reward-cycle cityId block-height) none) cycle) (is-eq userStacked u0))
      none
      (some (/ (* (unwrap! (get reward rewardCycleStats) none) userStacked) (get total rewardCycleStats)))
    )
  )
)

(define-read-only (get-pool-operator)
  (some (var-get poolOperator))
)

;; PRIVATE FUNCTIONS

(define-private (stack-tokens-closure (rewardCycleIdx uint)
  (return (response 
    { cityId: uint, userId: uint, amount: uint, first: uint, last: uint }
    uint
  )))
  (let
    (
      (okReturn (try! return))
      (targetCycle (+ (get first okReturn) rewardCycleIdx))
      (cityId (get cityId okReturn))
      (userId (get userId okReturn))
      (amountStacked (get amount okReturn))
      (lastCycle (get last okReturn))
      (rewardCycleStats (get-stacking-stats-at-cycle cityId targetCycle))
      (stackerAtCycle (get-stacker-at-cycle cityId targetCycle userId))
    )
    (and (>= targetCycle (get first okReturn)) (< targetCycle lastCycle)
      (map-set StackingStatsAtCycle
        { cityId: cityId, cycle: targetCycle }
        (merge rewardCycleStats { total: (+ amountStacked (get total rewardCycleStats)) })
      )
      (map-set StackerAtCycle
        { cityId: cityId, cycle: targetCycle, userId: userId }
        (merge stackerAtCycle {
          stacked: (+ amountStacked (get stacked stackerAtCycle)),
          claimable: (if (is-eq targetCycle (- lastCycle u1))
            (+ amountStacked (get claimable stackerAtCycle))
            (get claimable stackerAtCycle)
        )})
      )
    )
    return
  )
)
