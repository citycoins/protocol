(impl-trait .proposal-trait.proposal-trait)

(define-constant ERR_PANIC (err u500))

(define-data-var miaJobId uint u0)
(define-data-var nycJobId uint u0)

(define-public (execute (sender principal))
  (let
    (
      ;; create city IDs
      (miaId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia")))
      (nycId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "nyc")))
      ;; get activation block
      ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2
      (miaActivationBlock (try! (contract-call? 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2 get-activation-block)))
      ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2
      (nycActivationBlock (try! (contract-call? 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2 get-activation-block)))
      ;; get activation delay
      ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2
      (miaActivationDelay (contract-call? 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2 get-activation-delay))
      ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2
      (nycActivationDelay (contract-call? 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2 get-activation-delay))
      ;; get activation threshold
      ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2
      (miaActivationThreshold (contract-call? 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2 get-activation-threshold))
      ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2
      (nycActivationThreshold (contract-call? 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2 get-activation-threshold))
      ;; get coinbase thresholds
      ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2
      (miaThresholds (try! (contract-call? 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 get-coinbase-thresholds)))
      ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2
      (nycThresholds (try! (contract-call? 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 get-coinbase-thresholds)))
      ;; get coinbase amounts
      ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2
      (miaAmounts (unwrap! (contract-call? 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 get-coinbase-amounts) ERR_PANIC))
      ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2
      (nycAmounts (unwrap! (contract-call? 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 get-coinbase-amounts) ERR_PANIC))
    )
    ;; set city activation details
    (try! (contract-call? .ccd005-city-data set-activation-details miaId
      block-height
      miaActivationDelay
      miaActivationBlock
      miaActivationThreshold
    ))
    (try! (contract-call? .ccd005-city-data set-activation-details nycId 
      block-height
      nycActivationDelay
      nycActivationBlock
      nycActivationThreshold
    ))
    ;; set city treasury details
    (try! (contract-call? .ccd005-city-data add-treasury miaId .ccd002-treasury-mia-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-treasury miaId .ccd002-treasury-mia-stacking "stacking"))
    (try! (contract-call? .ccd005-city-data add-treasury nycId .ccd002-treasury-nyc-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-treasury nycId .ccd002-treasury-nyc-stacking "stacking"))
    ;; set city coinbase thresholds
    (try! (contract-call? .ccd005-city-data set-coinbase-thresholds miaId 
      (get coinbaseThreshold1 miaThresholds)
      (get coinbaseThreshold2 miaThresholds)
      (get coinbaseThreshold3 miaThresholds)
      (get coinbaseThreshold4 miaThresholds)
      (get coinbaseThreshold5 miaThresholds)
    ))
    (try! (contract-call? .ccd005-city-data set-coinbase-thresholds nycId 
      (get coinbaseThreshold1 nycThresholds)
      (get coinbaseThreshold2 nycThresholds)
      (get coinbaseThreshold3 nycThresholds)
      (get coinbaseThreshold4 nycThresholds)
      (get coinbaseThreshold5 nycThresholds)
    ))
    ;; set city coinbase amounts
    (try! (contract-call? .ccd005-city-data set-coinbase-amounts miaId 
      (get coinbaseAmountBonus miaAmounts)
      (get coinbaseAmount1 miaAmounts)
      (get coinbaseAmount2 miaAmounts)
      (get coinbaseAmount3 miaAmounts)
      (get coinbaseAmount4 miaAmounts)
      (get coinbaseAmount5 miaAmounts)
      (get coinbaseAmountDefault miaAmounts)
    ))
    (try! (contract-call? .ccd005-city-data set-coinbase-amounts nycId 
      (get coinbaseAmountBonus nycAmounts)
      (get coinbaseAmount1 nycAmounts)
      (get coinbaseAmount2 nycAmounts)
      (get coinbaseAmount3 nycAmounts)
      (get coinbaseAmount4 nycAmounts)
      (get coinbaseAmount5 nycAmounts)
      (get coinbaseAmountDefault nycAmounts)
    ))
    ;; set city coinbase details
    ;; same as TOKEN_BONUS_PERIOD and TOKEN_EPOCH_LENGTH in token contracts
    (try! (contract-call? .ccd005-city-data set-coinbase-details miaId u10000 u25000))
    (try! (contract-call? .ccd005-city-data set-coinbase-details nycId u10000 u25000))
    
    ;; setup core contract upgrade using ccd009 adapter

    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-auth-v2
    (var-set miaJobId (try! (contract-call? .ccd009-auth-v2-adapter create-job-mia "upgrade to DAO protocol" 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-auth-v2)))
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2
    (var-set nycJobId (try! (contract-call? .ccd009-auth-v2-adapter create-job-nyc "upgrade to DAO protocol" 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-auth-v2)))
    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2
    (try! (contract-call? .ccd009-auth-v2-adapter add-principal-argument-mia (var-get miaJobId) "oldContract" 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2))
    (try! (contract-call? .ccd009-auth-v2-adapter add-principal-argument-mia (var-get miaJobId) "newContract" .ccd006-citycoin-mining))
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2
    (try! (contract-call? .ccd009-auth-v2-adapter add-principal-argument-nyc (var-get nycJobId) "oldContract" 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2))
    (try! (contract-call? .ccd009-auth-v2-adapter add-principal-argument-nyc (var-get nycJobId) "newContract" .ccd006-citycoin-mining))
    (try! (contract-call? .ccd009-auth-v2-adapter activate-job-mia (var-get miaJobId)))
    (try! (contract-call? .ccd009-auth-v2-adapter activate-job-nyc (var-get nycJobId)))
    (try! (contract-call? .ccd009-auth-v2-adapter approve-job-mia (var-get miaJobId)))
    (try! (contract-call? .ccd009-auth-v2-adapter approve-job-nyc (var-get nycJobId)))

    ;; end
    (ok true)
  )
)

(define-read-only (get-job-ids)
  (if (or (is-eq (var-get miaJobId) u0) (is-eq (var-get nycJobId) u0))
    none
    (some {
      miaJobId: (var-get miaJobId),
      nycJobId: (var-get nycJobId)
    })
  )
)
