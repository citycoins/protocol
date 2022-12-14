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
(define-constant ERR_USER_ID_NOT_FOUND (err u7004))
(define-constant ERR_CITY_ID_NOT_FOUND (err u7005))
(define-constant ERR_CITY_NOT_ACTIVATED (err u7006))
(define-constant ERR_CITY_DETAILS_NOT_FOUND (err u7007))
(define-constant ERR_CITY_TREASURY_NOT_FOUND (err u7008))

;; stacking configuration
(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

;; DATA VARS

;; reward cycle length in Stacks blocks
(define-data-var rewardCycleLength uint u2100)

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
      (cityActivated (try! (is-city-activated cityId)))
      (userId (try! (as-contract
        (contract-call? .ccd003-user-registry get-or-create-user-id tx-sender)
      )))
    )
    (asserts! cityActivated ERR_CITY_NOT_ACTIVATED)
    (asserts! (and 
      (> amount u0)
      (> lockPeriod u0)
      (<= lockPeriod MAX_REWARD_CYCLES)
    ) ERR_INVALID_STACKING_PARAMS)
    (try! (stack-at-cycle cityName cityId tx-sender userId amount lockPeriod block-height))
    (ok true)
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
      (activationBlock (get activated activationDetails))
    )
    (some (+ activationBlock (* cycle (get-reward-cycle-length))))
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

;; TODO: get-stacking-reward

;; PRIVATE FUNCTIONS

(define-private (stack-at-cycle (cityName (string-ascii 32)) (cityId uint) (user principal) (userId uint) (amount uint) (lockPeriod uint) (startHeight uint))
  (let
    (
      (cityTreasury (try! (get-city-treasury-by-name cityId "stacking")))
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_STACKING_NOT_AVAILABLE))
      (targetCycle (+ u1 currentCycle))
      (commitment {
        cityId: cityId,
        userId: userId,
        amount: amount,
        first: targetCycle,
        last: (+ targetCycle lockPeriod)
      })
    )
    ;; transfer to stacking treasury
    ;; temporarily hardcoded to cities until Stacks 2.1
    ;; next version can use traits as stored principals
    (and
      (is-eq cityName "mia")
      ;; TODO: update to .ccd002-treasury-mia-stacking
      (is-ok (contract-call? .ccd002-treasury-mia deposit-ft 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 amount))
    )
    (and
      (is-eq cityName "nyc")
      ;; TODO: update to .ccd002-treasury-nyc-stacking
      (is-ok (contract-call? .ccd002-treasury-nyc deposit-ft 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 amount))
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
      lastCycle: (- (+ targetCycle lockPeriod) u1)
    })
    ;; fold over closure
    (match (fold stack-tokens-closure REWARD_CYCLE_INDEXES (ok commitment))
      okReturn (ok true)
      errReturn (err errReturn)
    )
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

  (match return
    okReturn
    (let
      (
        (cityId (get cityId okReturn))
        (userId (get userId okReturn))
        (amount (get amount okReturn))
        (firstCycle (get first okReturn))
        (lastCycle (get last okReturn))
        (targetCycle (+ firstCycle rewardCycleIdx))
      )
      (and
        (>= targetCycle firstCycle)
        (< targetCycle lastCycle)
        (if (is-eq targetCycle (- lastCycle u1))
          (set-stacking-data cityId userId targetCycle amount amount)
          (set-stacking-data cityId userId targetCycle amount u0)
        )
      )
      return
    )
    errReturn return
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
  (ok (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_CITY_NOT_ACTIVATED))
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
