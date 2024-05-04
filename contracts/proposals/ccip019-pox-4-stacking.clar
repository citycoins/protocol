;; TRAITS

(impl-trait .proposal-trait.proposal-trait)

;; ERRORS

(define-constant ERR_PANIC (err u1400))
(define-constant ERR_VOTED_ALREADY (err u1401))
(define-constant ERR_NOTHING_STACKED (err u1402))
(define-constant ERR_USER_NOT_FOUND (err u1403))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u1404))
(define-constant ERR_PROPOSAL_STILL_ACTIVE (err u1405))
(define-constant ERR_NO_CITY_ID (err u1406))
(define-constant ERR_VOTE_FAILED (err u1407))

;; CONSTANTS

(define-constant SELF (as-contract tx-sender))
(define-constant CCIP_019 {
  name: "PoX-4 Stacking",
  link: "",
  hash: "",
})


;; PUBLIC FUNCTIONS

(define-public (execute (sender principal))
  (let
    (
      (miaId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_PANIC))
      (nycId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_PANIC))
      (miaBalance (contract-call? .ccd002-treasury-mia-mining-v2 get-balance-stx))
      (nycBalance (contract-call? .ccd002-treasury-nyc-mining-v2 get-balance-stx))
    )

    ;; check vote complete/passed
    (try! (is-executable))

    ;; enable new treasuries in the DAO
    (try! (contract-call? .base-dao set-extensions
      (list
        {extension: .ccd002-treasury-mia-mining-v3, enabled: true}
        {extension: .ccd002-treasury-nyc-mining-v3, enabled: true}
      )
    ))

    ;; allow MIA/NYC in respective treasuries
    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2
    (try! (contract-call? .ccd002-treasury-mia-mining-v3 set-allowed 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2 true))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v3 set-allowed 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2 true))

    ;; transfer funds to new treasury extensions
    (try! (contract-call? .ccd002-treasury-mia-mining-v2 withdraw-stx miaBalance .ccd002-treasury-mia-mining-v3))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v2 withdraw-stx nycBalance .ccd002-treasury-nyc-mining-v3))

    ;; delegate stack the STX in the mining treasuries (up to 50M STX each)
    ;; MAINNET: SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP.pox-fast-pool-v2
    ;; MAINNET: SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP.pox-fast-pool-v2
    (try! (contract-call? .ccd002-treasury-mia-mining-v3 delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v3 delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))

    ;; add treasuries to ccd005-city-data
    (try! (contract-call? .ccd005-city-data add-treasury miaId .ccd002-treasury-mia-mining-v3 "mining-v2"))
    (try! (contract-call? .ccd005-city-data add-treasury nycId .ccd002-treasury-nyc-mining-v3 "mining-v2"))

    (ok true)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (is-executable)
  (begin
    (ok true)
  )
)

(define-read-only (get-proposal-info)
  (some CCIP_019)
)