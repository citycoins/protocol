;; Title: CCD015 - MiamiCoin Redemption Book, STX-denominated (MIA)
;; Version: 0.1.0 (DRAFT - unaudited, not deployed)
;; Summary: Vault-converted STX crosses a book of MIA sell offers at or below par; the MIA bought is burned.
;; Description:
;;   Solution 2's book. A fork of SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22
;;   .mia-fair-faktory-v2 (in production against ccd013 since cycle 138),
;;   reusing its sorted offer book, insertion sort, and frontier partial fill.
;;   Three changes turn a settler marketplace into a DAO retirement mechanism:
;;
;;   1. THE CONTRACT IS THE ONLY BUYER. Upstream, a settler spends their own STX
;;      and receives the par-equivalent MIA, keeping the book's surplus in the
;;      contract. Here `cross-book` spends only the STX this contract already
;;      holds - pushed in by the ccd016 one-way vault after it converts the
;;      DAO's sBTC rewards. Anyone may trigger it, and it takes no arguments:
;;      funding is a plain transfer in, the budget IS the balance.
;;   2. MIA IS BURNED, not delivered. No settler leg, no surplus accounting,
;;      no seeding - everything acquired leaves supply permanently.
;;   3. PAR IS THE DAO'S SNAPSHOT, not ccd013's frozen ratio. The same
;;      formula-locked `update-par` as ccd015: a proposal decides WHEN par
;;      moves, never WHAT it moves to. Asks are in uSTX, so the par check is a
;;      direct comparison - no native price, no oracle, nothing to calibrate.
;;      This is Solution 2's simplification: execution quality at the vault
;;      replaced the oracle the sats-denominated book needs.
;;
;;   Offers are gated at or below par at placement AND at cross time, so a
;;   par refresh between rounds can never strand the book above the ceiling.
;;
;;   Accounting: a fill BURNS MIA AT PAR - extinguishing a claim worth
;;   (par * amount) on the STX treasury - while PAYING ONLY the uSTX ask.
;;   Because the payment is converted yield and never debits the STX treasury,
;;   T is unchanged and only supply shrinks:
;;
;;       par_before = T / S        par_after = T / (S - burned)
;;
;;   So the full (par * amount) of retired claim accrues to holders who did not
;;   sell. The ask discount does not create that surplus; it sets how much MIA
;;   is retired per uSTX of yield - which is why the book fills cheapest first.

;; TRAITS

;; Every principal in this file is a fully qualified mainnet address - trait,
;; base-dao, treasuries, tokens - exactly like deployed ccd013, which lives at
;; a different address than the DAO it serves. The file as written IS the
;; mainnet artifact: no qualification pass at deployment, deployable from any
;; address.

(impl-trait 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.extension-trait.extension-trait)

;; CONSTANTS

;; error codes
(define-constant ERR_UNAUTHORIZED (err u15000))
(define-constant ERR_INVALID_OFFER (err u15001))
(define-constant ERR_OFFER_NOT_FOUND (err u15002))
(define-constant ERR_BOOK_FULL (err u15003))
(define-constant ERR_HAS_OFFER (err u15004))
(define-constant ERR_BELOW_MIN_DEPOSIT (err u15005))
(define-constant ERR_NO_FILL (err u15006))
(define-constant ERR_PAUSED (err u15007))
(define-constant ERR_ABOVE_PAR (err u15008))
(define-constant ERR_NO_BUDGET (err u15010))
(define-constant ERR_PAR_NOT_SET (err u15011))
(define-constant ERR_PAR_CALCULATION (err u15012))

(define-constant MICRO_CITYCOINS (pow u10 u6)) ;; MIA v2 carries 6 decimals
(define-constant ONE_MILLION_MIA (* u1000000 MICRO_CITYCOINS))
(define-constant MAX_OFFERS u50)
(define-constant MAX_ASK u1000000000000000)
;; Per-offer ceiling, as in the production book: keeps one seller from parking
;; a position that soaks the crossing budget round after round - the queue
;; stays competitive across many sellers. Enforced in change-offer too, so an
;; offer cannot grow past it.
(define-constant MAX_PER_TRANSACTION (* u10000000 MICRO_CITYCOINS)) ;; 10M MIA

;; Offers, burns, and transfers are v2 only (v1 was migrated out by CCIP-013).
;; v1 appears in exactly one place: the par formula's supply denominator, which
;; the DAO ratified as combined v1 + v2 supply (see ccd013 initialize-redemption).
(define-constant MIA_TOKEN_V2 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2)

;; The same treasury principals ccd014-pox5-staking-mia and the sats book hard-code,
;; kept under the same names so the contracts read as one system.
;; STX backing the par formula counts, alongside the pox5 stake
(define-constant MINING_TREASURY 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3)
;; the pox5 staking contract CCIP-027 moved the mining treasury into
(define-constant POX5_STAKING 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia)

;; --- par -------------------------------------------------------------------
;; Same model as ccd015: `update-par` (DAO-gated) commits the ratified
;; formula's output - total STX backing over combined v1+v2 supply - scaled by
;; PAR_SCALE. Frozen between DAO actions, refreshed between rounds by proposal,
;; never settable to an arbitrary number. Starts at u0: the book accepts no
;; offers and cannot cross until the DAO commits an initial par, because
;; sellers cannot price an ask against a par that does not exist yet.
(define-constant PAR_SCALE (pow u10 u8))

;; DATA VARS

(define-data-var paused bool false)
(define-data-var min-deposit uint (* u100000 MICRO_CITYCOINS))

;; See the par section above. u0 until the DAO commits the first snapshot.
(define-data-var par-scaled uint u0)

(define-data-var offer-book
  (list 50 { owner: principal, amount: uint, ustx: uint })
  (list)
)
(define-data-var target-owner principal 'SP000000000000000000002Q6VF78)

(define-data-var total-burned-mia uint u0)
(define-data-var total-spent-ustx uint u0)

;; PUBLIC FUNCTIONS

(define-public (is-dao-or-extension)
  (ok (asserts! (or
    (is-eq tx-sender 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao)
    (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao
      is-extension contract-caller
    )) ERR_UNAUTHORIZED
  ))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

;; --- DAO configuration -----------------------------------------------------

(define-public (set-paused (pause bool))
  (begin
    (try! (is-dao-or-extension))
    (var-set paused pause)
    (ok (print { notification: "set-paused", payload: { paused: pause } }))
  )
)

(define-public (set-min-deposit (amount uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (> amount u0) ERR_INVALID_OFFER)
    (var-set min-deposit amount)
    (ok (print { notification: "set-min-deposit", payload: { min-deposit: amount } }))
  )
)

;; Commit the ratified formula's current output as the fixed par. Serves both
;; initialization and the between-rounds refresh; being formula-locked, a
;; proposal can decide WHEN par moves but never WHAT it moves to.
(define-public (update-par)
  (let ((snapshot (unwrap! (calculate-par) ERR_PAR_CALCULATION)))
    (try! (is-dao-or-extension))
    (asserts! (> snapshot u0) ERR_PAR_CALCULATION)
    (var-set par-scaled snapshot)
    (ok (print { notification: "update-par", payload: {
      par-scaled: snapshot,
      treasury-ustx: (get-treasury-balance),
      supply: (get-mia-total-supply),
    } }))
  )
)

;; --- offer book (sellers) --------------------------------------------------

(define-public (place-offer (amount uint) (ask-ustx uint))
  (let (
      (owner tx-sender)
      (nrec { owner: owner, amount: amount, ustx: ask-ustx })
      (book (var-get offer-book))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (>= amount (var-get min-deposit)) ERR_BELOW_MIN_DEPOSIT)
    (asserts! (<= amount MAX_PER_TRANSACTION) ERR_INVALID_OFFER)
    (asserts! (and (> ask-ustx u0) (<= ask-ustx MAX_ASK)) ERR_INVALID_OFFER)
    (asserts! (> (var-get par-scaled) u0) ERR_PAR_NOT_SET)
    (asserts! (at-or-below-par? amount ask-ustx) ERR_ABOVE_PAR)
    (var-set target-owner owner)
    (asserts! (is-eq (len (filter is-target-owner book)) u0) ERR_HAS_OFFER)
    (try! (contract-call? MIA_TOKEN_V2 transfer amount owner current-contract none))
    (let (
        (base (if (is-eq (len book) MAX_OFFERS)
          (let ((worst (unwrap-panic (element-at? book (- (len book) u1)))))
            ;; a full book only accepts a strictly better price, evicting the worst
            (asserts!
              (< (* ask-ustx (get amount worst)) (* (get ustx worst) amount))
              ERR_BOOK_FULL)
            (try! (refund-rec worst))
            (var-set target-owner (get owner worst))
            (filter not-target-owner book)
          )
          book
        ))
        (res (fold insert-step base { nrec: nrec, out: (list), placed: false }))
      )
      (var-set offer-book
        (if (get placed res) (get out res) (push-rec (get out res) nrec)))
    )
    (print { notification: "place-offer", payload: nrec })
    (ok true)
  )
)

(define-public (change-offer (add-amount (optional uint)) (new-ask-ustx uint))
  (let (
      (owner tx-sender)
      (adding (default-to u0 add-amount))
      (book (var-get offer-book))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (and (> new-ask-ustx u0) (<= new-ask-ustx MAX_ASK)) ERR_INVALID_OFFER)
    (var-set target-owner owner)
    (let (
        (mine (filter is-target-owner book))
        (cur (unwrap! (element-at? mine u0) ERR_OFFER_NOT_FOUND))
        (namount (+ (get amount cur) adding))
        (nrec { owner: owner, amount: namount, ustx: new-ask-ustx })
        (rest (filter not-target-owner book))
      )
      (asserts! (>= namount (var-get min-deposit)) ERR_BELOW_MIN_DEPOSIT)
      (asserts! (<= namount MAX_PER_TRANSACTION) ERR_INVALID_OFFER)
      (asserts! (at-or-below-par? namount new-ask-ustx) ERR_ABOVE_PAR)
      (and (> adding u0)
        (try! (contract-call? MIA_TOKEN_V2 transfer adding owner current-contract none)))
      (let ((res (fold insert-step rest { nrec: nrec, out: (list), placed: false })))
        (var-set offer-book
          (if (get placed res) (get out res) (push-rec (get out res) nrec)))
      )
      (print { notification: "change-offer", payload: nrec })
      (ok true)
    )
  )
)

(define-public (cancel-offer)
  (let ((book (var-get offer-book)))
    (var-set target-owner tx-sender)
    (let ((mine (filter is-target-owner book)))
      (asserts! (> (len mine) u0) ERR_OFFER_NOT_FOUND)
      (try! (refund-rec (unwrap-panic (element-at? mine u0))))
      (var-set offer-book (filter not-target-owner book))
    )
    (print { notification: "cancel-offer", payload: { owner: tx-sender } })
    (ok true)
  )
)

;; --- crossing (the DAO side) ----------------------------------------------

;; Spend the contract's own STX against the book, cheapest first, skipping
;; anything above par, then burn everything acquired.
;; Permissionless to CALL but not to fund: the STX allowance is bounded by the
;; contract's own balance, so a caller can only ever trigger retirement using
;; funds already committed here. There is nothing to extract - the MIA does not
;; go to the caller, it is burned. Unlike the upstream settler model, the payer
;; is this contract, so a resting seller may safely be the caller.
(define-public (cross-book)
  (let ((budget (stx-get-balance current-contract)))
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (> budget u0) ERR_NO_BUDGET)
    (asserts! (> (var-get par-scaled) u0) ERR_PAR_NOT_SET)
    (let (
        ;; as-contract? switches tx-sender to this contract so settle-step can
        ;; pay from current-contract, and caps total STX out at `budget` - a
        ;; runtime backstop that holds even if the fill arithmetic is wrong.
        (res (try! (as-contract? ((with-stx budget))
              (fold settle-step (var-get offer-book) {
                remaining: budget,
                spent: u0,
                acquired: u0,
                kept: (list),
              }))))
        (acquired (get acquired res))
        (spent (get spent res))
      )
      (asserts! (> acquired u0) ERR_NO_FILL)
      (var-set offer-book (get kept res))
      ;; permanently out of supply - this is the whole point
      (try! (as-contract? ((with-ft MIA_TOKEN_V2 "miamicoin" acquired))
        (try! (contract-call? MIA_TOKEN_V2 burn acquired current-contract))))
      (var-set total-burned-mia (+ (var-get total-burned-mia) acquired))
      (var-set total-spent-ustx (+ (var-get total-spent-ustx) spent))
      (print { notification: "cross-book", payload: {
        spent: spent,
        acquired: acquired,
        remaining-ustx: (get remaining res),
        offer-count: (len (var-get offer-book)),
      } })
      (ok { spent: spent, acquired: acquired })
    )
  )
)

;; READ ONLY FUNCTIONS

;; Is `ask` uSTX for `amount` micro-MIA at or below par? Direct comparison -
;; both sides are STX-denominated, so no price bridge is needed:
;;   ask <= amount * par-scaled / PAR_SCALE
;; cross-multiplied to avoid a truncating division:
;;   ask * PAR_SCALE <= amount * par-scaled
;; "At or below" matches the production book and the CCIP text; buying at par
;; still accretes to holders because payment is yield, never treasury STX.
(define-read-only (at-or-below-par? (amount uint) (ask uint))
  (<= (* ask PAR_SCALE) (* amount (var-get par-scaled)))
)

;; Par value of `amount` micro-MIA, in uSTX.
(define-read-only (get-par-ustx (amount uint))
  (/ (* amount (var-get par-scaled)) PAR_SCALE)
)

;; The committed par expressed the way it was ratified: uSTX per 1,000,000 MIA.
(define-read-only (get-par-ustx-per-1m-mia)
  (/ (* ONE_MILLION_MIA (var-get par-scaled)) PAR_SCALE)
)

(define-read-only (get-par-scaled)
  (var-get par-scaled)
)

(define-read-only (get-offer-book) (var-get offer-book))

(define-read-only (get-offer-count) (len (var-get offer-book)))

(define-read-only (get-offer (owner principal))
  (get found (fold find-owner-step (var-get offer-book) { target: owner, found: none })))

(define-read-only (get-book-totals)
  (fold sum-step (var-get offer-book) { ustx: u0, amount: u0 })
)

;; Live STX backing per micro-MIA, scaled by PAR_SCALE - the ratified formula.
;; Advisory until `update-par` commits its output as the fixed par.
(define-read-only (calculate-par)
  (let (
      (treasury-ustx (get-treasury-balance))
      (supply (get-mia-total-supply))
    )
    (if (or (is-eq supply u0) (is-eq treasury-ustx u0))
      none
      (some (/ (* treasury-ustx PAR_SCALE) supply))
    )
  )
)

;; The mining treasury, exactly as ccd013's ratified formula scopes it - just
;; followed to where the funds now sit. ccd013 reads mining-v3 via stx-account
;; (locked plus unlocked); CCIP-027 moved that treasury into
;; ccd014-pox5-staking-mia, where it stacks under PoX-5, so this reads both.
;; stx-account rather than stx-get-balance because the stacked STX is locked -
;; a plain balance read sees it as zero.
(define-read-only (get-treasury-balance)
  (let (
      (mining-v3 (stx-account MINING_TREASURY))
      (staked (stx-account POX5_STAKING))
    )
    (+
      (get locked mining-v3)
      (get unlocked mining-v3)
      (get locked staked)
      (get unlocked staked)
    )
  )
)

;; Combined v1 + v2 supply, exactly as ccd013's initialize-redemption counts it:
;; v1 carries no decimals so it is scaled to micro before adding v2 (6 decimals).
;; Literal principals, not constants: a contract-call? through a constant cannot
;; be statically resolved, so the checker assumes it may write and rejects it
;; inside define-read-only.
(define-read-only (get-mia-total-supply)
  (+
    (* MICRO_CITYCOINS (unwrap-panic (contract-call?
      'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token get-total-supply)))
    (unwrap-panic (contract-call?
      'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2 get-total-supply))
  )
)

(define-read-only (get-info)
  {
    paused: (var-get paused),
    min-deposit: (var-get min-deposit),
    offer-count: (len (var-get offer-book)),
    par-scaled: (var-get par-scaled),
    calculated-par: (calculate-par),
    ;; the crossing budget: STX already pushed in by the ccd016 vault
    budget-ustx: (stx-get-balance current-contract),
    total-burned-mia: (var-get total-burned-mia),
    total-spent-ustx: (var-get total-spent-ustx),
  }
)

;; PRIVATE FUNCTIONS

(define-private (push-rec
    (lst (list 50 { owner: principal, amount: uint, ustx: uint }))
    (r { owner: principal, amount: uint, ustx: uint })
  )
  (unwrap-panic (as-max-len? (append lst r) u50))
)

(define-private (is-target-owner (r { owner: principal, amount: uint, ustx: uint }))
  (is-eq (get owner r) (var-get target-owner)))
(define-private (not-target-owner (r { owner: principal, amount: uint, ustx: uint }))
  (not (is-eq (get owner r) (var-get target-owner))))

(define-private (find-owner-step
    (r { owner: principal, amount: uint, ustx: uint })
    (acc { target: principal, found: (optional { owner: principal, amount: uint, ustx: uint }) })
  )
  (if (is-eq (get owner r) (get target acc))
    (merge acc { found: (some r) })
    acc
  )
)

(define-private (sum-step
    (r { owner: principal, amount: uint, ustx: uint })
    (acc { ustx: uint, amount: uint })
  )
  { ustx: (+ (get ustx acc) (get ustx r)), amount: (+ (get amount acc) (get amount r)) }
)

(define-private (refund-rec (r { owner: principal, amount: uint, ustx: uint }))
  (as-contract? ((with-ft MIA_TOKEN_V2 "miamicoin" (get amount r)))
    (try! (contract-call? MIA_TOKEN_V2 transfer (get amount r) current-contract (get owner r) none)))
)

;; Keeps the book sorted ascending by price (ustx/amount), compared by
;; cross-multiplication so no division truncates the ordering.
(define-private (insert-step
    (entry { owner: principal, amount: uint, ustx: uint })
    (acc {
      nrec: { owner: principal, amount: uint, ustx: uint },
      out: (list 50 { owner: principal, amount: uint, ustx: uint }),
      placed: bool,
    })
  )
  (let (
      (nrec (get nrec acc))
      (nask (get ustx nrec))
      (numia (get amount nrec))
      (eask (get ustx entry))
      (eumia (get amount entry))
    )
    (if (and (not (get placed acc)) (< (* nask eumia) (* eask numia)))
      (merge acc { out: (push-rec (push-rec (get out acc) nrec) entry), placed: true })
      (merge acc { out: (push-rec (get out acc) entry) })
    )
  )
)

;; Runs inside cross-book's as-contract?, so tx-sender is this contract and the
;; STX allowance caps total payout at the budget. The par re-check makes a par
;; refresh between placement and cross harmless: anything the new par no longer
;; admits is kept, not filled. Frontier partial fill as in the production book:
;; `taken` floors, so the owner is paid `remaining` for slightly less than
;; pro-rata MIA (never worse than their ask), and the leftover record's implied
;; price is <= its original price <= par, preserving both the par invariant and
;; the ascending sort. After a partial, remaining is u0, so no later (pricier)
;; offer can jump the queue - strict price priority.
(define-private (settle-step
    (entry { owner: principal, amount: uint, ustx: uint })
    (acc {
      remaining: uint,
      spent: uint,
      acquired: uint,
      kept: (list 50 { owner: principal, amount: uint, ustx: uint }),
    })
  )
  (let (
      (remaining (get remaining acc))
      (ask (get ustx entry))
      (amount (get amount entry))
    )
    ;; par is the hard ceiling: above it, the DAO does not buy
    (if (not (at-or-below-par? amount ask))
      (merge acc { kept: (push-rec (get kept acc) entry) })
      (if (>= remaining ask)
        (begin
          (unwrap-panic (stx-transfer? ask current-contract (get owner entry)))
          (merge acc {
            remaining: (- remaining ask),
            spent: (+ (get spent acc) ask),
            acquired: (+ (get acquired acc) amount),
          })
        )
        ;; marginal offer fills partially and the remainder stays on the book
        (let ((taken (/ (* amount remaining) ask)))
          (if (> taken u0)
            (begin
              (unwrap-panic (stx-transfer? remaining current-contract (get owner entry)))
              (merge acc {
                remaining: u0,
                spent: (+ (get spent acc) remaining),
                acquired: (+ (get acquired acc) taken),
                kept: (push-rec (get kept acc)
                  (merge entry {
                    amount: (- amount taken),
                    ustx: (- ask remaining),
                  })),
              })
            )
            (merge acc { kept: (push-rec (get kept acc) entry) })
          )
        )
      )
    )
  )
)
