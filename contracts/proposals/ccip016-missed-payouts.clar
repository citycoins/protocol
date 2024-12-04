;; TRAITS

(impl-trait .proposal-trait.proposal-trait)
(impl-trait .ccip015-trait.ccip015-trait)

;; ERRORS

(define-constant ERR_PANIC (err u16000))
(define-constant ERR_SAVING_VOTE (err u16001))
(define-constant ERR_VOTED_ALREADY (err u16002))
(define-constant ERR_NOTHING_STACKED (err u16003))
(define-constant ERR_USER_NOT_FOUND (err u16004))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u16005))
(define-constant ERR_PROPOSAL_STILL_ACTIVE (err u16006))
(define-constant ERR_VOTE_FAILED (err u16007))

;; CONSTANTS

(define-constant SELF (as-contract tx-sender))
(define-constant CCIP_016 {
  name: "Refund Incorrect CCD007 Payouts",
  link: "https://github.com/citycoins/governance/blob/feat/add-ccip-016/ccips/ccip-016/ccip-016-refund-incorrect-ccd007-payouts.md",
  hash: "",
})
;; set city ID
(define-constant MIA_ID (default-to u1 (contract-call? .ccd004-city-registry get-city-id "mia")))
(define-constant NYC_ID (default-to u2 (contract-call? .ccd004-city-registry get-city-id "nyc")))

(define-constant VOTE_SCALE_FACTOR (pow u10 u16)) ;; 16 decimal places
(define-constant MIA_SCALE_BASE (pow u10 u4)) ;; 4 decimal places
(define-constant MIA_SCALE_FACTOR u8916) ;; 0.8916 or 89.16%

;; DATA VARS

;; vote block heights
(define-data-var voteActive bool true)
(define-data-var voteStart uint u0)
(define-data-var voteEnd uint u0)

;; start the vote when deployed
(var-set voteStart block-height)
;; vote tracking
(define-data-var yesVotes uint u0)
(define-data-var yesTotal uint u0)
(define-data-var noVotes uint u0)
(define-data-var noTotal uint u0)

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
    (try! (pay-all-rewards))
    (ok true))
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
          (miaVoteAmount (scale-down (default-to u0 (get-vote MIA_ID voterId true))))
          (nycVoteAmount (scale-down (default-to u0 (get-vote NYC_ID voterId true))))
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
  (some CCIP_016)
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
      ;; MAINNET: MIA cycle 82 / first block BTC 838,250 STX 145,643
      ;; cycle 2 / u4500 used in tests
      (cycle82Hash (unwrap! (get-block-hash u4500) none))
      (cycle82Data (at-block cycle82Hash (contract-call? .ccd007-citycoin-stacking get-stacker MIA_ID u2 userId)))
      (cycle82Amount (get stacked cycle82Data))
      ;; MAINNET: MIA cycle 83 / first block BTC 840,350 STX 147,282
      ;; cycle 3 / u6600 used in tests
      (cycle83Hash (unwrap! (get-block-hash u6600) none))
      (cycle83Data (at-block cycle83Hash (contract-call? .ccd007-citycoin-stacking get-stacker MIA_ID u3 userId)))
      (cycle83Amount (get stacked cycle83Data))
      ;; MIA vote calculation
      (scaledVote (/ (+ (scale-up cycle82Amount) (scale-up cycle83Amount)) u2))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle82Amount u0) (> cycle83Amount u0)) none)
    ;; return scaled or unscaled value
    (if scaled (some scaledVote) (some (/ scaledVote VOTE_SCALE_FACTOR)))
  )
)

;; vote calculation
;; returns (some uint) or (none)
;; optionally scaled by VOTE_SCALE_FACTOR (10^6)
(define-read-only (get-vote (cityId uint) (userId uint) (scaled bool))
  (let
    (
      ;; MAINNET: cycle 82 / first block BTC 838,250 STX 145,643
      ;; cycle 2 / u4500 used in tests
      (cycle82Hash (unwrap! (get-block-hash u4500) none))
      (cycle82Data (at-block cycle82Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u2 userId)))
      (cycle82Amount (get stacked cycle82Data))
      ;; MAINNET: cycle 83 / first block BTC 840,350 STX 147,282
      ;; cycle 3 / u6600 used in tests
      (cycle83Hash (unwrap! (get-block-hash u6600) none))
      (cycle83Data (at-block cycle83Hash (contract-call? .ccd007-citycoin-stacking get-stacker cityId u3 userId)))
      (cycle83Amount (get stacked cycle83Data))
      ;; vote calculation
      (scaledVote (/ (+ (scale-up cycle82Amount) (scale-up cycle83Amount)) u2))
    )
    ;; check that at least one value is positive
    (asserts! (or (> cycle82Amount u0) (> cycle83Amount u0)) none)
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
    (if (> voteAmount u0)
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
      ;; ignore calls with vote amount equal to 0
      false)
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

(define-private (pay-all-rewards)
  (begin
  ;; MIA
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u30487 'SP32VE3A2AXWPGT7HH4B76005TJZQK7CF1MM9R0MD))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u332545167 'SP1XHV60VPS13DYRN0HEYG8GYYA1S6QF90AXJ0NQR))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u66509033 'SP30A13XJEHMK81JVEHMS0FEHFENS1W5KEEFYJDVM))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u13301806 'SP1FV4FZ8D32S7GKYRPFWK6YHRJE5BZEYKABK72Q3))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u2261 'SP3B1TPV7Z1767ZQ01RW93HRYR88ZQFX9M7NNXT3V))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u11971626 'SP33HRM920VHATSFNQ455WMKW9KCT74A5GT8280TB))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u332545 'SPEW3AKP366Y0CY2322M6BWQY0C00JZAG59EP93C))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u3120065 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u3827795 'SP28R593JKNFH8PTWNECR84A83EESKC3CC5P826R5))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u14209396 'SP3PX186AERH9CD2A2R73KJYGX79EXHJP23RFGCZ4))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u304010 'SP2JDKWQ77WN7S0PRCS872HFJ21ZT78P6G1WCW2B))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u50387930 'SP16BC59Y29FYZPP7WF8QB376STCVW33W4J9BWP06))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u12507392 'SP28R593JKNFH8PTWNECR84A83EESKC3CC5P826R5))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u100775860 'SP2JCF3ME5QC779DQ2X1CM9S62VNJF44GC23MKQXK))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u11464259 'SP3YJ9487PS0JDDYBBVH0RW3JPY48V0A86PQGDA6V))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u17149984 'SP3NX54B0VA0G002FBJE44C1ZJTV7F34VTPS7NB4J))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1705078 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u312186 'SP19PMPW8J540BTF9S2D4J7W3RBB5CZM28P1BK573))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u71986915 'SP2Q8TC8QK1QGQEJFT24S4GBD6TQJ0HDC17RWNDQ8))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u11170529 'SP1ADC8EX6BRGEZVGGHJR44FYVSSD9VRA2JSHZ70B))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u13137459 'SP2DP70FRC4FFCZR5B2F6S112NK79WAFWHCWPYKQZ))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u539736 'SP2DP70FRC4FFCZR5B2F6S112NK79WAFWHCWPYKQZ))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u273278 'SP3WBYAEWN0JER1VPBW8TRT1329BGP9RGC5S2519W))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1470550 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1047119 'SP3CHC5CKZGPZ3W4Q4JASMM5ZSMD3P7TQWNSE6BQ8))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1961478 'SP2Q8TC8QK1QGQEJFT24S4GBD6TQJ0HDC17RWNDQ8))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u2144033 'SP1SYW6GETS33ZDY40N502NK8014KM4BTQ4RE4FS1))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u3848617 'SP3B1TPV7Z1767ZQ01RW93HRYR88ZQFX9M7NNXT3V))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u249741 'SP19PMPW8J540BTF9S2D4J7W3RBB5CZM28P1BK573))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u17617546 'SP2GGT4HSMSGS5XPEYHCAJTB7HJBPTMHJJ0MBSGHP))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u328364 'SP30V7ZYEGGY0WQ6EJYZ040V3VHF4234FSTHP128D))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u9293346 'SP1ADC8EX6BRGEZVGGHJR44FYVSSD9VRA2JSHZ70B))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u17747744 'SP2W4B3KR2PYA980C4DFACT6K4MG6Z0DPT6X4CWH7))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u9104521 'SP2DP70FRC4FFCZR5B2F6S112NK79WAFWHCWPYKQZ))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1234791 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u643815 'SP22YMFBE5CN1KGCHQDGZ06FF7B3HYFVN92P6Y5X9))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u57803059 'SP3F0GZC9WG53MH7SHMFVSM54XKNNHQXJ8Q301GQ7))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u15764470 'SPR51QGAQ1QKCZ8YBJFHKVMTS6Z858BV20QY0819))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u240529 'SP19PMPW8J540BTF9S2D4J7W3RBB5CZM28P1BK573))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u47293 'SP245RKH32CE9JPM26XKM4S0EVX3J17ANA595GA2Y))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u185159124 'SP32D4KF64M0FQQK267W8PA08SDXG00DNBB3WCXKT))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u1728757 'SP3BNAH4NPD79KWTABW4GH6QMQ10V34T8MMM39ZYP))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u14721 'SP2YM5DT3RG8BBD10C59V3AGVTN66GKQ1A91T85Q4))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u2920272 'SP1BN2V664W50A1HAWDHT2M83M3NMN0AG3B16R2SA))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u736087 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u2327221 'SPVWPTGBEWVQ58J1RDNZQ34TMCRVF49RRFRKXC0Q))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u133699 'SP2VKCNC1M54EENQT3TWC4D974XRM4519YHKR24PK))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u852515 'SP2W4B3KR2PYA980C4DFACT6K4MG6Z0DPT6X4CWH7))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u15597806 'SPR51QGAQ1QKCZ8YBJFHKVMTS6Z858BV20QY0819))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u424122 'SPPYQ5TW7PWMNKHVNG194MACDAEGA1759D5DC7YA))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-stacking withdraw-stx u4447404 'SP2GGT4HSMSGS5XPEYHCAJTB7HJBPTMHJJ0MBSGHP))

  ;; NYC
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u6078877 'SP32VE3A2AXWPGT7HH4B76005TJZQK7CF1MM9R0MD))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u150434320 'SP2FSM29506QZYKJMFGNTAF2V6Q58K2Y61DDT7Y0F))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u186868155 'SP59S3H7BRN23JR7BHHGK64CB8393BP1W2KCBZQW))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u5588858 'SP3JYDFHTNVTDWFDMNG6A3RPCAAJ5NT17EMGP8AQD))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u34919806 'SP3Z6SRQ0AEK2X6P7J0C1FWEC7A7Y1QH01SY407BB))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u283133568 'SP30A13XJEHMK81JVEHMS0FEHFENS1W5KEEFYJDVM))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u61750 'SP3WBYAEWN0JER1VPBW8TRT1329BGP9RGC5S2519W))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u2559494 'SP28R593JKNFH8PTWNECR84A83EESKC3CC5P826R5))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u19374526 'SP3PX186AERH9CD2A2R73KJYGX79EXHJP23RFGCZ4))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u9221089 'SP1HYMMTAYXBX9WDJR9F66DCHBPK95HHSB0C1NZME))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u4326740 'SP28R593JKNFH8PTWNECR84A83EESKC3CC5P826R5))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u8359143 'SP1FV4FZ8D32S7GKYRPFWK6YHRJE5BZEYKABK72Q3))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u9036638 'SP1Q0GDNHDRJNKZZMXXCRCM8HNZ2JG8RPCD14W6P9))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u837173 'SP20N3V2AF88G9VM10VBX01TB5R16ATE53AGFKYPV))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u14944365 'SP3YJ9487PS0JDDYBBVH0RW3JPY48V0A86PQGDA6V))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u619696 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u59438599 'SP2Q8TC8QK1QGQEJFT24S4GBD6TQJ0HDC17RWNDQ8))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u7645004 'SP2JBE48HC13J68PCRK2KF3PCNZMCQGYTN955EEFT))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u14308090 'SP164MRYJSPBPDK5CT6QDNQ73G4AHNK7G6PNK96NK))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u72526154 'SP1FECFVC2H0GJPMDQNPEMGYTF2MG7NA1AH23BES0))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u56197282 'SP28YTTXCKEVQJX5VC0STK8CDHR9TF4TQ3CYAXHH5))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u531012 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u7507206 'SP222YH94GYEPJJ88R1XH5MVTG3KNHNRRXVTMRRB1))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u270709 'SP3CHC5CKZGPZ3W4Q4JASMM5ZSMD3P7TQWNSE6BQ8))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u321864 'SP1JGPW1B6QYT8R5QJSZAY6SYGN0Z94D1P4PEA5R6))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u307820 'SP1SYW6GETS33ZDY40N502NK8014KM4BTQ4RE4FS1))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u608335 'SP30V7ZYEGGY0WQ6EJYZ040V3VHF4234FSTHP128D))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u2174828 'SP245RKH32CE9JPM26XKM4S0EVX3J17ANA595GA2Y))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u441215 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u21564966 'SPR51QGAQ1QKCZ8YBJFHKVMTS6Z858BV20QY0819))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u2016145 'SP2D58ZHFVWMM3P0NPC4K254KH4SM5CM2Y7HJ269W))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u93054 'SP10150G7DRPETGFXZQWQ0WRCJ6XQV1MEMZP6BVNH))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u2192325 'SP31D7CHP0N8SVD89GMHYGBKHSXRESWZ9CW2JN6WP))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u138380581 'SP32D4KF64M0FQQK267W8PA08SDXG00DNBB3WCXKT))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u65119 'SPAFJV4RV0EFSB9FXT4BZ337FYDGVKA9H091WZMS))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u1012308 'SP3BE1XPT0QE75DT3BMTSGGAR6NA4Q1A5TBBYMCKF))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u24887300 'SP1BN2V664W50A1HAWDHT2M83M3NMN0AG3B16R2SA))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u262229 'SP3EXTHZ7PHAJ8DDJB7AMVQXDZ6T68364EZ01WB20))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u1324321 'SP31N22Y35NH8R7XQF2Q0WJ17JRTSG1RMKPS15DRS))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u4905613 'SPVWPTGBEWVQ58J1RDNZQ34TMCRVF49RRFRKXC0Q))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u7459918 'SP31N22Y35NH8R7XQF2Q0WJ17JRTSG1RMKPS15DRS))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u895481 'SP2H4HFERWC4208VW51BPGT9C2J74MT1W5JDBGZAZ))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u9720455 'SPR51QGAQ1QKCZ8YBJFHKVMTS6Z858BV20QY0819))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u3757364 'SP1JGPW1B6QYT8R5QJSZAY6SYGN0Z94D1P4PEA5R6))
  (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-nyc-stacking withdraw-stx u1012308 'SP3BE1XPT0QE75DT3BMTSGGAR6NA4Q1A5TBBYMCKF))
  (ok true)
  )
)