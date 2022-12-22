;; Title: CCD007 City Stacking
;; Version: 1.0.0
;; Synopsis:
;; A central city stacking contract for the CityCoins protocol.
;; Description:
;; An extension that provides a stacking interface per city, in which
;; a user can lock their CityCoins for a specified number of cycles,
;; in return for a proportion of the stacking rewards accrued by the
;; related city wallet.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u7000))
(define-constant ERR_INVALID_CYCLE_LENGTH (err u7001))
(define-constant ERR_INVALID_STACKING_PARAMS (err u7002))
(define-constant ERR_STACKING_NOT_AVAILABLE (err u7003))
(define-constant ERR_REWARD_CYCLE_NOT_COMPLETE (err u7004))
(define-constant ERR_NOTHING_TO_CLAIM (err u7005))
(define-constant ERR_TRANSFER_FAILED (err u7006))
(define-constant ERR_INVALID_STACKING_PAYOUT (err u7007))
(define-constant ERR_STACKING_PAYOUT_NOT_COMPLETE (err u7008))
(define-constant ERR_USER_ID_NOT_FOUND (err u7009))
(define-constant ERR_CITY_ID_NOT_FOUND (err u7010))
(define-constant ERR_CITY_NOT_ACTIVATED (err u7011))
(define-constant ERR_CITY_DETAILS_NOT_FOUND (err u7012))
(define-constant ERR_CITY_TREASURY_NOT_FOUND (err u7013))

;; stacking configuration
(define-constant SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places
(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

;; DATA VARS

;; reward cycle length in Stacks blocks
(define-data-var rewardCycleLength uint u2100)

;; stacking pool operator
(define-data-var poolOperator principal 'SPFP0018FJFD82X3KCKZRGJQZWRCV9793QTGE87M)

;; DATA MAPS

;; For a given city and reward cycle
;; - how many CityCoins are stacked?
;; - how many STX rewards were received?
(define-map StackingStatsAtCycle
  {
    cityId: uint,
    cycle: uint
  }
  {
    total: uint,
    reward: (optional uint)
  }
)

;; For a given city, reward cycle, and user
;; - how many CityCoins are stacked?
;; - can unlocked CityCoins be claimed?
(define-map StackerAtCycle
  {
    cityId: uint,
    cycle: uint,
    userId: uint
  }
  {
    stacked: uint,
    claimable: uint
  }
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

;; guarded: set the reward cycle length in Stacks blocks
(define-public (set-reward-cycle-length (length uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (> length u0) ERR_INVALID_CYCLE_LENGTH)
    (ok (var-set rewardCycleLength length))
  )
)

(define-public (stack (cityName (string-ascii 32)) (amount uint) (lockPeriod uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (user tx-sender)
      (userId (try! (as-contract
        (contract-call? .ccd003-user-registry get-or-create-user-id user)
      )))
    )
    (asserts! (is-city-activated cityId) ERR_CITY_NOT_ACTIVATED)
    (asserts! (and 
      (> amount u0)
      (> lockPeriod u0)
      (<= lockPeriod MAX_REWARD_CYCLES)
    ) ERR_INVALID_STACKING_PARAMS)
    (stack-at-cycle cityName cityId tx-sender userId amount lockPeriod block-height)
  )
)

(define-public (set-pool-operator (operator principal))
  (begin
    (try! (is-dao-or-extension))
    (ok (var-set poolOperator operator))
  )
)

;; used by the pool operator to pay out rewards for the protocol
(define-public (send-stacking-reward (cityName (string-ascii 32)) (targetCycle uint) (amount uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityTreasury (try! (get-city-treasury-by-name cityId "stacking")))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (stackingStatsAtCycle (get-stacking-stats-at-cycle cityId targetCycle))
    )
    ;; TODO: use contract-caller here?
    (asserts! (is-eq tx-sender (var-get poolOperator)) ERR_UNAUTHORIZED)
    (asserts! (> amount u0) ERR_INVALID_STACKING_PAYOUT)
    (asserts! (< targetCycle currentCycle) ERR_REWARD_CYCLE_NOT_COMPLETE)
    ;; transfer to stacking treasury
    ;; temporarily hardcoded to cities until Stacks 2.1
    ;; next version can use traits as stored principals
    (and
      (is-eq cityName "mia")
      ;; TODO: add check against treasury value?
      (asserts! (is-ok (contract-call? .ccd002-treasury-mia-stacking deposit-stx amount)) ERR_TRANSFER_FAILED)
    )
    (and
      (is-eq cityName "nyc")
      ;; TODO: add check against treasury value?
      (asserts! (is-ok (contract-call? .ccd002-treasury-nyc-stacking deposit-stx amount)) ERR_TRANSFER_FAILED)
    )
    ;; print details
    (print {
      action: "stacking-reward-payout",
      cityName: cityName,
      cityId: cityId,
      cityTreasury: cityTreasury,
      currentCycle: currentCycle,
      targetCycle: targetCycle,
      amount: amount,
    })
    ;; update stacking stats
    ;; TODO: does this need to add the original value?
    (ok (map-set StackingStatsAtCycle
      { cityId: cityId, cycle: targetCycle }
      (merge stackingStatsAtCycle { reward: (some amount) })
    ))
  )
)

(define-public (claim-stacking-reward (cityName (string-ascii 32)) (targetCycle uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (user tx-sender)
      (userId (try! (get-user-id tx-sender)))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (stackerAtCycle (get-stacker-at-cycle cityId targetCycle userId))
      (reward (unwrap! (get-stacking-reward cityId userId targetCycle) ERR_NOTHING_TO_CLAIM))
      (claimable (get claimable stackerAtCycle))
    )
    (asserts! (> currentCycle targetCycle) ERR_REWARD_CYCLE_NOT_COMPLETE)
    (asserts! (or (> reward u0) (> claimable u0)) ERR_NOTHING_TO_CLAIM)
    ;; send back CityCoins if user was eligible
    ;; temporarily hardcoded to cities until Stacks 2.1
    ;; next version can use traits as stored principals
    (and (is-eq cityName "mia")
      ;; TODO: add check against treasury value?
      (begin
        (and
          (> reward u0)
          (asserts! (is-ok (as-contract
            (contract-call? .ccd002-treasury-mia-stacking withdraw-stx reward user)
          )) ERR_TRANSFER_FAILED)
        )
        (and
          (> claimable u0)
          (asserts! (is-ok (as-contract
            (contract-call? .ccd002-treasury-mia-stacking withdraw-ft .test-ccext-governance-token-mia claimable user)
          )) ERR_TRANSFER_FAILED)
        )
        true
      )
    )
    (and (is-eq cityName "nyc")
      ;; TODO: add check against treasury value?
      (begin
        (and
          (> reward u0)
          (asserts! (is-ok (as-contract
            (contract-call? .ccd002-treasury-nyc-stacking withdraw-stx reward user)
          )) ERR_TRANSFER_FAILED)
        )
        (and
          (> claimable u0)
          (asserts! (is-ok (as-contract
            (contract-call? .ccd002-treasury-nyc-stacking withdraw-ft .test-ccext-governance-token-mia claimable user)
          )) ERR_TRANSFER_FAILED)
        )
        true
      )
    )
    ;; disable ability to claim again
    (ok (map-set StackerAtCycle {
      cityId: cityId,
      cycle: targetCycle,
      userId: userId
    } {
      stacked: u0,
      claimable: u0
    }))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-reward-cycle-length)
  (var-get rewardCycleLength)
)

(define-read-only (get-stacking-stats-at-cycle (cityId uint) (cycle uint))
  (default-to {
    total: u0,
    reward: none
    }
    (map-get? StackingStatsAtCycle {
      cityId: cityId,
      cycle: cycle
    })
  )
)

(define-read-only (get-stacker-at-cycle (cityId uint) (cycle uint) (userId uint))
  (default-to {
    stacked: u0,
    claimable: u0
    }
    (map-get? StackerAtCycle {
      cityId: cityId,
      cycle: cycle,
      userId: userId
    })
  )
)

(define-read-only (get-reward-cycle (cityId uint) (blockHeight uint))
  (let
    (
      (activationDetails (unwrap! (get-city-activation-details cityId) none))
      (activationBlock (get activated activationDetails))
    )
    (if (>= blockHeight activationBlock)
      (some (/ (- blockHeight activationBlock) (get-reward-cycle-length)))
      none)
  )
)

(define-read-only (get-first-block-in-reward-cycle (cityId uint) (cycle uint))
  (let
    (
      (activationDetails (unwrap! (get-city-activation-details cityId) none))
    )
    (some (+ (get activated activationDetails) (* cycle (get-reward-cycle-length))))
  )
)

(define-read-only (is-stacking-active (cityId uint) (cycle uint))
  (is-some
    (map-get? StackingStatsAtCycle {
      cityId: cityId,
      cycle: cycle
    })
  )
)

(define-read-only (is-cycle-paid (cityId uint) (cycle uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle cityId cycle))
    )
    (is-some (get reward rewardCycleStats))
  )
)

(define-read-only (get-stacking-reward (cityId uint) (userId uint) (cycle uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle cityId cycle))
      (stackerAtCycle (get-stacker-at-cycle cityId cycle userId))
      (cycleReward (unwrap! (get reward rewardCycleStats) none))
      (userStacked (get stacked stackerAtCycle))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) none))
    )
    ;; (asserts! (is-some cycleReward) ERR_STACKING_PAYOUT_NOT_COMPLETE)
    (if (or (<= currentCycle cycle) (is-eq userStacked u0))
      ;; this cycle hasn't finished
      ;; or stacker is not stacking
      none
      ;; calculate reward
      (some (/ (* cycleReward userStacked) (get total rewardCycleStats)))
    )
  )
)

(define-read-only (get-pool-operator)
  (some (var-get poolOperator))
)

;; PRIVATE FUNCTIONS

(define-private (stack-at-cycle (cityName (string-ascii 32)) (cityId uint) (user principal) (userId uint) (amount uint) (lockPeriod uint) (startHeight uint))
  (let
    (
      (cityTreasury (try! (get-city-treasury-by-name cityId "stacking")))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (targetCycle (+ u1 currentCycle))
      (stackingInfo {
        cityId: cityId,
        userId: userId,
        amount: amount,
        first: targetCycle,
        ;; TODO: should this be minus 1?
        last: (+ targetCycle lockPeriod)
      })
    )
    ;; transfer to stacking treasury
    ;; temporarily hardcoded to cities until Stacks 2.1
    ;; next version can use traits as stored principals
    (and
      (is-eq cityName "mia")
      ;; TODO: add check against treasury value?
      (asserts! (is-ok
        (contract-call? .ccd002-treasury-mia-stacking deposit-ft .test-ccext-governance-token-mia amount))
      ERR_TRANSFER_FAILED)
    )
    (and
      (is-eq cityName "nyc")
      ;; TODO: add check against treasury value?
      (asserts! (is-ok
        (contract-call? .ccd002-treasury-nyc-stacking deposit-ft .test-ccext-governance-token-nyc amount))
      ERR_TRANSFER_FAILED)
    )
    ;; print details
    (print {
      action: "stacking",
      userId: userId,
      cityName: cityName,
      cityId: cityId,
      cityTreasury: cityTreasury,
      amountStacked: amount,
      lockPeriod: lockPeriod,
      currentCycle: currentCycle,
      firstCycle: targetCycle,
      ;; TODO: should this be minus 1?
      lastCycle: (- (+ targetCycle lockPeriod) u1)
    })
    ;; fold over closure
    (try! (fold stack-tokens-closure REWARD_CYCLE_INDEXES (ok stackingInfo)))
    (ok true)
  )
)

(define-private (stack-tokens-closure (rewardCycleIdx uint)
  (return (response 
    {
      cityId: uint,
      userId: uint,
      amount: uint,
      first: uint,
      last: uint
    }
    uint
  )))
  (let
    (
      (okReturn (try! return))
      (targetCycle (+ (get first okReturn) rewardCycleIdx))
    )
    (and
      (>= targetCycle (get first okReturn))
      (< targetCycle (get last okReturn))
      (if (is-eq targetCycle (- (get last okReturn) u1))
        (set-stacking-data (get cityId okReturn) (get userId okReturn) targetCycle (get amount okReturn) (get amount okReturn))
        (set-stacking-data (get cityId okReturn) (get userId okReturn) targetCycle (get amount okReturn) u0)
      )
    )
    return
  )
)

(define-private (set-stacking-data (cityId uint) (userId uint) (targetCycle uint) (amountStacked uint) (toReturn uint))
  (let
    (
      (rewardCycleStats (get-stacking-stats-at-cycle cityId targetCycle))
      (stackerAtCycle (get-stacker-at-cycle cityId targetCycle userId))
    )
    (map-set StackingStatsAtCycle
      { cityId: cityId, cycle: targetCycle }
      (merge rewardCycleStats {
        total: (+ amountStacked (get total rewardCycleStats)),
      })
    )
    (map-set StackerAtCycle
      { cityId: cityId, cycle: targetCycle, userId: userId }
      (merge stackerAtCycle {
        stacked: (+ amountStacked (get stacked stackerAtCycle)),
        claimable: (+ toReturn (get claimable stackerAtCycle))
      })
    )
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

;; get city activation status from .ccd005-city-data
;; returns (ok true) or ERR_CITY_NOT_ACTIVATED if not found
(define-private (is-city-activated (cityId uint))
  ;; #[filter(cityId)]
  (contract-call? .ccd005-city-data is-city-activated cityId)
)

;; get city activation details from ccd005-city-data
;; returns (ok tuple) or ERR_CITY_DETAILS_NOT_FOUND if not found
(define-private (get-city-activation-details (cityId uint))
    ;; #[filter(cityId)]
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) ERR_CITY_DETAILS_NOT_FOUND))
)

;; city treasury details from ccd005-city-data
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
