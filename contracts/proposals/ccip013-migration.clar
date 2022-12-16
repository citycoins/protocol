(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (let
    (
      ;; create city IDs
      (miaId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia")))
      (nycId (try! (contract-call? .ccd004-city-registry get-or-create-city-id "nyc")))
    )
    ;; set city activation status
    (try! (contract-call? .ccd005-city-data set-city-activation-status miaId true))
    (try! (contract-call? .ccd005-city-data set-city-activation-status nycId true))
    ;; set city activation details
    (try! (contract-call? .ccd005-city-data set-city-activation-details miaId u24347 u150 u24497 u20))
    (try! (contract-call? .ccd005-city-data set-city-activation-details nycId u37299 u150 u37449 u20))
    ;; set city treasury details
    (try! (contract-call? .ccd005-city-data add-city-treasury miaId .ccd002-treasury-mia-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-city-treasury miaId .ccd002-treasury-mia-stacking "stacking"))
    (try! (contract-call? .ccd005-city-data add-city-treasury nycId .ccd002-treasury-nyc-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-city-treasury nycId .ccd002-treasury-nyc-stacking "stacking"))
    ;; set city token contracts
    ;; TODO: double check manual nonce input here
    (try! (contract-call? .ccd005-city-data add-city-token-contract miaId 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2))
    (try! (contract-call? .ccd005-city-data set-active-city-token-contract miaId u1))
    (try! (contract-call? .ccd005-city-data add-city-token-contract nycId 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2))
    (try! (contract-call? .ccd005-city-data set-active-city-token-contract nycId u1))
    ;; set city coinbase thresholds
    ;; numbers below from API for testing
    ;; TODO: pull directly from token contracts
    (try! (contract-call? .ccd005-city-data set-city-coinbase-thresholds miaId u59497 u76990 u209497 u409497 u809497))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-thresholds nycId u72449 u76990 u222449 u422449 u822449))
    ;; set city coinbase amounts
    ;; numbers below from API for testing
    ;; TODO: pull directly from token contracts
    (try! (contract-call? .ccd005-city-data set-city-coinbase-amounts miaId u250000000000 u100000000000 u50000000000 u2292000000 u2440000000 u2730000000 u3402000000))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-amounts nycId u250000000000 u100000000000 u50000000000 u2044000000 u2182000000 u2441000000 u3041000000))
    ;; set city coinbase bonus period
    (try! (contract-call? .ccd005-city-data set-city-coinbase-bonus-period miaId u10000))
    (try! (contract-call? .ccd005-city-data set-city-coinbase-bonus-period nycId u10000))
    ;; end
    (ok true)
  )
)
