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
(define-constant ERR_UNAUTHORIZED (err u3600))
(define-constant ERR_INVALID_PARAMS (err u3601))

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
    (asserts! (> length u0) ERR_INVALID_PARAMS)
    (ok (var-set rewardCycleLength length))
  )
)

(define-public (stack (cityName (string-ascii 32)) (amount uint) (lockPeriod uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
      (userId (try! (contract-call? .ccd003-user-registry get-or-create-user-id tx-sender)))
    )
    (asserts! (and 
      (> amount u0)
      (> lockPeriod u0)
      (<= lockPeriod MAX_REWARD_CYCLES)
    ) ERR_INVALID_PARAMS)
    (try! (stack-at-cycle cityId userId amount lockPeriod))
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

(define-private (stack-at-cycle (cityId uint) (userId uint) (amount uint) (lockPeriod uint))
  (let
    (
      (currentCycle (unwrap! (get-reward-cycle cityId block-height) ERR_INVALID_PARAMS))
    )  
    (ok true)
  )
)

;; a user ID from ccd003-user-registry
;; returns (ok uint) or ERR_INVALID_PARAMS if not found
(define-private (get-user-id (user principal))
  (ok (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_INVALID_PARAMS))
)

;; city ID from ccd004-city-registry
;; returns (ok uint) or ERR_INVALID_PARAMS if not found
(define-private (get-city-id (cityName (string-ascii 32)))
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_INVALID_PARAMS))
)

;; city activation status from ccd005-city-data
;; returns (ok true) or ERR_INVALID_PARAMS if not found
(define-private (is-city-activated (cityId uint))
  (ok (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_INVALID_PARAMS))
)

;; city activation details from ccd005-city-data
;; returns (ok tuple) or ERR_INVALID_PARAMS if not found
(define-private (get-city-activation-details (cityId uint))
  (ok (unwrap! (contract-call? .ccd005-city-data get-city-activation-details cityId) ERR_INVALID_PARAMS))
)

;; city treasury details from ccd005-city-data
;; returns (ok principal) or ERR_INVALID_PARAMS if not found
(define-private (get-city-treasury-by-name (cityId uint) (treasuryName (string-ascii 32)))
  (let
    (
      (treasuryId (unwrap! (contract-call? .ccd005-city-data get-city-treasury-id cityId treasuryName) ERR_INVALID_PARAMS))
    )
    (ok (unwrap! (contract-call? .ccd005-city-data get-city-treasury-address cityId treasuryId) ERR_INVALID_PARAMS))
  )
)
