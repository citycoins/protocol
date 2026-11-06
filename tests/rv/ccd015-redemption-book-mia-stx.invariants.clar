;; ============================================================================
;; RENDEZVOUS INVARIANTS for ccd015-redemption-book-mia-stx (the STX book)
;; ============================================================================
;; Append-only block; tests/rv/build.sh binds MIA v2 / v1 to mocks, the par
;; formula's two STX accounts to funded simnet wallets, the DAO gate to the
;; deployer account, and the minimum deposit to 1000 micro-MIA (100k MIA is
;; above every natural RV draws). Everything else is the production book:
;; par snapshot, placement gates, sorted insertion, eviction on a full book,
;; change / cancel, cross-book cheapest-first with the frontier partial fill
;; and the burn.
;;
;; The budget is the book's own STX balance: rv-fund puts STX in the way
;; the ccd016 vault does, and counts it, so the STX side can be conserved.
;; ============================================================================

(define-map context (string-ascii 100) { called: uint })

(define-private (update-context (function-name (string-ascii 100)) (called uint))
  (ok (map-set context function-name { called: called })))

(define-constant RV-ACCOUNTS (list
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
  'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC
  'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND
  'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB
  'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0
  'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ
  'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP
  'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6))

(define-data-var rv-funded uint u0)

;; ---------------------------------------------------------------------------
;; wrappers
;; ---------------------------------------------------------------------------

;; the vault's push: STX in, no strings attached
(define-public (rv-fund (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender current-contract))
    (var-set rv-funded (+ (var-get rv-funded) amount))
    (ok true)))

;; fuzz aid: one random set-min-deposit by the DAO account (a natural up to
;; 2^31) would refuse every later offer for the rest of the sweep
(define-public (rv-reset-min)
  (ok (var-set min-deposit u1000)))

;; an offer sized at or over the minimum, so placement reaches the par and
;; book gates instead of ERR_BELOW_MIN_DEPOSIT
(define-public (rv-place (amount uint) (ask uint))
  (place-offer (+ (var-get min-deposit) amount) ask))

;; ---------------------------------------------------------------------------
;; readers
;; ---------------------------------------------------------------------------

(define-private (rv-sorted-step
    (r { owner: principal, amount: uint, ustx: uint })
    (acc { prev: (optional { owner: principal, amount: uint, ustx: uint }), sorted: bool }))
  (let ((still (match (get prev acc)
      p (<= (* (get ustx p) (get amount r)) (* (get ustx r) (get amount p)))
      true)))
    { prev: (some r), sorted: (and (get sorted acc) still) }))

(define-private (rv-entry-ok (r { owner: principal, amount: uint, ustx: uint }))
  (and (> (get amount r) u0)
       (<= (get amount r) MAX_PER_TRANSACTION)
       (> (get ustx r) u0)
       (<= (get ustx r) MAX_ASK)))

(define-private (rv-has-offer (a principal))
  (is-some (get-offer a)))

;; ============================================================================
;; 1: the book is sorted ascending by price (ustx / amount), compared by
;; cross-multiplication. Insertion, eviction, change and the partial fill
;; all rebuild the list; any of them out of order breaks price priority.
;; ============================================================================

(define-read-only (invariant-book-sorted)
  (get sorted (fold rv-sorted-step (var-get offer-book) { prev: none, sorted: true })))

;; ============================================================================
;; 2: MIA CONSERVATION. The book's MIA balance equals the sum of the
;; amounts on the book: every placement moved its amount in, every cancel,
;; eviction and refund moved it out, every fill burned it.
;; ============================================================================

(define-read-only (invariant-mia-conserved)
  (is-eq (unwrap-panic (contract-call? .mock-mia get-balance current-contract))
         (get amount (get-book-totals))))

;; ============================================================================
;; 3: STX CONSERVATION. What came in through rv-fund minus what cross-book
;; paid out is what the book holds. The as-contract? allowance caps a fill
;; round at the budget; this checks the ledger against the counter.
;; ============================================================================

(define-read-only (invariant-stx-conserved)
  (is-eq (stx-get-balance current-contract)
         (- (var-get rv-funded) (var-get total-spent-ustx))))

;; ============================================================================
;; 4: what the book says it burned is what the token says was burned.
;; ============================================================================

(define-read-only (invariant-burned-matches-token)
  (is-eq (var-get total-burned-mia) (contract-call? .mock-mia get-burned)))

;; ============================================================================
;; 5: one offer per owner; 6: bounded; 7: every entry positive and inside
;; the per-offer caps (a partial fill leaves a positive remainder at a
;; price no worse than the original).
;; ============================================================================

(define-read-only (invariant-one-offer-per-owner)
  (is-eq (len (var-get offer-book)) (len (filter rv-has-offer RV-ACCOUNTS))))

(define-read-only (invariant-book-bounded)
  (<= (len (var-get offer-book)) MAX_OFFERS))

(define-read-only (invariant-entries-in-range)
  (is-eq (len (filter rv-entry-ok (var-get offer-book))) (len (var-get offer-book))))
