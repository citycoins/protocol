(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (let
    (
      (miaBalance (contract-call? .ccd002-treasury-mia-mining get-balance-stx))
      (nycBalance (contract-call? .ccd002-treasury-nyc-mining get-balance-stx))
    )

    ;; enable mining v2 treasuries in the DAO
    (try! (contract-call? .base-dao set-extensions
      (list
        {extension: .ccd002-treasury-mia-mining-v2, enabled: true}
        {extension: .ccd002-treasury-nyc-mining-v2, enabled: true}
      )
    ))
    
    ;; allow MIA/NYC in respective treasuries
    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2
    (try! (contract-call? .ccd002-treasury-mia-mining-v2 set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v2 set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))
    
    ;; transfer funds to new treasury extensions
    (try! (contract-call? .ccd002-treasury-mia-mining withdraw-stx miaBalance .ccd002-treasury-mia-mining-v2))
    (try! (contract-call? .ccd002-treasury-nyc-mining withdraw-stx nycBalance .ccd002-treasury-nyc-mining-v2))

    ;; delegate stack the STX in the mining treasuries (up to 50M STX each)
    ;; MAINNET: TODO
    ;; MAINNET: TODO
    (try! (contract-call? .ccd002-treasury-mia-mining delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
    (try! (contract-call? .ccd002-treasury-nyc-mining delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))

    ;; add treasuries to ccd005-city-data
    (try! (contract-call? .ccd005-city-data add-treasury miaId .ccd002-treasury-mia-mining "mining-v2"))
    (try! (contract-call? .ccd005-city-data add-treasury nycId .ccd002-treasury-nyc-mining "mining-v2"))

    (ok true)
  )  
)
