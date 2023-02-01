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
    ;; MAINNET: (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-mia (get miaJobId jobIds) 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-core-v2 .ccd006-city-mining))
    ;; MAINNET: (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-nyc (get nycJobId jobIds) 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-core-v2 .ccd006-city-mining))
    (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-mia (get miaJobId jobIds) 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-core-v2 .ccd006-city-mining))
    (try! (contract-call? .ccd009-auth-v2-adapter execute-upgrade-core-contract-job-nyc (get nycJobId jobIds) 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-core-v2 .ccd006-city-mining))
    ;; activate cities in new protocol
    (try! (contract-call? .ccd005-city-data set-city-activation-status miaId true))
    (try! (contract-call? .ccd005-city-data set-city-activation-status nycId true))

    (print "Continuous effort, not strength or intelligence is the key to unlocking our potential. - Winston Churchill")

    (ok true)
  )
)
