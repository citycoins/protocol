;; Title: CCD007 City Stacking
;; Version: 1.0.0
;; Summary: A central city stacking contract for the CityCoins protocol.
;; Description: An extension that provides a stacking interface per city, in which a user can lock their CityCoins for a specified number of cycles, in return for a proportion of the stacking rewards accrued by the related city wallet.

;; TRAITS

(impl-trait .extension-trait.extension-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u7000))
(define-constant ERR_INVALID_CITY (err u7001))
(define-constant ERR_INVALID_PARAMS (err u7002))
(define-constant ERR_INACTIVE_CITY (err u7003))
(define-constant ERR_INVALID_USER (err u7004))
(define-constant ERR_INVALID_TREASURY (err u7005))
(define-constant ERR_INCOMPLETE_CYCLE (err u7006))
(define-constant ERR_NOTHING_TO_CLAIM (err u7007))
(define-constant ERR_PAYOUT_COMPLETE (err u7008))
(define-constant MAX_REWARD_CYCLES u32)
(define-constant REWARD_CYCLE_LENGTH u2100)
;; MAINNET: (define-constant FIRST_STACKING_BLOCK u666050)
;; TESTNET: (define-constant FIRST_STACKING_BLOCK u2000000)
(define-constant FIRST_STACKING_BLOCK u50)

;; DATA MAPS

(define-map StackingStats
  { cityId: uint, cycle: uint }
  { total: uint, reward: (optional uint) }
)

(define-map Stacker
  { cityId: uint, cycle: uint, userId: uint }
  { stacked: uint, claimable: uint }
)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (is-extension)
  (ok (asserts! (contract-call? .base-dao is-extension contract-caller) ERR_UNAUTHORIZED))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

(define-public (stack (cityName (string-ascii 10)) (amount uint) (lockPeriod uint))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_INVALID_CITY))
      (user tx-sender)
      (userId (try! (as-contract (contract-call? .ccd003-user-registry get-or-create-user-id user))))
      (cityTreasury (unwrap! (contract-call? .ccd005-city-data get-treasury-by-name cityId "stacking") ERR_INVALID_TREASURY))
      (targetCycle (+ u1 (get-reward-cycle burn-block-height)))
    )
    (asserts! (contract-call? .ccd005-city-data is-city-activated cityId) ERR_INACTIVE_CITY)
    (asserts! (and (> amount u0) (> lockPeriod u0) (<= lockPeriod MAX_REWARD_CYCLES)) ERR_INVALID_PARAMS)
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) targetCycle)
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u1))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u2))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u3))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u4))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u5))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u6))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u7))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u8))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u9))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u10))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u11))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u12))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u13))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u14))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u15))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u16))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u17))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u18))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u19))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u20))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u21))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u22))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u23))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u24))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u25))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u26))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u27))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u28))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u29))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u30))
    (stack-at-cycle cityId userId amount targetCycle (+ targetCycle lockPeriod) (+ targetCycle u31))
    ;; contract addresses hardcoded for this version
    ;; MAINNET: (and (is-eq cityName "mia") (try! (contract-call? .ccd002-treasury-mia-stacking deposit-ft 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 amount)))
    (and (is-eq cityName "mia") (try! (contract-call? .ccd002-treasury-mia-stacking deposit-ft .test-ccext-governance-token-mia amount)))
    ;; MAINNET: (and (is-eq cityName "nyc") (try! (contract-call? .ccd002-treasury-nyc-stacking deposit-ft 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 amount)))
    (and (is-eq cityName "nyc") (try! (contract-call? .ccd002-treasury-nyc-stacking deposit-ft .test-ccext-governance-token-nyc amount)))
    (print {
      event: "stacking",
      amountStacked: amount,
      cityId: cityId,
      cityName: cityName,
      cityTreasury: cityTreasury,
      firstCycle: targetCycle,
      lastCycle: (- (+ targetCycle lockPeriod) u1),
      lockPeriod: lockPeriod,
      userId: userId
    })
    (ok true)
  )
)

(define-public (set-stacking-reward (cityId uint) (cycleId uint) (amount uint))
  (let
    (
      (cityTreasury (unwrap! (contract-call? .ccd005-city-data get-treasury-by-name cityId "stacking") ERR_INVALID_TREASURY))
      (cycleStats (get-stacking-stats cityId cycleId))
    )
    (print { sender: tx-sender, caller: contract-caller })
    (try! (is-extension))
    (asserts! (is-none (get reward cycleStats)) ERR_PAYOUT_COMPLETE)
    (asserts! (< cycleId (get-reward-cycle burn-block-height)) ERR_INCOMPLETE_CYCLE)
    (ok (map-set StackingStats
      { cityId: cityId, cycle: cycleId }
      (merge cycleStats { reward: (some amount) })
    ))
  )
)

(define-public (claim-stacking-reward (cityName (string-ascii 10)) (targetCycle uint))
  (let
    (
      (cityId (unwrap! (contract-call? .ccd004-city-registry get-city-id cityName) ERR_INVALID_CITY))
      (user tx-sender)
      (userId (unwrap! (contract-call? .ccd003-user-registry get-user-id user) ERR_INVALID_USER))
      (stacker (get-stacker cityId targetCycle userId))
      (reward (unwrap! (get-stacking-reward cityId userId targetCycle) ERR_NOTHING_TO_CLAIM))
      (claimable (get claimable stacker))
    )
    (asserts! (< targetCycle (get-reward-cycle burn-block-height)) ERR_INCOMPLETE_CYCLE)
    (asserts! (or (> reward u0) (> claimable u0)) ERR_NOTHING_TO_CLAIM)
    ;; contract addresses hardcoded for this version
    (and (is-eq cityName "mia")
      (begin
        (and (> reward u0) (try! (as-contract (contract-call? .ccd002-treasury-mia-stacking withdraw-stx reward user))))
        ;; MAINNET: (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-mia-stacking withdraw-ft 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 claimable user))))
        (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-mia-stacking withdraw-ft .test-ccext-governance-token-mia claimable user))))
      )
    )
    (and (is-eq cityName "nyc")
      (begin
        (and (> reward u0) (try! (as-contract (contract-call? .ccd002-treasury-nyc-stacking withdraw-stx reward user))))
        ;; MAINNET: (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-nyc-stacking withdraw-ft 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 claimable user))))
        (and (> claimable u0) (try! (as-contract (contract-call? .ccd002-treasury-nyc-stacking withdraw-ft .test-ccext-governance-token-nyc claimable user))))
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
    (ok (map-set Stacker
      { cityId: cityId, cycle: targetCycle, userId: userId }
      { stacked: u0, claimable: u0 }
    ))
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (get-reward-cycle-length)
  REWARD_CYCLE_LENGTH
)

(define-read-only (get-stacking-stats (cityId uint) (cycle uint))
  (default-to { total: u0, reward: none }
    (map-get? StackingStats { cityId: cityId, cycle: cycle })
  )
)

(define-read-only (get-stacker (cityId uint) (cycle uint) (userId uint))
  (default-to { stacked: u0, claimable: u0 }
    (map-get? Stacker { cityId: cityId, cycle: cycle, userId: userId })
  )
)

(define-read-only (get-current-reward-cycle)
  (get-reward-cycle burn-block-height)
)

(define-read-only (get-reward-cycle (burnHeight uint))
  (/ (- burnHeight FIRST_STACKING_BLOCK) REWARD_CYCLE_LENGTH)
)

(define-read-only (get-first-block-in-reward-cycle (cycle uint))
  (+ FIRST_STACKING_BLOCK (* cycle REWARD_CYCLE_LENGTH))
)

(define-read-only (is-stacking-active (cityId uint) (cycle uint))
  (is-some (map-get? StackingStats { cityId: cityId, cycle: cycle }))
)

(define-read-only (is-cycle-paid (cityId uint) (cycle uint))
    (is-some (get reward (get-stacking-stats cityId cycle)))
)

(define-read-only (get-stacking-reward (cityId uint) (userId uint) (cycle uint))
  (let
    (
      (cycleStats (get-stacking-stats cityId cycle))
      (stacker (get-stacker cityId cycle userId))
      (userStacked (get stacked stacker))
    )
    (if (or (<= (get-reward-cycle burn-block-height) cycle) (is-eq userStacked u0))
      none
      (some (/ (* (unwrap! (get reward cycleStats) none) userStacked) (get total cycleStats)))
    )
  )
)

;; PRIVATE FUNCTIONS

(define-private (stack-at-cycle (cityId uint) (userId uint) (amount uint) (first uint) (last uint) (target uint))
  (let
    (
      (cycleStats (get-stacking-stats cityId target))
      (stacker (get-stacker cityId target userId))
    )
    (and (>= target first) (< target last)
      (map-set StackingStats
        { cityId: cityId, cycle: target }
        (merge cycleStats { total: (+ amount (get total cycleStats)) })
      )
      (map-set Stacker
        { cityId: cityId, cycle: target, userId: userId }
        (merge stacker {
          stacked: (+ amount (get stacked stacker)),
          claimable: (if (is-eq target (- last u1))
            (+ amount (get claimable stacker))
            (get claimable stacker)
        )})
      )
    )
  )
)
