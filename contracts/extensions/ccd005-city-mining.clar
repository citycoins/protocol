;; Mining

;; TODO: TRAITS

;; ERROR CODES

(define-constant ERR_UNAUTHORIZED (err u3400))
(define-constant ERR_INVALID_PARAMS (err u3401))
(define-constant ERR_ALREADY_MINED (err u3402))
(define-constant ERR_INSUFFICIENT_COMMIT (err u3403))
(define-constant ERR_NO_VRF_SEED_FOUND (err u3404))
(define-constant ERR_ALREADY_CLAIMED (err u3405))
(define-constant ERR_MINER_NOT_WINNER (err u3406))

;; AUTHORIZATION CHECK

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; MINING CONFIGURATION

;; delay before mining rewards can be claimed
(define-data-var rewardDelay uint u100)

(define-read-only (get-reward-delay)
  (var-get rewardDelay)
)

(define-public (set-reward-delay (delay uint))
  (begin 
    (try! (is-dao-or-extension))
    (asserts! (> delay u0) ERR_INVALID_PARAMS)
    (ok (var-set rewardDelay delay))
  )
)

;; At a given city and Stacks block height
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

;; At a given Stacks block height and user ID:
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

;; At a given city and Stacks block height
;; - what is the high value from MinerAtBlock
(define-map HighValueAtBlock
  {
    cityId: uint,
    height: uint
  }
  uint
)

(define-read-only (get-high-value (cityId uint) (height uint))
  (default-to u0
    (map-get? HighValueAtBlock {
      cityId: cityId,
      height: height
    })
  )
)

;; At a given city and Stacks block height
;; - what is the ID of the miner who won the block?
;; (only known after the miner claims the block)
(define-map WinnerAtBlock
  {
    cityId: uint,
    height: uint
  }
  uint
)

(define-read-only (get-block-winner (cityId uint) (height uint))
  (map-get? WinnerAtBlock {
    cityId: cityId,
    height: height
  })
)

;; MINING ACTIONS

(define-public (mine (cityName (string-ascii 32)) (amounts (list 200 uint)))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
      (cityDetails (try! (get-city-activation-details cityId)))
      (cityTreasury (try! (get-city-treasury cityId "mining")))
    )
    
    (asserts! (> (len amounts) u0) ERR_INVALID_PARAMS)
    ;; TODO: fold over mine-block
    (ok true)
  )
)

(define-public (mine-block
  (amount uint)
  (return (response
    {
      cityId: uint,
      userId: uint,
      height: uint,
      amountPrev: uint
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
        (amountPrev (get amountPrev okReturn))
      )
      (asserts! (not (has-mined-at-block cityId height userId)) ERR_ALREADY_MINED)
      (asserts! (> amount u0) ERR_INSUFFICIENT_COMMIT)
      (set-mining-data cityId height userId amount)
      (ok (merge okReturn
        {
          height: (+ height u1),
          amount: (+ amountPrev amount)
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

;; MINING CLAIM ACTIONS

;; wrapper that calls the next function using the current block height
(define-public (claim-mining-reward (cityName (string-ascii 32)) (claimHeight uint))
  (let
    (
      (cityId (try! (get-city-id cityName)))
      (cityActivated (try! (is-city-activated cityId)))
    )
    ;; TODO: review logic around contract shutdown
    (claim-mining-reward-at-block cityId tx-sender block-height claimHeight)
  )
)

(define-private (claim-mining-reward-at-block (cityId uint) (user principal) (stacksHeight uint) (claimHeight uint))
  (let
    (
      (maturityHeight (+ (get-reward-delay) claimHeight))
      (isMature (asserts! (> stacksHeight maturityHeight) ERR_INVALID_PARAMS))
      (userId (try! (get-user-id user)))
      ;; TODO: review issue if neither below fail but return defaults
      (blockStats (get-mining-stats-at-block cityId claimHeight))
      (minerStats (get-miner-at-block cityId claimHeight userId))
      (vrfSample (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-vrf-v2 get-save-rnd maturityHeight) ERR_NO_VRF_SEED_FOUND))
      (commitTotal (get-high-value cityId claimHeight))
      (winningValue (mod vrfSample commitTotal))
    )
    ;; check claim is valid
    (asserts! (not (get claimed blockStats)) ERR_ALREADY_CLAIMED)
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
    ;; TODO: print winner details here?
    ;; TODO: mint coinbase!
    ;; TODO: get-coinbase-amount function
    ;; (as-contract (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 mint (get-coinbase-amount stacksHeight) recipient))
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

;; TODO: mining exchange rate for a city
;; TODO: mining claims per block
;; TODO: more detailed error messages
