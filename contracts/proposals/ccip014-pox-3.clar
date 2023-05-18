;; TRAITS

(impl-trait .proposal-trait.proposal-trait)

;; ERRORS

(define-constant ERR_PANIC (err u1400))
(define-constant ERR_VOTED_ALREADY (err u1401))
(define-constant ERR_NOTHING_STACKED (err u1402))

;; CONSTANTS

(define-constant CCIP_014 {
  name: "",
  link: "",
  hash: "",
})

;; DATA VARS

;; vote block heights
(define-data-var voteStart uint u0)
(define-data-var voteEnd uint u0)
(var-set voteStart block-height)

;; vote tracking
(define-data-var yesVotes uint u0)
(define-data-var yesTotal uint u0)
(define-data-var noVotes uint u0)
(define-data-var noTotal uint u0)

;; DATA MAPS

(define-map UserVotes
  uint ;; user ID
  { ;; vote
    vote: bool,
    amount: uint
  }
)

;; PUBLIC FUNCTIONS

(define-public (execute (sender principal))
  (let
    (
      (miaId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_PANIC))
      (nycId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_PANIC))
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
    (try! (contract-call? .ccd002-treasury-mia-mining-v2 delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v2 delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))

    ;; add treasuries to ccd005-city-data
    (try! (contract-call? .ccd005-city-data add-treasury miaId .ccd002-treasury-mia-mining-v2 "mining-v2"))
    (try! (contract-call? .ccd005-city-data add-treasury nycId .ccd002-treasury-nyc-mining-v2 "mining-v2"))

    ;; disable original mining contract
    (try! (contract-call? .ccd006-citycoin-mining set-mining-enabled false))

    (ok true)
  )  
)

;; READ ONLY FUNCTIONS

(define-read-only (get-proposal-info)
  (some CCIP_014)
)

(define-read-only (get-vote-period)
  (if (and
    ((var-get voteStart) > u0)
    ((var-get voteEnd) > u0))
    ;; if both are set, return values
    (some {
      startBlock: (var-get voteStart),
      endBlock: (var-get voteEnd),
      length: (- (var-get voteEnd) (var-get voteStart))
    })
    ;; else return none
    none
  )
)

(define-read-only (get-vote-totals)
  (some {
    yesVotes: (var-get yesVotes),
    yesTotal: (var-get yesTotal),
    noVotes: (var-get noVotes),
    noTotal: (var-get noTotal)
  })
)

(define-read-only (get-voter-info (id uint))
  (map-get? UserVotes id)
)

;; PRIVATE FUNCTIONS

;; TODO: getter for user ID from ccd003

;; get block hash by height
(define-private (get-block-hash (blockHeight uint))
  (get-block-info? id-header-hash blockHeight)
)