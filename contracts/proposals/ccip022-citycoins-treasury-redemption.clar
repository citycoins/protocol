;; TRAITS

(impl-trait .proposal-trait.proposal-trait)
(impl-trait .ccip015-trait.ccip015-trait)

;; ERRORS

(define-constant ERR_PANIC (err u2200))
(define-constant ERR_VOTED_ALREADY (err u2201))
(define-constant ERR_NOTHING_STACKED (err u2202))
(define-constant ERR_USER_NOT_FOUND (err u2203))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u2204))
(define-constant ERR_PROPOSAL_STILL_ACTIVE (err u2205))
(define-constant ERR_VOTE_FAILED (err u2206))

;; CONSTANTS

;; used to pay out missed cycles in protocol
(define-constant MISSED_PAYOUT u1)

(define-constant SELF (as-contract tx-sender))
(define-constant CCIP_022 {
  name: "CityCoins Treasury Redemption",
  link: "https://github.com/citycoins/governance/blob/feat/add-ccip-022/ccips/ccip-022/ccip-022-citycoins-treasury-redemption.md",
  hash: "TBD",
})

(define-constant MIA_ID u1) ;; (contract-call? .ccd004-city-registry get-city-id "mia")
(define-constant NYC_ID u2) ;; (contract-call? .ccd004-city-registry get-city-id "nyc")

(define-constant VOTE_SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places
(define-constant MIA_SCALE_BASE (pow u10 u4)) ;; 4 decimal places
(define-constant MIA_SCALE_FACTOR u8916) ;; 0.8916 or 89.16%
;; MIA votes scaled to make 1 MIA = 1 NYC
;; full calculation available in CCIP-022

;; DATA VARS

;; vote block heights
(define-data-var voteActive bool true)
(define-data-var voteStart uint u0)
(define-data-var voteEnd uint u0)

;; start the vote when deployed
(var-set voteStart block-height)

;; DATA MAPS

(define-map CityVotes
  uint ;; city ID
  { ;; vote
    totalAmountYes: uint,
    totalAmountNo: uint,
    totalVotesYes: uint,
    totalVotesNo: uint,
  }
)

(define-map UserVotes
  uint ;; user ID
  { ;; vote
    vote: bool,
    mia: uint,
    nyc: uint,
  }
)
;; PUBLIC FUNCTIONS

(define-public (execute (sender principal))
  (begin
    ;; check vote is complete/passed
    (try! (is-executable))
    ;; update vote variables
    (var-set voteEnd block-height)
    (var-set voteActive false)
    ;; transfer funds to new redemption extensions
    (try! (contract-call? .ccd002-treasury-mia-mining-v2 withdraw-stx miaRedemptionBalance .ccd012-redemption-mia))
    (try! (contract-call? .ccd002-treasury-nyc-mining-v2 withdraw-stx nycRedemptionBalance .ccd012-redemption-nyc))

    ;; set pool operator to self
    (try! (contract-call? .ccd011-stacking-payouts set-pool-operator SELF))

    ;; pay out missed MIA cycles 56, 57, 58, 59 with 1 uSTX each
    ;; MAINNET: u56, u57, u58, u59
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u1 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u2 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u3 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u4 MISSED_PAYOUT)))

    ;; pay out missed NYC cycles 56, 57, 58, 59 with 1 uSTX each
    ;; MAINNET: u56, u57, u58, u59
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u1 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u2 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u3 MISSED_PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u4 MISSED_PAYOUT)))
    (ok true)
  )
)

(define-public (vote-on-proposal (vote bool))
  (let
    (
      (voterId (unwrap! (contract-call? .ccd003-user-registry get-user-id contract-caller) ERR_USER_NOT_FOUND))
      (voterRecord (map-get? UserVotes voterId))
    )
    ;; check if vote is active
    (asserts! (var-get voteActive) ERR_PROPOSAL_NOT_ACTIVE)
    ;; check if vote record exists for user
    (match voterRecord record
      ;; if the voterRecord exists
      (let
        (
          (oldVote (get vote record))
          (miaVoteAmount (get mia record))
          (nycVoteAmount (get nyc record))
        )
        ;; check vote is not the same as before
        (asserts! (not (is-eq oldVote vote)) ERR_VOTED_ALREADY)
        ;; record the new vote for the user
        (map-set UserVotes voterId
          (merge record { vote: vote })
        )
        ;; update vote stats for each city
        (update-city-votes MIA_ID miaVoteAmount vote true)
        (update-city-votes NYC_ID nycVoteAmount vote true)
        (ok true)
      )
      ;; if the voterRecord does not exist
      (let
        (
          (miaVoteAmount (scale-down (default-to u0 (get-mia-vote voterId true))))
          (nycVoteAmount (scale-down (default-to u0 (get-nyc-vote voterId true))))
        )
        ;; check that the user has a positive vote
        (asserts! (or (> miaVoteAmount u0) (> nycVoteAmount u0)) ERR_NOTHING_STACKED)
        ;; insert new user vote record  
        (map-insert UserVotes voterId {
          vote: vote, 
          mia: miaVoteAmount,
          nyc: nycVoteAmount
        })
        ;; update vote stats for each city
        (update-city-votes MIA_ID miaVoteAmount vote false)
        (update-city-votes NYC_ID nycVoteAmount vote false)
        (ok true)
      )
    )
  )
)

;; READ ONLY FUNCTIONS

(define-read-only (is-executable)
  (let
    (
      (votingRecord (unwrap! (get-vote-totals) ERR_PANIC))
      (miaRecord (get mia votingRecord))
      (nycRecord (get nyc votingRecord))
      (voteTotals (get totals votingRecord))
    )
    ;; check that there is at least one vote
    (asserts! (or (> (get totalVotesYes voteTotals) u0) (> (get totalVotesNo voteTotals) u0)) ERR_VOTE_FAILED)
    ;; check that the yes total is more than no total
    (asserts! (> (get totalVotesYes voteTotals) (get totalVotesNo voteTotals)) ERR_VOTE_FAILED)
    ;; check that each city has at least 25% of the total "yes" votes
    (asserts! (and
      (>= (get totalAmountYes miaRecord) (/ (get totalAmountYes voteTotals) u4))
      (>= (get totalAmountYes nycRecord) (/ (get totalAmountYes voteTotals) u4))
    ) ERR_VOTE_FAILED)
    ;; allow execution
    (ok true)
  )
)

(define-read-only (is-vote-active)
  (some (var-get voteActive))
)

(define-read-only (get-proposal-info)
  (some CCIP_020)
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

(define-read-only (get-vote-total-mia)
  (map-get? CityVotes MIA_ID)
)

(define-read-only (get-vote-total-mia-or-default)
  (default-to { totalAmountYes: u0, totalAmountNo: u0, totalVotesYes: u0, totalVotesNo: u0 } (get-vote-total-mia))
)

(define-read-only (get-vote-total-nyc)
  (map-get? CityVotes NYC_ID)
)

(define-read-only (get-vote-total-nyc-or-default)
  (default-to { totalAmountYes: u0, totalAmountNo: u0, totalVotesYes: u0, totalVotesNo: u0 } (get-vote-total-nyc))
)

(define-read-only (get-vote-totals)
  (let
    (
      (miaRecord (get-vote-total-mia-or-default))
      (nycRecord (get-vote-total-nyc-or-default))
    )
    (some {
      mia: miaRecord,
      nyc: nycRecord,
      totals: {
        totalAmountYes: (+ (get totalAmountYes miaRecord) (get totalAmountYes nycRecord)),
        totalAmountNo: (+ (get totalAmountNo miaRecord) (get totalAmountNo nycRecord)),
        totalVotesYes: (+ (get totalVotesYes miaRecord) (get totalVotesYes nycRecord)),
        totalVotesNo: (+ (get totalVotesNo miaRecord) (get totalVotesNo nycRecord)),
      }
    })
  )
)

(define-read-only (get-voter-info (id uint))
  (map-get? UserVotes id)
)

;; MIA vote calculation
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-mia-vote (userId uint) (scaled bool))
  (let
    (
      ;; MAINNET: MIA cycle 80 / first block BTC 834,050 STX 142,301
      ;; cycle 2 / u4500 used in tests
      (cycle80Hash (unwrap! (get-block-hash u4500) none))
      (cycle80Data (at-block cycle80Hash (contract-call? .ccd007-citycoin-stacking get-stacker MIA_ID u2 userId)))
      (cycle80Amount (get stacked cycle80Data))
      ;; MAINNET: MIA cycle 81 / first block BTC 836,150 STX 143,989
      ;; cycle 3 / u6600 used in tests
      (cycle81Hash (unwrap! (get-block-hash u6600) none))
      (cycle81Data (at-block cycle81Hash (contract-call? .ccd007-citycoin-stacking get-stacker MIA_ID u3 userId)))
      (cycle81Amount (get stacked cycle81Data))
      ;; MIA vote calculation
      (avgStacked (/ (+ (scale-up cycle80Amount) (scale-up cycle81Amount)) u2))
      (scaledVote (/ (* avgStacked MIA_SCALE_FACTOR) MIA_SCALE_BASE))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle80Amount u0) (> cycle81Amount u0)) none)
    ;; return scaled or unscaled value
    (if scaled (some scaledVote) (some (/ scaledVote VOTE_SCALE_FACTOR)))
  )
)

;; NYC vote calculation
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-nyc-vote (userId uint) (scaled bool))
  (let
    (
      ;; NYC cycle 80 / first block BTC 834,050 STX 142,301
      ;; cycle 2 / u4500 used in tests
      (cycle80Hash (unwrap! (get-block-hash u4500) none))
      (cycle80Data (at-block cycle80Hash (contract-call? .ccd007-citycoin-stacking get-stacker NYC_ID u2 userId)))
      (cycle80Amount (get stacked cycle80Data))
      ;; NYC cycle 81 / first block BTC 836,150 STX 143,989
      ;; cycle 3 / u6600 used in tests
      (cycle81Hash (unwrap! (get-block-hash u6600) none))
      (cycle81Data (at-block cycle81Hash (contract-call? .ccd007-citycoin-stacking get-stacker NYC_ID u3 userId)))
      (cycle81Amount (get stacked cycle81Data))
      ;; NYC vote calculation
      (scaledVote (/ (+ (scale-up cycle80Amount) (scale-up cycle81Amount)) u2))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle80Amount u0) (> cycle81Amount u0)) none)
    ;; return scaled or unscaled value
    (if scaled (some scaledVote) (some (/ scaledVote VOTE_SCALE_FACTOR)))
  )
)

;; PRIVATE FUNCTIONS

;; update city vote map
(define-private (update-city-votes (cityId uint) (voteAmount uint) (vote bool) (changedVote bool))
  (let
    (
      (cityRecord (default-to 
        { totalAmountYes: u0, totalAmountNo: u0, totalVotesYes: u0, totalVotesNo: u0 }
        (map-get? CityVotes cityId)))
    )
    ;; do not record if amount is 0
    (asserts! (> voteAmount u0) false)
    ;; handle vote
    (if vote
      ;; handle yes vote
      (map-set CityVotes cityId {
        totalAmountYes: (+ voteAmount (get totalAmountYes cityRecord)),
        totalVotesYes: (+ u1 (get totalVotesYes cityRecord)),
        totalAmountNo: (if changedVote (- (get totalAmountNo cityRecord) voteAmount) (get totalAmountNo cityRecord)),
        totalVotesNo: (if changedVote (- (get totalVotesNo cityRecord) u1) (get totalVotesNo cityRecord)) 
      })
      ;; handle no vote
      (map-set CityVotes cityId {
        totalAmountYes: (if changedVote (- (get totalAmountYes cityRecord) voteAmount) (get totalAmountYes cityRecord)),
        totalVotesYes: (if changedVote (- (get totalVotesYes cityRecord) u1) (get totalVotesYes cityRecord)),
        totalAmountNo: (+ voteAmount (get totalAmountNo cityRecord)),
        totalVotesNo: (+ u1 (get totalVotesNo cityRecord)), 
      })
    )
  )
)

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
