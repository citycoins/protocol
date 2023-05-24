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

(define-constant CCIP_014 {
  name: "",
  link: "",
  hash: "",
})

(define-constant VOTE_SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places
(define-constant MIA_SCALE_BASE (pow u10 u4)) ;; 4 decimal places
(define-constant MIA_SCALE_FACTOR u876) ;; 0.876 or 87.6%
;; MIA votes scaled to make 1 MIA = 1 NYC
;; full calculation available in CCIP-014

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
    mia: uint,
    nyc: uint,
    total: uint,
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

    ;; check vote details
    (try! (is-executable))

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

;; TODO: use at-block for call below?
(define-public (vote-on-ccip014 (vote bool))
  (let
    (
      (miaId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_NO_CITY_ID))
      (nycId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_NO_CITY_ID))
      (voterId (unwrap! (contract-call? .ccd003-user-registry get-user-id contract-caller) ERR_USER_NOT_FOUND))
      (voterRecord (map-get? UserVotes voterId))
    )
    ;; check that proposal is active
    ;;(asserts! (and
    ;;  (>= block-height (var-get voteStart))
    ;;  (<= block-height (var-get voteEnd)))
    ;;  ERR_PROPOSAL_NOT_ACTIVE)
    ;; lines above modified since vote will start at deployed height
    (asserts! (<= block-height (var-get voteEnd)) ERR_PROPOSAL_NOT_ACTIVE)
    ;; check if vote record exists
    (match voterRecord record
      ;; if the voterRecord exists
      (begin
        ;; check vote is not the same as before
        (asserts! (not (is-eq (get vote record) vote)) ERR_VOTED_ALREADY)
        ;; record the new vote for the user
        (map-set UserVotes voterId
          (merge record { vote: vote })
        )
        ;; update the overall vote totals
        (if vote
          (begin
            (var-set yesVotes (+ (var-get yesVotes) u1))
            (var-set yesTotal (+ (var-get yesTotal) (get total record)))
            (var-set noVotes (- (var-get noVotes) u1))
            (var-set noTotal (- (var-get noTotal) (get total record)))
          )
          (begin
            (var-set yesVotes (- (var-get yesVotes) u1))
            (var-set yesTotal (- (var-get yesTotal) (get total record)))
            (var-set noVotes (+ (var-get noVotes) u1))
            (var-set noTotal (+ (var-get noTotal) (get total record)))
          )
        )
      )
      ;; if the voterRecord does not exist
      (let
        (
          (scaledVoteMia (default-to u0 (get-mia-vote miaId voterId true)))
          (scaledVoteNyc (default-to u0 (get-nyc-vote nycId voterId true)))
          (voteMia (scale-down scaledVoteMia))
          (voteNyc (scale-down scaledVoteNyc))
          (voteTotal (+ voteMia voteNyc))
        )
        ;; record the vote for the user
        (map-insert UserVotes voterId {
          vote: vote,
          mia: voteMia,
          nyc: voteNyc,
          total: voteTotal,
        })
        ;; update the overall vote totals
        (if vote
          (begin
            (var-set yesVotes (+ (var-get yesVotes) u1))
            (var-set yesTotal (+ (var-get yesTotal) voteTotal))
          )
          (begin
            (var-set noVotes (+ (var-get noVotes) u1))
            (var-set noTotal (+ (var-get noTotal) voteTotal))
          )
        )
      )
    )
    ;; print voter information
    (print (map-get? UserVotes voterId))
    ;; print vote totals
    (print (get-vote-totals))
    (ok true)
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (is-executable)
  (begin
    ;; line below removed since vote will start at deployed height
    ;; (asserts! (>= block-height (var-get voteStart)) ERR_PROPOSAL_NOT_ACTIVE)
    (asserts! (>= block-height (var-get voteEnd)) ERR_PROPOSAL_STILL_ACTIVE)
    (asserts! (> (var-get yesTotal) (var-get noTotal)) ERR_VOTE_FAILED)
    (ok true)
  )
)

(define-read-only (get-proposal-info)
  (some CCIP_014)
)

(define-read-only (get-vote-period)
  (if (and
    (> (var-get voteStart)  u0)
    (> (var-get voteEnd) u0))
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

;; MIA vote calculation
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-mia-vote (cityId uint) (userId uint) (scaled bool))
  (let
    (
      ;; MAINNET: MIA cycle 54 / first block BTC 779,450 STX 97,453
      ;; cycle 2 / u4500 used in tests
      (cycle54Hash (unwrap! (get-block-hash u4500) none))
      (cycle54Data (at-block cycle54Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u2 userId)))
      (cycle54Amount (get stacked cycle54Data))
      ;; MAINNET: MIA cycle 55 / first block BTC 781,550 STX 99,112
      ;; cycle 3 / u6600 used in tests
      (cycle55Hash (unwrap! (get-block-hash u6600) none))
      (cycle55Data (at-block cycle55Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u3 userId)))
      (cycle55Amount (get stacked cycle55Data))
      ;; MIA vote calculation
      (avgStacked (/ (+ (scale-up cycle54Amount) (scale-up cycle55Amount)) u2))
      (scaledVote (/ (* avgStacked MIA_SCALE_FACTOR) MIA_SCALE_BASE))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle54Amount u0) (> cycle55Amount u0)) none)
    ;; return scaled or unscaled value
    (if scaled (some scaledVote) (some (/ scaledVote VOTE_SCALE_FACTOR)))
  )
)

;; NYC vote calculation
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-nyc-vote (cityId uint) (userId uint) (scaled bool))
  (let
    (
      ;; NYC cycle 54 / first block BTC 779,450 STX 97,453
      ;; cycle 2 / u4500 used in tests
      (cycle54Hash (unwrap! (get-block-hash u4500) none))
      (cycle54Data (at-block cycle54Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u2 userId)))
      (cycle54Amount (get stacked cycle54Data))
      ;; NYC cycle 55 / first block BTC 781,550 STX 99,112
      ;; cycle 3 / u6600 used in tests
      (cycle55Hash (unwrap! (get-block-hash u6600) none))
      (cycle55Data (at-block cycle55Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u3 userId)))
      (cycle55Amount (get stacked cycle55Data))
      ;; NYC vote calculation
      (scaledVote (/ (+ (scale-up cycle54Amount) (scale-up cycle55Amount)) u2))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle54Amount u0) (> cycle55Amount u0)) none)
    ;; return scaled or unscaled value
    (if scaled (some scaledVote) (some (/ scaledVote VOTE_SCALE_FACTOR)))
  )
)

;; PRIVATE FUNCTIONS

;; get block hash by height
(define-private (get-block-hash (blockHeight uint))
  (get-block-info? id-header-hash blockHeight)
)

;; CREDIT: ALEX math-fixed-point-16.clar

(define-private (scale-up (a uint))
  (* a VOTE_SCALE_FACTOR)
)

(define-private (scale-down (a uint))
  (/ a VOTE_SCALE_FACTOR)
)
