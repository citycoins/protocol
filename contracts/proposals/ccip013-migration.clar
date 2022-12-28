(impl-trait .proposal-trait.proposal-trait)

(define-constant ERR_PANIC (err u500))

(define-public (execute (sender principal))
  (let
    (
      ;; create city IDs
      (miaId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia")))
      (nycId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "nyc")))
      ;; get activation block
      (miaActivationBlock (try! (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-activation-block)))
      (nycActivationBlock (try! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-activation-block)))
      ;; get activation delay
      (miaActivationDelay (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-activation-delay))
      (nycActivationDelay (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-activation-delay))
      ;; get activation threshold
      (miaActivationThreshold (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 get-activation-threshold))
      (nycActivationThreshold (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 get-activation-threshold))
      ;; get coinbase thresholds
      (miaThresholds (try! (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 get-coinbase-thresholds)))
      (nycThresholds (try! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 get-coinbase-thresholds)))
      ;; get coinbase amounts
      (miaAmounts (unwrap! (contract-call? 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 get-coinbase-amounts) ERR_PANIC))
      (nycAmounts (unwrap! (contract-call? 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 get-coinbase-amounts) ERR_PANIC))
    )
    ;; set city activation status
    (try! (contract-call? .ccd005-city-data set-city-activation-status miaId true))
    (try! (contract-call? .ccd005-city-data set-city-activation-status nycId true))
    ;; set city activation details
    (try! (contract-call? .ccd005-city-data set-city-activation-details miaId
      (- miaActivationBlock miaActivationDelay)
      miaActivationDelay
      miaActivationBlock
      miaActivationThreshold
    ))
    (try! (contract-call? .ccd005-city-data set-city-activation-details nycId 
      (- nycActivationBlock nycActivationDelay)
      nycActivationDelay
      nycActivationBlock
      nycActivationThreshold
    ))
    ;; set city treasury details
    (try! (contract-call? .ccd005-city-data add-city-treasury miaId .ccd002-treasury-mia-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-city-treasury miaId .ccd002-treasury-mia-stacking "stacking"))
    (try! (contract-call? .ccd005-city-data add-city-treasury nycId .ccd002-treasury-nyc-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-city-treasury nycId .ccd002-treasury-nyc-stacking "stacking"))
    ;; set city token contracts
    (try! (contract-call? .ccd005-city-data add-city-token-contract miaId 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2))
    (try! (contract-call? .ccd005-city-data set-active-city-token-contract miaId u1))
    (try! (contract-call? .ccd005-city-data add-city-token-contract nycId 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2))
    (try! (contract-call? .ccd005-city-data set-active-city-token-contract nycId u1))
    ;; set city coinbase thresholds
    (try! (contract-call? .ccd005-city-data set-city-coinbase-thresholds miaId 
      (get coinbaseThreshold1 miaThresholds)
      (get coinbaseThreshold2 miaThresholds)
      (get coinbaseThreshold3 miaThresholds)
      (get coinbaseThreshold4 miaThresholds)
      (get coinbaseThreshold5 miaThresholds)
    ))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-thresholds nycId 
      (get coinbaseThreshold1 nycThresholds)
      (get coinbaseThreshold2 nycThresholds)
      (get coinbaseThreshold3 nycThresholds)
      (get coinbaseThreshold4 nycThresholds)
      (get coinbaseThreshold5 nycThresholds)
    ))
    ;; set city coinbase amounts
    (try! (contract-call? .ccd005-city-data set-city-coinbase-amounts miaId 
      (get coinbaseAmountBonus miaAmounts)
      (get coinbaseAmount1 miaAmounts)
      (get coinbaseAmount2 miaAmounts)
      (get coinbaseAmount3 miaAmounts)
      (get coinbaseAmount4 miaAmounts)
      (get coinbaseAmount5 miaAmounts)
      (get coinbaseAmountDefault miaAmounts)
    ))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-amounts nycId 
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
    (try! (contract-call? .ccd005-city-data set-city-coinbase-details miaId {
      bonusPeriod: u10000,
      epochLength: u35000
    }))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-details nycId {
      bonusPeriod: u10000,
      epochLength: u35000
    }))
    ;; end
    (ok true)
  )
)
