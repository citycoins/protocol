;; Stacking

;; TODO: TRAITS

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u3600))
(define-constant ERR_INVALID_PARAMS (err u3601))

;; AUTHORIZATION CHECK

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; STACKING CONFIGURATION

(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_INDEXES (list u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31))

;; Stacks blocks per reward cycle
(define-data-var rewardCycleLength uint u2100)

(define-read-only (get-reward-cycle-length)
  (var-get rewardCycleLength)
)

(define-public (set-reward-cycle-length (length uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (> length u0) ERR_INVALID_PARAMS)
    (ok (var-set rewardCycleLength length))
  )
)

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

;; TODO: get-reward-cycle needs an activation block

;; TODO: get-first-block-in-reward-cycle needs an activation block

;; TODO: verify this would still be accurate
(define-read-only (is-stacking-active (cityId uint) (cycle uint))
  (is-some
    (map-get? StackingStatsAtCycle {
      cityId: cityId,
      cycle: cycle
    })
  )
)

;; TODO: get-stacking-reward

;; STACKING ACTIONS

(define-public (stack (cityName (string-ascii 32)) (amount uint) (lockPeriod uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
    )
    (asserts! (and 
      (> amount u0)
      (> lockPeriod u0)
      (<= lockPeriod MAX_REWARD_CYCLES)
    ) ERR_INVALID_PARAMS)
    ;; TODO: transfer tokens to contract
    ;; TODO: set-tokens-stacked
    (ok true)
  )
)

;; PRIVATE GETTERS

;; city ID from ccd004-city-registry
;; returns (ok uint) or ERR_INVALID_PARAMS if not found
(define-private (get-city-id (cityName (string-ascii 32)))
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_INVALID_PARAMS))
)

;; city activation status from ccd004-city-registry
;; returns (ok true) or ERR_INVALID_PARAMS if not found
(define-private (is-city-activated (cityId uint))
  (ok (asserts! (contract-call? .ccd004-city-registry is-city-activated cityId) ERR_INVALID_PARAMS))
)

;; city activation details from ccd004-city-registry
;; returns (ok tuple) or ERR_INVALID_PARAMS if not found
(define-private (get-city-activation-details (cityId uint))
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-activation-details cityId) ERR_INVALID_PARAMS))
)

;; city treasury details from ccd004-city-registry
;; returns (ok principal) or ERR_INVALID_PARAMS if not found
(define-private (get-city-treasury (cityId uint) (treasuryName (string-ascii 32)))
  (ok (unwrap! (contract-call? .ccd004-city-registry get-city-treasury cityId treasuryName) ERR_INVALID_PARAMS))
)

;; a user ID from ccd003-user-registry
;; returns (ok uint) or ERR_INVALID_PARAMS if not found
(define-private (get-user-id (user principal))
  (ok (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_INVALID_PARAMS))
)

;; OTHER

;; stacking stats per cycle, per city
;; stacking stats per user, per cycle, per city
;; stacking total value locked per city

;; TODO: evaluate printing in all contracts
;; TODO: evaluate errors in all contracts (simplify?)
;; THINK THROUGH THE LENS OF DOCUMENTATION AS WELL