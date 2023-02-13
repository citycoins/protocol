(impl-trait .proposal-trait.proposal-trait)

(define-constant ERR_PANIC (err u500))

(define-public (execute (sender principal))
  (let
    (
      (miaId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_PANIC))
      (nycId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_PANIC))
      (jobIds (unwrap! (contract-call? .ccip013-migration get-job-ids) ERR_PANIC))
    )
    ;; shut down old protocol contracts
    ;; MAINNET: (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-mia (get miaJobId jobIds) 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 .ccd010-core-v2-adapter))
    ;; MAINNET: (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-nyc (get nycJobId jobIds) 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 .ccd010-core-v2-adapter))
    (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-mia (get miaJobId jobIds) 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2 .ccd010-core-v2-adapter))
    (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-nyc (get nycJobId jobIds) 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2 .ccd010-core-v2-adapter))
    ;; activate cities in new protocol
    (try! (contract-call? .ccd005-city-data set-activation-status miaId true))
    (try! (contract-call? .ccd005-city-data set-activation-status nycId true))
    ;; sets allowed assets for treasury contracts
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-mia-mining set-allowed 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 true))
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-mia-stacking set-allowed 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 true))
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-nyc-mining set-allowed 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 true))
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-nyc-stacking set-allowed 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2 true))
    ;; TESTNET: (try! (contract-call? .ccd002-treasury-mia-mining-v2 set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    ;; TESTNET: (try! (contract-call? .ccd002-treasury-mia-stacking-v2 set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    ;; TESTNET: (try! (contract-call? .ccd002-treasury-nyc-mining-v2 set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))
    ;; TESTNET: (try! (contract-call? .ccd002-treasury-nyc-stacking-v2 set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-mia-mining set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-mia-stacking set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-nyc-mining set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-nyc-stacking set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))

    (print "Continuous effort, not strength or intelligence is the key to unlocking our potential. - Winston Churchill")

    (ok true)
  )
)
