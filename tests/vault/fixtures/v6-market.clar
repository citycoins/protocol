(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-constant MAX_DEPOSITORS u6)
(define-constant FEE_BPS u10)
(define-constant TAKER_REBATE_BPS u20)

(define-read-only (get-taker-rebate-bps)
  TAKER_REBATE_BPS
)
(define-constant BPS_PRECISION u10000)
(define-constant MIN_SHARE_BPS u20)

(define-constant PRICE_PRECISION u100000000)

(define-constant DECIMAL_FACTOR u100)

(define-constant MAX_STALENESS u80)
(define-constant MAX_CONF_RATIO u50)

(define-constant SAINT 'SP000000000000000000002Q6VF78)

(define-data-var token-x principal .mock-ft)
(define-data-var token-y principal .mock-ft)
(define-data-var initialized bool true)

(define-data-var feed-id-x uint u1)
(define-data-var feed-id-y uint u45)
(define-constant LAZER_ORACLE .mock-lazer-oracle)
(define-constant LAZER_DECODER .mock-lazer-oracle)
(define-constant MICROS_PER_SECOND u1000000)
(define-constant MAX_UINT u340282366920938463463374607431768211455)

(define-constant ERR_DEPOSIT_TOO_SMALL (err u1001))
(define-constant ERR_ALREADY_SETTLED (err u1002))
(define-constant ERR_STALE_PRICE (err u1003))
(define-constant ERR_PRICE_UNCERTAIN (err u1004))
(define-constant ERR_NOTHING_TO_WITHDRAW (err u1005))
(define-constant ERR_ZERO_PRICE (err u1006))
(define-constant ERR_PAUSED (err u1007))
(define-constant ERR_NOT_AUTHORIZED (err u1008))
(define-constant ERR_NOTHING_TO_SETTLE (err u1009))
(define-constant ERR_QUEUE_FULL (err u1010))
(define-constant ERR_LIMIT_REQUIRED (err u1011))
(define-constant ERR_ALREADY_INITIALIZED (err u1012))
(define-constant ERR_WRONG_TRAIT (err u1013))
(define-constant ERR_EXPO_MISMATCH (err u1014))
(define-constant ERR_NOTHING_FILLED (err u1015))
(define-constant ERR_MUST_USE_SWAP (err u1016))
(define-constant ERR_PARTIAL_FILL (err u1017))
(define-constant ERR_HAS_RESTING_POSITION (err u1018))
(define-constant ERR_ZERO_MIN_DEPOSIT (err u1019))
(define-constant ERR_TAKER_TOO_SMALL (err u1020))
(define-constant ERR_NOTHING_TO_READMIT (err u1022))
(define-constant ERR_FEED_MISSING (err u1023))
(define-constant ERR_USE_CANCEL (err u1024))
(define-constant ERR_FEED_TIMESTAMP_MISSING (err u1025))
(define-constant ERR_BAD_SPREAD (err u1026))
(define-constant ERR_CYCLE_OPEN (err u1027))
(define-constant ERR_NOT_A_SEAT (err u1028))

(define-data-var treasury principal tx-sender)
(define-data-var operator principal tx-sender)
(define-data-var paused bool false)
(define-data-var min-token-y-deposit uint u100)
(define-data-var min-token-x-deposit uint u100)
;; The N best-priced slots on a full book compete on PRICE: a newcomer that
;; beats the N-th best price takes its slot, and the N-th best is demoted to
;; the size region, where it stays if it is bigger than the smallest
;; resident there (that one is parked) and is parked otherwise. Every other
;; slot competes on SIZE. Whales outside the N best are never parked on
;; price, so no ladder of small orders can drain them. 0 = size only.
(define-data-var distance-slots uint u2)
(define-read-only (get-distance-slots) (var-get distance-slots))
;; ---------- protected seats ----------
;; max-band-per-side slots per side (the ladder's number) are reserved for
;; the band rungs (jing-buy/sell-stx-core-spread: pooled pegs, floor / cap
;; from the RFQ native oracle). A seat holder is never displaced; everyone
;; else competes for the other slots, full for them even while seats stand
;; empty. The ladder decides who holds a seat (one code hash per band side,
;; one rung per spread, replace at a spread, retire); the market keeps a
;; local copy so a deposit never calls the ladder. See the README.
;; seat holders, one short list per side: folds read it once, test in memory
(define-data-var seats-per-side uint u2)
(define-data-var seated-x (list 50 principal) (list))
(define-data-var seated-y (list 50 principal) (list))
(define-read-only (protected-seats) (var-get seats-per-side))
(define-read-only (get-seated-x) (var-get seated-x))
(define-read-only (get-seated-y) (var-get seated-y))
(define-read-only (is-protected-x (who principal)) (is-some (index-of? (var-get seated-x) who)))
(define-read-only (is-protected-y (who principal)) (is-some (index-of? (var-get seated-y) who)))

(define-private (still-seated-x (p principal)) (contract-call? .mock-jing-ladder is-band-x p))
(define-private (still-seated-y (p principal)) (contract-call? .mock-jing-ladder is-band-y p))
(define-private (with-seat
    (lst (list 50 principal))
    (who principal)
  )
  (if (is-some (index-of? lst who))
    lst
    (unwrap-panic (as-max-len? (append lst who) u50))
  )
)

;; seat count from the ladder, clamped to the slot count
(define-private (refresh-seat-count)
  (let ((n (contract-call? .mock-jing-ladder get-max-band-per-side)))
    (var-set seats-per-side (if (> n MAX_DEPOSITORS)
      MAX_DEPOSITORS
      n
    ))
    (var-get seats-per-side)
  )
)
(define-public (sync-seat-count)
  (ok (refresh-seat-count))
)
;; Drop every seat the ladder no longer holds, both sides (anyone): the
;; only way out for a retired rung when no current rung is left on its
;; side to sync. Removes nothing current, adds nothing: idempotent.
(define-public (prune-seats)
  (begin
    (var-set seated-x (filter still-seated-x (var-get seated-x)))
    (var-set seated-y (filter still-seated-y (var-get seated-y)))
    (ok (refresh-seat-count))
  )
)

;; Seat `who` (anyone; a rung calls it on itself from initialize). The
;; ladder must seat it (u1028): add-only. A sync also prunes that side's list
;; against the ladder, so a replaced or retired rung drops out.
(define-public (sync-seat (who principal))
  (let (
      (x (contract-call? .mock-jing-ladder is-band-x who))
      (y (contract-call? .mock-jing-ladder is-band-y who))
    )
    (asserts! (or x y) ERR_NOT_A_SEAT)
    ;; only the side the ladder seats it on is touched and pruned
    (and x (var-set seated-x (filter still-seated-x (with-seat (var-get seated-x) who))))
    (and y (var-set seated-y (filter still-seated-y (with-seat (var-get seated-y) who))))
    (ok {
      x: x,
      y: y,
      seats: (refresh-seat-count),
    })
  )
)
(define-data-var current-cycle uint u0)

(define-data-var settle-token-y-cleared uint u0)
(define-data-var settle-token-x-cleared uint u0)
(define-data-var settle-total-token-y uint u0)
(define-data-var settle-total-token-x uint u0)
(define-data-var settle-token-x-after-fee uint u0)
(define-data-var settle-token-y-after-fee uint u0)
(define-data-var bumped-token-y-principal principal tx-sender)
(define-data-var bumped-token-x-principal principal tx-sender)

(define-data-var acc-token-x-out uint u0)
(define-data-var acc-token-y-out uint u0)
(define-data-var acc-token-y-rolled uint u0)
(define-data-var acc-token-x-rolled uint u0)
(define-data-var acc-token-y-refunded uint u0)
(define-data-var acc-token-x-refunded uint u0)

(define-data-var caller-token-x-received uint u0)
(define-data-var caller-token-y-rolled uint u0)
(define-data-var caller-token-y-received uint u0)
(define-data-var caller-token-x-rolled uint u0)

(define-data-var walk-taker-received uint u0)

(define-data-var settle-clearing-price uint u0)

(define-data-var pending-rebate-x uint u0)
(define-data-var pending-rebate-y uint u0)
(define-data-var crossing bool false)
(define-data-var taker-too-small bool false)

(define-map token-y-deposits
  {
    cycle: uint,
    depositor: principal,
  }
  uint
)

(define-map token-x-deposits
  {
    cycle: uint,
    depositor: principal,
  }
  uint
)

(define-map token-y-depositor-list
  uint
  (list 50 principal)
)

(define-map token-x-depositor-list
  uint
  (list 50 principal)
)

(define-map cycle-totals
  uint
  {
    total-token-y: uint,
    total-token-x: uint,
  }
)

(define-map settlements
  uint
  {
    price: uint,
    token-y-cleared: uint,
    token-x-cleared: uint,
    token-y-fee: uint,
    token-x-fee: uint,
    settled-at: uint,
  }
)

(define-map token-y-deposit-limits
  principal
  {
    limit: uint,
    spread-bps: (optional uint),
  }
)
(define-map token-x-deposit-limits
  principal
  {
    limit: uint,
    spread-bps: (optional uint),
  }
)

(define-map token-y-parked
  principal
  uint
)
(define-map token-x-parked
  principal
  uint
)

(define-read-only (get-token-y-parked (who principal))
  (default-to u0 (map-get? token-y-parked who))
)
(define-read-only (get-token-x-parked (who principal))
  (default-to u0 (map-get? token-x-parked who))
)

(define-read-only (get-current-cycle)
  (var-get current-cycle)
)

(define-read-only (get-cycle-totals (cycle uint))
  (default-to {
    total-token-y: u0,
    total-token-x: u0,
  }
    (map-get? cycle-totals cycle)
  )
)

(define-read-only (get-settlement (cycle uint))
  (map-get? settlements cycle)
)

(define-read-only (get-token-y-deposit
    (cycle uint)
    (depositor principal)
  )
  (default-to u0
    (map-get? token-y-deposits {
      cycle: cycle,
      depositor: depositor,
    })
  )
)

(define-read-only (get-token-x-deposit
    (cycle uint)
    (depositor principal)
  )
  (default-to u0
    (map-get? token-x-deposits {
      cycle: cycle,
      depositor: depositor,
    })
  )
)

(define-read-only (get-token-y-depositors (cycle uint))
  (default-to (list) (map-get? token-y-depositor-list cycle))
)

(define-read-only (get-token-x-depositors (cycle uint))
  (default-to (list) (map-get? token-x-depositor-list cycle))
)

(define-read-only (get-min-deposits)
  {
    min-token-y: (var-get min-token-y-deposit),
    min-token-x: (var-get min-token-x-deposit),
  }
)

(define-read-only (get-token-y-order (depositor principal))
  (default-to {
    limit: u0,
    spread-bps: none,
  }
    (map-get? token-y-deposit-limits depositor)
  )
)

(define-read-only (get-token-x-order (depositor principal))
  (default-to {
    limit: u0,
    spread-bps: none,
  }
    (map-get? token-x-deposit-limits depositor)
  )
)

(define-read-only (get-token-y-limit (depositor principal))
  (get limit (get-token-y-order depositor))
)

(define-read-only (get-token-x-limit (depositor principal))
  (get limit (get-token-x-order depositor))
)

(define-read-only (pegged-bid
    (mid uint)
    (spread-bps uint)
    (cap uint)
  )
  ;; a spread at or over BPS_PRECISION is switched off (u0), not an underflow
  (let ((pegged (if (< spread-bps BPS_PRECISION)
      (/ (* mid (- BPS_PRECISION spread-bps)) BPS_PRECISION)
      u0
    )))
    (if (<= pegged cap)
      pegged
      u0
    )
  )
)

(define-read-only (pegged-ask
    (mid uint)
    (spread-bps uint)
    (floor uint)
  )
  (let ((pegged (/ (* mid (+ BPS_PRECISION spread-bps)) BPS_PRECISION)))
    (if (>= pegged floor)
      pegged
      MAX_UINT
    )
  )
)

(define-private (order-y-price
    (limit uint)
    (spread-bps (optional uint))
    (mid uint)
  )
  (match spread-bps
    spread (pegged-bid mid spread limit)
    limit
  )
)

(define-private (order-x-price
    (limit uint)
    (spread-bps (optional uint))
    (mid uint)
  )
  (match spread-bps
    spread (pegged-ask mid spread limit)
    limit
  )
)

(define-read-only (token-y-limit-at
    (depositor principal)
    (mid uint)
  )
  (let ((order (get-token-y-order depositor)))
    (order-y-price (get limit order) (get spread-bps order) mid)
  )
)
(define-read-only (token-x-limit-at
    (depositor principal)
    (mid uint)
  )
  (let ((order (get-token-x-order depositor)))
    (order-x-price (get limit order) (get spread-bps order) mid)
  )
)
(define-private (valid-spread (spread-bps (optional uint)))
  (match spread-bps
    spread (< spread BPS_PRECISION)
    true
  )
)

(define-private (log-peg-y-if
    (spread-bps (optional uint))
    (cap uint)
  )
  (match spread-bps
    spread (contract-call? .mock-jing-core log-peg-y tx-sender spread cap
      (var-get current-cycle) (var-get token-x) (var-get token-y)
    )
    (ok true)
  )
)

(define-private (log-peg-x-if
    (spread-bps (optional uint))
    (floor uint)
  )
  (match spread-bps
    spread (contract-call? .mock-jing-core log-peg-x tx-sender spread floor
      (var-get current-cycle) (var-get token-x) (var-get token-y)
    )
    (ok true)
  )
)
(define-private (advance-cycle)
  (begin
    (var-set current-cycle (+ (var-get current-cycle) u1))
  )
)

(define-private (count-seated-fold
    (who principal)
    (acc {
      seated: (list 50 principal),
      n: uint,
    })
  )
  (if (is-some (index-of? (get seated acc) who))
    (merge acc { n: (+ (get n acc) u1) })
    acc
  )
)
(define-private (seated-on
    (depositors (list 50 principal))
    (seated (list 50 principal))
  )
  (get n (fold count-seated-fold depositors {
    seated: seated,
    n: u0,
  }))
)
;; Full FOR `who`: a seat holder sees the hard cap; anyone else sees the
;; open slots, MAX_DEPOSITORS minus the seats, taken or not.
(define-read-only (side-full-y
    (depositors (list 50 principal))
    (who principal)
  )
  (let ((seated (var-get seated-y)))
    (if (is-some (index-of? seated who))
      (>= (len depositors) MAX_DEPOSITORS)
      (>= (- (len depositors) (seated-on depositors seated))
        (- MAX_DEPOSITORS (protected-seats)))
    )
  )
)
(define-read-only (side-full-x
    (depositors (list 50 principal))
    (who principal)
  )
  (let ((seated (var-get seated-x)))
    (if (is-some (index-of? seated who))
      (>= (len depositors) MAX_DEPOSITORS)
      (>= (- (len depositors) (seated-on depositors seated))
        (- MAX_DEPOSITORS (protected-seats)))
    )
  )
)
(define-private (find-smallest-token-y-fold
    (depositor principal)
    (acc {
      cycle: uint,
      seated: (list 50 principal),
      smallest: uint,
      smallest-principal: principal,
    })
  )
  (let ((amount (get-token-y-deposit (get cycle acc) depositor)))
    (if (and (is-none (index-of? (get seated acc) depositor)) (< amount (get smallest acc)))
      (merge acc {
        smallest: amount,
        smallest-principal: depositor,
      })
      acc
    )
  )
)

(define-private (find-smallest-token-x-fold
    (depositor principal)
    (acc {
      cycle: uint,
      seated: (list 50 principal),
      smallest: uint,
      smallest-principal: principal,
    })
  )
  (let ((amount (get-token-x-deposit (get cycle acc) depositor)))
    (if (and (is-none (index-of? (get seated acc) depositor)) (< amount (get smallest acc)))
      (merge acc {
        smallest: amount,
        smallest-principal: depositor,
      })
      acc
    )
  )
)

(define-private (not-eq-bumped-token-y (entry principal))
  (not (is-eq entry (var-get bumped-token-y-principal)))
)

(define-private (not-eq-bumped-token-x (entry principal))
  (not (is-eq entry (var-get bumped-token-x-principal)))
)


(define-private (top-y-insert
    (entry {
      who: principal,
      l: uint,
    })
    (acc {
      e: {
        who: principal,
        l: uint,
      },
      out: (list 50 {
        who: principal,
        l: uint,
      }),
      placed: bool,
    })
  )
  ;; bids: best = highest l; a new entry goes AFTER equals (time priority)
  (if (and (not (get placed acc)) (> (get l (get e acc)) (get l entry)))
    (merge acc {
      out: (push-quote (push-quote (get out acc) (get e acc)) entry),
      placed: true,
    })
    (merge acc { out: (push-quote (get out acc) entry) })
  )
)
(define-private (top-x-insert
    (entry {
      who: principal,
      l: uint,
    })
    (acc {
      e: {
        who: principal,
        l: uint,
      },
      out: (list 50 {
        who: principal,
        l: uint,
      }),
      placed: bool,
    })
  )
  ;; asks: best = lowest l; a new entry goes AFTER equals (time priority)
  (if (and (not (get placed acc)) (< (get l (get e acc)) (get l entry)))
    (merge acc {
      out: (push-quote (push-quote (get out acc) (get e acc)) entry),
      placed: true,
    })
    (merge acc { out: (push-quote (get out acc) entry) })
  )
)
;; Keeps the `slots` best-priced OUT-OF-RANGE residents, best first. In-range
;; residents are not ranked: an out-of-range newcomer can never displace one.
;; Switched-off residents are out of range at the worst price there is, so
;; they only reach the top set when the side holds almost nothing alive.
(define-private (top-y-fold
    (maker principal)
    (acc {
      price: uint,
      slots: uint,
      seated: (list 50 principal),
      out: (list 50 {
        who: principal,
        l: uint,
      }),
    })
  )
  (let ((l (token-y-limit-at maker (get price acc))))
    (if (or (is-some (index-of? (get seated acc) maker)) (>= l (get price acc)))
      acc
      (let (
          (r (fold top-y-insert (get out acc) {
            e: {
              who: maker,
              l: l,
            },
            out: (list),
            placed: false,
          }))
          (sorted (if (get placed r)
            (get out r)
            (push-quote (get out r) {
              who: maker,
              l: l,
            })
          ))
        )
        (merge acc { out: (unwrap-panic (slice? sorted u0 (if (> (len sorted) (get slots acc))
          (get slots acc)
          (len sorted)
        ))) })
      )
    )
  )
)
(define-private (top-x-fold
    (maker principal)
    (acc {
      price: uint,
      slots: uint,
      seated: (list 50 principal),
      out: (list 50 {
        who: principal,
        l: uint,
      }),
    })
  )
  (let ((l (token-x-limit-at maker (get price acc))))
    (if (or (is-some (index-of? (get seated acc) maker)) (<= l (get price acc)))
      acc
      (let (
          (r (fold top-x-insert (get out acc) {
            e: {
              who: maker,
              l: l,
            },
            out: (list),
            placed: false,
          }))
          (sorted (if (get placed r)
            (get out r)
            (push-quote (get out r) {
              who: maker,
              l: l,
            })
          ))
        )
        (merge acc { out: (unwrap-panic (slice? sorted u0 (if (> (len sorted) (get slots acc))
          (get slots acc)
          (len sorted)
        ))) })
      )
    )
  )
)
;; The tenth best (last of the top set), if it is alive-out-of-range and
;; strictly worse than the newcomer: park it. In-range residents are never
;; parked by an out-of-range newcomer (they rank above it, so if one is last
;; the newcomer is not better than it).
(define-private (smallest-outside-y-fold
    (who principal)
    (acc {
      cycle: uint,
      price: uint,
      top: (list 50 principal),
      seated: (list 50 principal),
      smallest: uint,
      found: (optional principal),
    })
  )
  ;; the smallest OUT-OF-RANGE resident that is not in the price region
  (if (or
      (is-some (index-of? (get seated acc) who))
      (is-some (index-of? (get top acc) who))
      (>= (token-y-limit-at who (get price acc)) (get price acc))
    )
    acc
    (let ((amt (get-token-y-deposit (get cycle acc) who)))
      (if (< amt (get smallest acc))
        (merge acc {
          smallest: amt,
          found: (some who),
        })
        acc
      )
    )
  )
)
(define-private (first-off-y-fold
    (who principal)
    (acc {
      price: uint,
      seated: (list 50 principal),
      found: (optional principal),
    })
  )
  ;; a switched-off resident (bid sentinel u0) leaves before anyone alive
  (if (and (is-none (get found acc)) (is-none (index-of? (get seated acc) who)) (is-eq (token-y-limit-at who (get price acc)) u0))
    (merge acc { found: (some who) })
    acc
  )
)
(define-private (first-off-x-fold
    (who principal)
    (acc {
      price: uint,
      seated: (list 50 principal),
      found: (optional principal),
    })
  )
  ;; a switched-off resident (ask sentinel MAX_UINT) leaves before anyone alive
  (if (and (is-none (get found acc)) (is-none (index-of? (get seated acc) who)) (is-eq (token-x-limit-at who (get price acc)) MAX_UINT))
    (merge acc { found: (some who) })
    acc
  )
)
;; mirror of park-tenth-token-x (bids: in range = bid >= price)
(define-private (park-tenth-token-y
    (cycle uint)
    (price uint)
    (bid uint)
    (size uint)
    (depositors (list 50 principal))
  )
  (let (
      (seated (var-get seated-y))
      (top (get out (fold top-y-fold depositors {
        price: price,
        slots: (var-get distance-slots),
        seated: seated,
        out: (list),
      })))
      (n (len top))
      (off (get found (fold first-off-y-fold depositors {
        price: price,
        seated: seated,
        found: none,
      })))
      (outside (fold smallest-outside-y-fold depositors {
        cycle: cycle,
        price: price,
        top: (map quote-who top),
        seated: seated,
        smallest: u999999999999999999,
        found: none,
      }))
      (edge (and (> n u0) (< (get l (unwrap-panic (element-at? top (- n u1)))) bid)))
    )
    (match off
      dead (park-token-y cycle price dead depositors)
      (if (and (>= bid price) (is-eq n u0))
        (ok false)
        (if edge
          (let ((last (unwrap-panic (element-at? top (- n u1)))))
            (match (get found outside)
              small (if (> (get-token-y-deposit cycle (get who last)) (get smallest outside))
                (park-token-y cycle price small depositors)
                (park-token-y cycle price (get who last) depositors)
              )
              (park-token-y cycle price (get who last) depositors)
            )
          )
          (match (get found outside)
            small (if (> size (get smallest outside))
              (park-token-y cycle price small depositors)
              ERR_QUEUE_FULL
            )
            ERR_QUEUE_FULL
          )
        )
      )
    )
  )
)
(define-private (smallest-outside-x-fold
    (who principal)
    (acc {
      cycle: uint,
      price: uint,
      top: (list 50 principal),
      seated: (list 50 principal),
      smallest: uint,
      found: (optional principal),
    })
  )
  ;; the smallest OUT-OF-RANGE resident that is not in the price region
  (if (or
      (is-some (index-of? (get seated acc) who))
      (is-some (index-of? (get top acc) who))
      (<= (token-x-limit-at who (get price acc)) (get price acc))
    )
    acc
    (let ((amt (get-token-x-deposit (get cycle acc) who)))
      (if (< amt (get smallest acc))
        (merge acc {
          smallest: amt,
          found: (some who),
        })
        acc
      )
    )
  )
)
;; A newcomer on a full side. A switched-off resident leaves before anyone
;; alive. In range with nobody out of range: (ok false), the core's size
;; rule among everyone. In range, or out of range and better than the N-th
;; best out-of-range price: the N-th best is demoted to the size region
;; (every out-of-range resident outside the N best); it stays if bigger
;; than the region's smallest, which is parked instead, else it is parked.
;; Out of range with no price edge: a size fight inside the region only,
;; the newcomer parks the region's smallest if bigger, else u1010; an
;; in-range resident or one of the N best is never displaced by an
;; out-of-range newcomer (before 2026-09-14 the core's size rule ran here
;; and could park an in-range order for a bigger order far from the mid).
(define-private (park-tenth-token-x
    (cycle uint)
    (price uint)
    (ask uint)
    (size uint)
    (depositors (list 50 principal))
  )
  (let (
      (seated (var-get seated-x))
      (top (get out (fold top-x-fold depositors {
        price: price,
        slots: (var-get distance-slots),
        seated: seated,
        out: (list),
      })))
      (n (len top))
      (off (get found (fold first-off-x-fold depositors {
        price: price,
        seated: seated,
        found: none,
      })))
      (outside (fold smallest-outside-x-fold depositors {
        cycle: cycle,
        price: price,
        top: (map quote-who top),
        seated: seated,
        smallest: u999999999999999999,
        found: none,
      }))
      (edge (and (> n u0) (> (get l (unwrap-panic (element-at? top (- n u1)))) ask)))
    )
    (match off
      dead (park-token-x cycle price dead depositors)
      (if (and (<= ask price) (is-eq n u0))
        (ok false)
        (if edge
          (let ((last (unwrap-panic (element-at? top (- n u1)))))
            (match (get found outside)
              small (if (> (get-token-x-deposit cycle (get who last)) (get smallest outside))
                (park-token-x cycle price small depositors)
                (park-token-x cycle price (get who last) depositors)
              )
              (park-token-x cycle price (get who last) depositors)
            )
          )
          (match (get found outside)
            small (if (> size (get smallest outside))
              (park-token-x cycle price small depositors)
              ERR_QUEUE_FULL
            )
            ERR_QUEUE_FULL
          )
        )
      )
    )
  )
)
(define-private (park-token-y
    (cycle uint)
    (price uint)
    (who principal)
    (depositors (list 50 principal))
  )
  (let (
      (amount (get-token-y-deposit cycle who))
      (totals (get-cycle-totals cycle))
    )
    (map-set token-y-parked who amount)
    (map-delete token-y-deposits {
      cycle: cycle,
      depositor: who,
    })
    (var-set bumped-token-y-principal who)
    (map-set token-y-depositor-list cycle
      (filter not-eq-bumped-token-y depositors)
    )
    (map-set cycle-totals cycle
      (merge totals { total-token-y: (- (get total-token-y totals) amount) })
    )
    (try! (contract-call? .mock-jing-core log-park-y who amount cycle price
      (var-get token-x) (var-get token-y)
    ))
    (ok true)
  )
)
(define-private (park-token-x
    (cycle uint)
    (price uint)
    (who principal)
    (depositors (list 50 principal))
  )
  (let (
      (amount (get-token-x-deposit cycle who))
      (totals (get-cycle-totals cycle))
    )
    (map-set token-x-parked who amount)
    (map-delete token-x-deposits {
      cycle: cycle,
      depositor: who,
    })
    (var-set bumped-token-x-principal who)
    (map-set token-x-depositor-list cycle
      (filter not-eq-bumped-token-x depositors)
    )
    (map-set cycle-totals cycle
      (merge totals { total-token-x: (- (get total-token-x totals) amount) })
    )
    (try! (contract-call? .mock-jing-core log-park-x who amount cycle price
      (var-get token-x) (var-get token-y)
    ))
    (ok true)
  )
)

(define-private (pick-feed
    (f {
      feed-id: uint,
      price: int,
      exponent: int,
      publisher-count: uint,
      confidence: (optional uint),
      best-bid: (optional int),
      best-ask: (optional int),
      funding-rate: (optional int),
      funding-timestamp: (optional uint),
      funding-rate-interval: (optional uint),
      market-session: (optional uint),
      ema-price: (optional int),
      ema-confidence: (optional uint),
      feed-update-timestamp: (optional uint),
    })
    (acc {
      id: uint,
      found: (optional {
        feed-id: uint,
        price: int,
        exponent: int,
        publisher-count: uint,
        confidence: (optional uint),
        best-bid: (optional int),
        best-ask: (optional int),
        funding-rate: (optional int),
        funding-timestamp: (optional uint),
        funding-rate-interval: (optional uint),
        market-session: (optional uint),
        ema-price: (optional int),
        ema-confidence: (optional uint),
        feed-update-timestamp: (optional uint),
      }),
    })
  )
  (if (is-eq (get feed-id f) (get id acc))
    (merge acc { found: (some f) })
    acc
  )
)

(define-private (shape-feed
    (f {
      feed-id: uint,
      price: int,
      exponent: int,
      publisher-count: uint,
      confidence: (optional uint),
      best-bid: (optional int),
      best-ask: (optional int),
      funding-rate: (optional int),
      funding-timestamp: (optional uint),
      funding-rate-interval: (optional uint),
      market-session: (optional uint),
      ema-price: (optional int),
      ema-confidence: (optional uint),
      feed-update-timestamp: (optional uint),
    })
    (publish-time uint)
  )
  (ok {
    price: (get price f),
    conf: (unwrap! (get confidence f) ERR_PRICE_UNCERTAIN),
    expo: (get exponent f),
    ema-price: (default-to (get price f) (get ema-price f)),
    ema-conf: (default-to u0 (get ema-confidence f)),
    publish-time: (/ (unwrap! (get feed-update-timestamp f) ERR_FEED_TIMESTAMP_MISSING)
      MICROS_PER_SECOND
    ),
    prev-publish-time: u0,
  })
)

(define-private (lazer-feeds (update (buff 8192)))
  (let (
      (decoded (try! (contract-call? LAZER_ORACLE verify-price-feeds update LAZER_DECODER
        (some MAX_STALENESS)
      )))
      (feeds (get price-feeds decoded))
      (publish-time (/ (get timestamp decoded) MICROS_PER_SECOND))
      (fx (unwrap!
        (get found
          (fold pick-feed feeds {
            id: (var-get feed-id-x),
            found: none,
          })
        )
        ERR_FEED_MISSING
      ))
      (fy (unwrap!
        (get found
          (fold pick-feed feeds {
            id: (var-get feed-id-y),
            found: none,
          })
        )
        ERR_FEED_MISSING
      ))
    )
    (ok {
      feed-x: (try! (shape-feed fx publish-time)),
      feed-y: (try! (shape-feed fy publish-time)),
    })
  )
)

(define-private (fresh-classification-price (update (buff 8192)))
  (let (
      (feeds (try! (lazer-feeds update)))
      (feed-x (get feed-x feeds))
      (feed-y (get feed-y feeds))
      (min-freshness (- stacks-block-time MAX_STALENESS))
    )
    (asserts! (> (get publish-time feed-x) min-freshness) ERR_STALE_PRICE)
    (asserts! (> (get publish-time feed-y) min-freshness) ERR_STALE_PRICE)
    (asserts! (> (get price feed-x) 0) ERR_ZERO_PRICE)
    (asserts! (> (get price feed-y) 0) ERR_ZERO_PRICE)
    (ok (/ (* (to-uint (get price feed-x)) PRICE_PRECISION)
      (to-uint (get price feed-y))
    ))
  )
)

(define-private (live-bid-fold
    (depositor principal)
    (acc {
      price: uint,
      found: bool,
    })
  )
  (if (get found acc)
    acc
    (let ((amount (get-token-y-deposit (var-get current-cycle) depositor)))
      (if (and
          (> amount u0)
          (>= amount (var-get min-token-y-deposit))
          (<= (get price acc) (token-y-limit-at depositor (get price acc)))
        )
        (merge acc { found: true })
        acc
      )
    )
  )
)

(define-private (live-offer-fold
    (depositor principal)
    (acc {
      price: uint,
      found: bool,
    })
  )
  (if (get found acc)
    acc
    (let ((amount (get-token-x-deposit (var-get current-cycle) depositor)))
      (if (and
          (> amount u0)
          (>= amount (var-get min-token-x-deposit))
          (>= (get price acc) (token-x-limit-at depositor (get price acc)))
        )
        (merge acc { found: true })
        acc
      )
    )
  )
)

(define-read-only (would-take-as-x
    (price uint)
    (limit uint)
  )
  (and
    (> price u0)
    (>= price limit)
    (get found
      (fold live-bid-fold (get-token-y-depositors (var-get current-cycle)) {
        price: price,
        found: false,
      })
    )
  )
)

(define-read-only (would-take-as-y
    (price uint)
    (limit uint)
  )
  (and
    (> price u0)
    (<= price limit)
    (get found
      (fold live-offer-fold (get-token-x-depositors (var-get current-cycle)) {
        price: price,
        found: false,
      })
    )
  )
)

(define-private (deposit-token-y-core
    (amount uint)
    (limit-price uint)
    (spread-bps (optional uint))
    (carry uint)
    (price uint)
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (existing (get-token-y-deposit cycle tx-sender))
      (totals (get-cycle-totals cycle))
      (depositors (get-token-y-depositors cycle))
      (tok-y (var-get token-y))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (>= (+ existing carry amount) (var-get min-token-y-deposit))
      ERR_DEPOSIT_TOO_SMALL
    )
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (is-eq (contract-of t) tok-y) ERR_WRONG_TRAIT)
    (and (> carry u0) (map-delete token-y-parked tx-sender))

    (if (and (is-eq existing u0) (side-full-y depositors tx-sender))
      (let (
          (smallest-info (fold find-smallest-token-y-fold depositors {
            cycle: cycle,
            seated: (var-get seated-y),
            smallest: u999999999999999999,
            smallest-principal: tx-sender,
          }))
          (smallest-amount (get smallest smallest-info))
          (smallest-who (get smallest-principal smallest-info))
        )
        (asserts! (> (+ carry amount) smallest-amount) ERR_QUEUE_FULL)
        ;; the smallest resident is PARKED, not refunded: funds and price
        ;; kept, readmittable when a slot frees (2026-09-13; v5 refunded)
        (map-set token-y-parked smallest-who smallest-amount)
        (try! (contract-call? .mock-jing-core log-park-y smallest-who smallest-amount cycle
          price (var-get token-x) tok-y
        ))
        (try! (stx-transfer? amount tx-sender current-contract))
        (var-set bumped-token-y-principal smallest-who)
        (map-set token-y-depositor-list cycle
          (unwrap-panic (as-max-len?
            (append (filter not-eq-bumped-token-y depositors) tx-sender) u50
          ))
        )
        (map-delete token-y-deposits {
          cycle: cycle,
          depositor: smallest-who,
        })
        (map-set token-y-deposits {
          cycle: cycle,
          depositor: tx-sender,
        }
          (+ carry amount)
        )
        (map-set token-y-deposit-limits tx-sender {
          limit: limit-price,
          spread-bps: spread-bps,
        })
        (map-set cycle-totals cycle
          (merge totals { total-token-y: (+ (- (get total-token-y totals) smallest-amount) carry amount) })
        )
        (try! (contract-call? .mock-jing-core log-deposit-y tx-sender (+ carry amount)
          amount limit-price cycle (some smallest-who) smallest-amount
          (var-get token-x) tok-y
        ))
        (ok amount)
      )
      (begin
        (try! (stx-transfer? amount tx-sender current-contract))
        (map-set token-y-deposits {
          cycle: cycle,
          depositor: tx-sender,
        }
          (+ existing carry amount)
        )
        (map-set token-y-deposit-limits tx-sender {
          limit: limit-price,
          spread-bps: spread-bps,
        })
        (map-set cycle-totals cycle
          (merge totals { total-token-y: (+ (get total-token-y totals) carry amount) })
        )
        (if (is-eq existing u0)
          (map-set token-y-depositor-list cycle
            (unwrap-panic (as-max-len? (append depositors tx-sender) u50))
          )
          true
        )
        (try! (contract-call? .mock-jing-core log-deposit-y tx-sender
          (+ existing carry amount) amount limit-price cycle none u0
          (var-get token-x) tok-y
        ))
        (ok amount)
      )
    )
  )
)

(define-public (deposit-token-y
    (amount uint)
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (parked (get-token-y-parked tx-sender))
      (new-maker (is-eq (get-token-y-deposit cycle tx-sender) u0))
      (depositors (get-token-y-depositors cycle))
      (full (side-full-y depositors tx-sender))
      (price (if (or
          (> (len (get-token-x-depositors cycle)) u0)
          (and new-maker full)
        )
        (try! (fresh-classification-price update))
        u0
      ))
      (bid (order-y-price limit-price spread-bps price))
    )
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts! (not (would-take-as-y price bid)) ERR_MUST_USE_SWAP)
    ;; Priority on a full book: switched off gets no slot; else park-tenth
    ;; (see it), and only an in-range newcomer with nobody out of range
    ;; falls through to the core's size rule.
    (asserts! (not (and new-maker full (is-eq bid u0))) ERR_QUEUE_FULL)
    (and
      new-maker
      full
      (try! (park-tenth-token-y cycle price bid (+ amount parked) depositors))
    )
    (let ((deposited (try! (deposit-token-y-core amount limit-price spread-bps parked price t asset-name))))
      (try! (log-peg-y-if spread-bps limit-price))
      (and
        (> parked u0)
        (try! (contract-call? .mock-jing-core log-readmit-y tx-sender parked cycle price
          (var-get token-x) (var-get token-y)
        ))
      )
      (ok deposited)
    )
  )
)
(define-private (deposit-token-x-core
    (amount uint)
    (limit-price uint)
    (spread-bps (optional uint))
    (carry uint)
    (price uint)
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (existing (get-token-x-deposit cycle tx-sender))
      (totals (get-cycle-totals cycle))
      (depositors (get-token-x-depositors cycle))
      (tok-x (var-get token-x))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (>= (+ existing carry amount) (var-get min-token-x-deposit))
      ERR_DEPOSIT_TOO_SMALL
    )
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (is-eq (contract-of t) tok-x) ERR_WRONG_TRAIT)
    (and (> carry u0) (map-delete token-x-parked tx-sender))
    (if (and (is-eq existing u0) (side-full-x depositors tx-sender))
      (let (
          (smallest-info (fold find-smallest-token-x-fold depositors {
            cycle: cycle,
            seated: (var-get seated-x),
            smallest: u999999999999999999,
            smallest-principal: tx-sender,
          }))
          (smallest-amount (get smallest smallest-info))
          (smallest-who (get smallest-principal smallest-info))
        )
        (asserts! (> (+ carry amount) smallest-amount) ERR_QUEUE_FULL)
        ;; the smallest resident is PARKED, not refunded (mirror of the y side)
        (map-set token-x-parked smallest-who smallest-amount)
        (try! (contract-call? .mock-jing-core log-park-x smallest-who smallest-amount cycle
          price tok-x (var-get token-y)
        ))
        (try! (contract-call? t transfer amount tx-sender current-contract none))
        (var-set bumped-token-x-principal smallest-who)
        (map-set token-x-depositor-list cycle
          (unwrap-panic (as-max-len?
            (append (filter not-eq-bumped-token-x depositors) tx-sender) u50
          ))
        )
        (map-delete token-x-deposits {
          cycle: cycle,
          depositor: smallest-who,
        })
        (map-set token-x-deposits {
          cycle: cycle,
          depositor: tx-sender,
        }
          (+ carry amount)
        )
        (map-set token-x-deposit-limits tx-sender {
          limit: limit-price,
          spread-bps: spread-bps,
        })
        (map-set cycle-totals cycle
          (merge totals { total-token-x: (+ (- (get total-token-x totals) smallest-amount) carry amount) })
        )
        (try! (contract-call? .mock-jing-core log-deposit-x tx-sender (+ carry amount)
          amount limit-price cycle (some smallest-who) smallest-amount tok-x
          (var-get token-y)
        ))
        (ok amount)
      )
      (begin
        (try! (contract-call? t transfer amount tx-sender current-contract none))
        (map-set token-x-deposits {
          cycle: cycle,
          depositor: tx-sender,
        }
          (+ existing carry amount)
        )
        (map-set token-x-deposit-limits tx-sender {
          limit: limit-price,
          spread-bps: spread-bps,
        })
        (map-set cycle-totals cycle
          (merge totals { total-token-x: (+ (get total-token-x totals) carry amount) })
        )
        (if (is-eq existing u0)
          (map-set token-x-depositor-list cycle
            (unwrap-panic (as-max-len? (append depositors tx-sender) u50))
          )
          true
        )
        (try! (contract-call? .mock-jing-core log-deposit-x tx-sender
          (+ existing carry amount) amount limit-price cycle none u0 tok-x
          (var-get token-y)
        ))
        (ok amount)
      )
    )
  )
)

(define-public (deposit-token-x
    (amount uint)
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (parked (get-token-x-parked tx-sender))
      (new-maker (is-eq (get-token-x-deposit cycle tx-sender) u0))
      (depositors (get-token-x-depositors cycle))
      (full (side-full-x depositors tx-sender))
      (price (if (or
          (> (len (get-token-y-depositors cycle)) u0)
          (and new-maker full)
        )
        (try! (fresh-classification-price update))
        u0
      ))
      (ask (order-x-price limit-price spread-bps price))
    )
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts! (not (would-take-as-x price ask)) ERR_MUST_USE_SWAP)
    ;; mirror of the y side
    (asserts! (not (and new-maker full (is-eq ask MAX_UINT))) ERR_QUEUE_FULL)
    (and
      new-maker
      full
      (try! (park-tenth-token-x cycle price ask (+ amount parked) depositors))
    )
    (let ((deposited (try! (deposit-token-x-core amount limit-price spread-bps parked price t asset-name))))
      (try! (log-peg-x-if spread-bps limit-price))
      (and
        (> parked u0)
        (try! (contract-call? .mock-jing-core log-readmit-x tx-sender parked cycle price
          (var-get token-x) (var-get token-y)
        ))
      )
      (ok deposited)
    )
  )
)
(define-public (cancel-token-y-deposit
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (caller tx-sender)
      (amount (get-token-y-deposit cycle caller))
      (parked (get-token-y-parked caller))
      (totals (get-cycle-totals cycle))
      (tok-y (var-get token-y))
    )
    (asserts! (is-eq (contract-of t) tok-y) ERR_WRONG_TRAIT)
    (asserts! (or (> amount u0) (> parked u0)) ERR_NOTHING_TO_WITHDRAW)
    (if (is-eq amount u0)
      (begin
        (try! (as-contract? ((with-stx parked))
          (try! (stx-transfer? parked current-contract caller))
        ))
        (map-delete token-y-parked caller)
        (map-delete token-y-deposit-limits caller)
        (try! (contract-call? .mock-jing-core log-refund-y caller parked cycle
          (var-get token-x) tok-y
        ))
        (ok parked)
      )
      (begin
        (try! (as-contract? ((with-stx amount))
          (try! (stx-transfer? amount current-contract caller))
        ))
        (map-delete token-y-deposits {
          cycle: cycle,
          depositor: caller,
        })
        (map-delete token-y-deposit-limits caller)
        (var-set bumped-token-y-principal caller)
        (map-set token-y-depositor-list cycle
          (filter not-eq-bumped-token-y (get-token-y-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-y: (- (get total-token-y totals) amount) })
        )
        (try! (contract-call? .mock-jing-core log-refund-y caller amount cycle
          (var-get token-x) tok-y
        ))
        (ok amount)
      )
    )
  )
)

(define-public (cancel-token-x-deposit
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (caller tx-sender)
      (amount (get-token-x-deposit cycle caller))
      (parked (get-token-x-parked caller))
      (totals (get-cycle-totals cycle))
      (tok-x (var-get token-x))
    )
    (asserts! (is-eq (contract-of t) tok-x) ERR_WRONG_TRAIT)
    (asserts! (or (> amount u0) (> parked u0)) ERR_NOTHING_TO_WITHDRAW)
    (if (is-eq amount u0)
      (begin
        (try! (as-contract? ((with-ft (contract-of t) asset-name parked))
          (try! (contract-call? t transfer parked current-contract caller none))
        ))
        (map-delete token-x-parked caller)
        (map-delete token-x-deposit-limits caller)
        (try! (contract-call? .mock-jing-core log-refund-x caller parked cycle tok-x
          (var-get token-y)
        ))
        (ok parked)
      )
      (begin
        (try! (as-contract? ((with-ft (contract-of t) asset-name amount))
          (try! (contract-call? t transfer amount current-contract caller none))
        ))
        (map-delete token-x-deposits {
          cycle: cycle,
          depositor: caller,
        })
        (map-delete token-x-deposit-limits caller)
        (var-set bumped-token-x-principal caller)
        (map-set token-x-depositor-list cycle
          (filter not-eq-bumped-token-x (get-token-x-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-x: (- (get total-token-x totals) amount) })
        )
        (try! (contract-call? .mock-jing-core log-refund-x caller amount cycle tok-x
          (var-get token-y)
        ))
        (ok amount)
      )
    )
  )
)

(define-public (withdraw-token-y
    (amount uint)
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (caller tx-sender)
      (live (get-token-y-deposit cycle caller))
      (parked (get-token-y-parked caller))
      (on-live (> live u0))
      (have (if on-live
        live
        parked
      ))
      (totals (get-cycle-totals cycle))
      (tok-y (var-get token-y))
      (remaining (- have (if (> amount have)
        have
        amount
      )))
    )
    (asserts! (is-eq (contract-of t) tok-y) ERR_WRONG_TRAIT)
    (asserts! (> have u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (> amount u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (< amount have) ERR_USE_CANCEL)
    (asserts! (>= remaining (var-get min-token-y-deposit)) ERR_DEPOSIT_TOO_SMALL)
    (try! (as-contract? ((with-stx amount))
      (try! (stx-transfer? amount current-contract caller))
    ))
    (if on-live
      (begin
        (map-set token-y-deposits {
          cycle: cycle,
          depositor: caller,
        }
          remaining
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-y: (- (get total-token-y totals) amount) })
        )
      )
      (map-set token-y-parked caller remaining)
    )
    (try! (contract-call? .mock-jing-core log-withdraw-y caller amount remaining
      (not on-live) cycle (var-get token-x) tok-y
    ))
    (ok remaining)
  )
)

(define-public (withdraw-token-x
    (amount uint)
    (t <ft-trait>)
    (asset-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (caller tx-sender)
      (live (get-token-x-deposit cycle caller))
      (parked (get-token-x-parked caller))
      (on-live (> live u0))
      (have (if on-live
        live
        parked
      ))
      (totals (get-cycle-totals cycle))
      (tok-x (var-get token-x))
      (remaining (- have (if (> amount have)
        have
        amount
      )))
    )
    (asserts! (is-eq (contract-of t) tok-x) ERR_WRONG_TRAIT)
    (asserts! (> have u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (> amount u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (< amount have) ERR_USE_CANCEL)
    (asserts! (>= remaining (var-get min-token-x-deposit)) ERR_DEPOSIT_TOO_SMALL)
    (try! (as-contract? ((with-ft (contract-of t) asset-name amount))
      (try! (contract-call? t transfer amount current-contract caller none))
    ))
    (if on-live
      (begin
        (map-set token-x-deposits {
          cycle: cycle,
          depositor: caller,
        }
          remaining
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-x: (- (get total-token-x totals) amount) })
        )
      )
      (map-set token-x-parked caller remaining)
    )
    (try! (contract-call? .mock-jing-core log-withdraw-x caller amount remaining
      (not on-live) cycle tok-x (var-get token-y)
    ))
    (ok remaining)
  )
)

(define-public (readmit-token-y
    (who principal)
    (update (buff 8192))
  )
  (let (
      (cycle (var-get current-cycle))
      (amount (get-token-y-parked who))
      (depositors (get-token-y-depositors cycle))
      (totals (get-cycle-totals cycle))
      (price (try! (fresh-classification-price update)))
      (limit (token-y-limit-at who price))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (> amount u0) ERR_NOTHING_TO_READMIT)
    (asserts! (not (side-full-y depositors who)) ERR_QUEUE_FULL)
    (asserts! (not (would-take-as-y price limit)) ERR_MUST_USE_SWAP)
    (map-set token-y-deposits {
      cycle: cycle,
      depositor: who,
    }
      amount
    )
    (map-set token-y-depositor-list cycle
      (unwrap-panic (as-max-len? (append depositors who) u50))
    )
    (map-set cycle-totals cycle
      (merge totals { total-token-y: (+ (get total-token-y totals) amount) })
    )
    (map-delete token-y-parked who)
    (try! (contract-call? .mock-jing-core log-readmit-y who amount cycle price
      (var-get token-x) (var-get token-y)
    ))
    (ok amount)
  )
)

(define-public (readmit-token-x
    (who principal)
    (update (buff 8192))
  )
  (let (
      (cycle (var-get current-cycle))
      (amount (get-token-x-parked who))
      (depositors (get-token-x-depositors cycle))
      (totals (get-cycle-totals cycle))
      (price (try! (fresh-classification-price update)))
      (limit (token-x-limit-at who price))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts! (> amount u0) ERR_NOTHING_TO_READMIT)
    (asserts! (not (side-full-x depositors who)) ERR_QUEUE_FULL)
    (asserts! (not (would-take-as-x price limit)) ERR_MUST_USE_SWAP)
    (map-set token-x-deposits {
      cycle: cycle,
      depositor: who,
    }
      amount
    )
    (map-set token-x-depositor-list cycle
      (unwrap-panic (as-max-len? (append depositors who) u50))
    )
    (map-set cycle-totals cycle
      (merge totals { total-token-x: (+ (get total-token-x totals) amount) })
    )
    (map-delete token-x-parked who)
    (try! (contract-call? .mock-jing-core log-readmit-x who amount cycle price
      (var-get token-x) (var-get token-y)
    ))
    (ok amount)
  )
)

(define-public (set-token-y-limit
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
  )
  (begin
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts!
      (or
        (> (get-token-y-deposit (var-get current-cycle) tx-sender) u0)
        (> (get-token-y-parked tx-sender) u0)
      )
      ERR_NOTHING_TO_WITHDRAW
    )
    (if (> (len (get-token-x-depositors (var-get current-cycle))) u0)
      (let ((price (try! (fresh-classification-price update))))
        (asserts!
          (not (would-take-as-y price (order-y-price limit-price spread-bps price)))
          ERR_MUST_USE_SWAP
        )
      )
      true
    )
    (map-set token-y-deposit-limits tx-sender {
      limit: limit-price,
      spread-bps: spread-bps,
    })
    (try! (contract-call? .mock-jing-core log-set-limit-y tx-sender limit-price
      (var-get token-x) (var-get token-y)
    ))
    (try! (log-peg-y-if spread-bps limit-price))
    (ok true)
  )
)
(define-public (set-token-x-limit
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
  )
  (begin
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts!
      (or
        (> (get-token-x-deposit (var-get current-cycle) tx-sender) u0)
        (> (get-token-x-parked tx-sender) u0)
      )
      ERR_NOTHING_TO_WITHDRAW
    )
    (if (> (len (get-token-y-depositors (var-get current-cycle))) u0)
      (let ((price (try! (fresh-classification-price update))))
        (asserts!
          (not (would-take-as-x price (order-x-price limit-price spread-bps price)))
          ERR_MUST_USE_SWAP
        )
      )
      true
    )
    (map-set token-x-deposit-limits tx-sender {
      limit: limit-price,
      spread-bps: spread-bps,
    })
    (try! (contract-call? .mock-jing-core log-set-limit-x tx-sender limit-price
      (var-get token-x) (var-get token-y)
    ))
    (try! (log-peg-x-if spread-bps limit-price))
    (ok true)
  )
)
(define-public (reprice-or-swap-token-y
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (amount (get-token-y-deposit cycle tx-sender))
    )
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts! (> amount u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (is-eq (contract-of tx-trait) (var-get token-x)) ERR_WRONG_TRAIT)
    (asserts! (is-eq (contract-of ty-trait) (var-get token-y)) ERR_WRONG_TRAIT)
    (map-set token-y-deposit-limits tx-sender {
      limit: limit-price,
      spread-bps: spread-bps,
    })
    (try! (contract-call? .mock-jing-core log-set-limit-y tx-sender limit-price
      (var-get token-x) (var-get token-y)
    ))
    (try! (log-peg-y-if spread-bps limit-price))
    (if (and
        (> (len (get-token-x-depositors cycle)) u0)
        (let ((price (try! (fresh-classification-price update))))
          (would-take-as-y price (order-y-price limit-price spread-bps price))
        )
      )
      (let ((rebate (/ (* amount TAKER_REBATE_BPS) BPS_PRECISION)))
        (and
          (> rebate u0)
          (try! (stx-transfer? rebate tx-sender current-contract))
        )
        (var-set pending-rebate-y rebate)
        (var-set crossing true)
        (let ((result (try! (settle-with-refresh update tx-trait tx-name ty-trait ty-name))))
          (ok (swap-result-y result
            (try! (cross-remainder-as-y limit-price (get token-y-rolled result)
              tx-trait tx-name
            ))
          ))
        )
      )
      (ok {
        token-x-received: u0,
        token-y-rolled: u0,
        token-y-received: u0,
        token-x-rolled: u0,
        rebate-refunded: u0,
      })
    )
  )
)

(define-public (reprice-or-swap-token-x
    (limit-price uint)
    (spread-bps (optional uint))
    (update (buff 8192))
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
  )
  (let (
      (cycle (var-get current-cycle))
      (amount (get-token-x-deposit cycle tx-sender))
    )
    (asserts! (> limit-price u0) ERR_LIMIT_REQUIRED)
    (asserts! (valid-spread spread-bps) ERR_BAD_SPREAD)
    (asserts! (> amount u0) ERR_NOTHING_TO_WITHDRAW)
    (asserts! (is-eq (contract-of tx-trait) (var-get token-x)) ERR_WRONG_TRAIT)
    (asserts! (is-eq (contract-of ty-trait) (var-get token-y)) ERR_WRONG_TRAIT)
    (map-set token-x-deposit-limits tx-sender {
      limit: limit-price,
      spread-bps: spread-bps,
    })
    (try! (contract-call? .mock-jing-core log-set-limit-x tx-sender limit-price
      (var-get token-x) (var-get token-y)
    ))
    (try! (log-peg-x-if spread-bps limit-price))
    (if (and
        (> (len (get-token-y-depositors cycle)) u0)
        (let ((price (try! (fresh-classification-price update))))
          (would-take-as-x price (order-x-price limit-price spread-bps price))
        )
      )
      (let ((rebate (/ (* amount TAKER_REBATE_BPS) BPS_PRECISION)))
        (and
          (> rebate u0)
          (try! (contract-call? tx-trait transfer rebate tx-sender current-contract
            none
          ))
        )
        (var-set pending-rebate-x rebate)
        (var-set crossing true)
        (let ((result (try! (settle-with-refresh update tx-trait tx-name ty-trait ty-name))))
          (ok (swap-result-x result
            (try! (cross-remainder-as-x limit-price (get token-x-rolled result)
              tx-trait tx-name
            ))
          ))
        )
      )
      (ok {
        token-x-received: u0,
        token-y-rolled: u0,
        token-y-received: u0,
        token-x-rolled: u0,
        rebate-refunded: u0,
      })
    )
  )
)

(define-private (filter-small-token-y-depositor (depositor principal))
  (let (
      (cycle (var-get current-cycle))
      (totals (get-cycle-totals cycle))
      (total-token-y (get total-token-y totals))
      (amount (get-token-y-deposit cycle depositor))
      (next-cycle (+ cycle u1))
      (totals-next (get-cycle-totals next-cycle))
    )
    (if (< (* amount BPS_PRECISION) (* total-token-y MIN_SHARE_BPS))
      (if (and (var-get crossing) (is-eq depositor tx-sender))
        (ok (var-set taker-too-small true))
        (begin
          (map-set token-y-deposits {
            cycle: next-cycle,
            depositor: depositor,
          }
            amount
          )
          (map-set token-y-depositor-list next-cycle
            (unwrap-panic (as-max-len? (append (get-token-y-depositors next-cycle) depositor)
              u50
            ))
          )
          (map-set cycle-totals next-cycle
            (merge totals-next { total-token-y: (+ (get total-token-y totals-next) amount) })
          )
          (map-delete token-y-deposits {
            cycle: cycle,
            depositor: depositor,
          })
          (var-set bumped-token-y-principal depositor)
          (map-set token-y-depositor-list cycle
            (filter not-eq-bumped-token-y (get-token-y-depositors cycle))
          )
          (map-set cycle-totals cycle
            (merge totals { total-token-y: (- total-token-y amount) })
          )
          (try! (contract-call? .mock-jing-core log-small-share-roll-y depositor cycle
            amount (var-get token-x) (var-get token-y)
          ))
          (ok true)
        )
      )
      (ok true)
    )
  )
)

(define-private (filter-small-token-x-depositor (depositor principal))
  (let (
      (cycle (var-get current-cycle))
      (totals (get-cycle-totals cycle))
      (total-token-x (get total-token-x totals))
      (amount (get-token-x-deposit cycle depositor))
      (next-cycle (+ cycle u1))
      (totals-next (get-cycle-totals next-cycle))
    )
    (if (< (* amount BPS_PRECISION) (* total-token-x MIN_SHARE_BPS))
      (if (and (var-get crossing) (is-eq depositor tx-sender))
        (ok (var-set taker-too-small true))
        (begin
          (map-set token-x-deposits {
            cycle: next-cycle,
            depositor: depositor,
          }
            amount
          )
          (map-set token-x-depositor-list next-cycle
            (unwrap-panic (as-max-len? (append (get-token-x-depositors next-cycle) depositor)
              u50
            ))
          )
          (map-set cycle-totals next-cycle
            (merge totals-next { total-token-x: (+ (get total-token-x totals-next) amount) })
          )
          (map-delete token-x-deposits {
            cycle: cycle,
            depositor: depositor,
          })
          (var-set bumped-token-x-principal depositor)
          (map-set token-x-depositor-list cycle
            (filter not-eq-bumped-token-x (get-token-x-depositors cycle))
          )
          (map-set cycle-totals cycle
            (merge totals { total-token-x: (- total-token-x amount) })
          )
          (try! (contract-call? .mock-jing-core log-small-share-roll-x depositor cycle
            amount (var-get token-x) (var-get token-y)
          ))
          (ok true)
        )
      )
      (ok true)
    )
  )
)

(define-private (filter-limit-violating-token-y-depositor (depositor principal))
  (let (
      (cycle (var-get current-cycle))
      (totals (get-cycle-totals cycle))
      (amount (get-token-y-deposit cycle depositor))
      (next-cycle (+ cycle u1))
      (totals-next (get-cycle-totals next-cycle))
      (clearing (var-get settle-clearing-price))
      (limit (token-y-limit-at depositor clearing))
    )
    (if (> clearing limit)
      (begin
        (map-set token-y-deposits {
          cycle: next-cycle,
          depositor: depositor,
        }
          amount
        )
        (map-set token-y-depositor-list next-cycle
          (unwrap-panic (as-max-len? (append (get-token-y-depositors next-cycle) depositor) u50))
        )
        (map-set cycle-totals next-cycle
          (merge totals-next { total-token-y: (+ (get total-token-y totals-next) amount) })
        )
        (map-delete token-y-deposits {
          cycle: cycle,
          depositor: depositor,
        })
        (var-set bumped-token-y-principal depositor)
        (map-set token-y-depositor-list cycle
          (filter not-eq-bumped-token-y (get-token-y-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-y: (- (get total-token-y totals) amount) })
        )
        (try! (contract-call? .mock-jing-core log-limit-roll-y depositor cycle amount
          limit clearing (var-get token-x) (var-get token-y)
        ))
        (ok true)
      )
      (ok true)
    )
  )
)

(define-private (filter-limit-violating-token-x-depositor (depositor principal))
  (let (
      (cycle (var-get current-cycle))
      (totals (get-cycle-totals cycle))
      (amount (get-token-x-deposit cycle depositor))
      (next-cycle (+ cycle u1))
      (totals-next (get-cycle-totals next-cycle))
      (clearing (var-get settle-clearing-price))
      (limit (token-x-limit-at depositor clearing))
    )
    (if (< clearing limit)
      (begin
        (map-set token-x-deposits {
          cycle: next-cycle,
          depositor: depositor,
        }
          amount
        )
        (map-set token-x-depositor-list next-cycle
          (unwrap-panic (as-max-len? (append (get-token-x-depositors next-cycle) depositor) u50))
        )
        (map-set cycle-totals next-cycle
          (merge totals-next { total-token-x: (+ (get total-token-x totals-next) amount) })
        )
        (map-delete token-x-deposits {
          cycle: cycle,
          depositor: depositor,
        })
        (var-set bumped-token-x-principal depositor)
        (map-set token-x-depositor-list cycle
          (filter not-eq-bumped-token-x (get-token-x-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge totals { total-token-x: (- (get total-token-x totals) amount) })
        )
        (try! (contract-call? .mock-jing-core log-limit-roll-x depositor cycle amount
          limit clearing (var-get token-x) (var-get token-y)
        ))
        (ok true)
      )
      (ok true)
    )
  )
)

(define-public (settle-with-refresh
    (update (buff 8192))
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
  )
  (begin
    (asserts! (is-eq (contract-of tx-trait) (var-get token-x)) ERR_WRONG_TRAIT)
    (asserts! (is-eq (contract-of ty-trait) (var-get token-y)) ERR_WRONG_TRAIT)
    (let (
        (feeds (try! (lazer-feeds update)))
        (feed-x (get feed-x feeds))
        (feed-y (get feed-y feeds))
        (cycle (var-get current-cycle))
      )
      (try! (execute-settlement cycle feed-x feed-y tx-trait tx-name ty-trait ty-name))
      (var-set acc-token-x-out u0)
      (var-set acc-token-y-out u0)
      (var-set acc-token-y-rolled u0)
      (var-set acc-token-x-rolled u0)
      (var-set acc-token-y-refunded u0)
      (var-set acc-token-x-refunded u0)
      (var-set caller-token-x-received u0)
      (var-set caller-token-y-rolled u0)
      (var-set caller-token-y-received u0)
      (var-set caller-token-x-rolled u0)
      (try! (fold distribute-to-token-y-depositor (get-token-y-depositors cycle)
        (ok {
          t: tx-trait,
          name: tx-name,
        })
      ))
      (try! (fold distribute-to-token-x-depositor (get-token-x-depositors cycle)
        (ok {
          t: tx-trait,
          name: tx-name,
        })
      ))
      (try! (roll-and-sweep-dust tx-trait tx-name ty-trait ty-name))
      (advance-cycle)
      (ok {
        token-x-received: (var-get caller-token-x-received),
        token-y-rolled: (var-get caller-token-y-rolled),
        token-y-received: (var-get caller-token-y-received),
        token-x-rolled: (var-get caller-token-x-rolled),
      })
    )
  )
)

(define-public (swap
    (amount uint)
    (limit-price uint)
    (update (buff 8192))
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
    (deposit-x bool)
  )
  (let (
      (rebate (/ (* amount TAKER_REBATE_BPS) BPS_PRECISION))
      (net (- amount rebate))
      (cycle (var-get current-cycle))
    )
    (asserts! (> net u0) ERR_DEPOSIT_TOO_SMALL)
    (asserts!
      (is-eq
        (if deposit-x
          (get-token-x-deposit cycle tx-sender)
          (get-token-y-deposit cycle tx-sender)
        )
        u0
      )
      ERR_HAS_RESTING_POSITION
    )
    (asserts!
      (is-eq
        (if deposit-x
          (get-token-x-parked tx-sender)
          (get-token-y-parked tx-sender)
        )
        u0
      )
      ERR_HAS_RESTING_POSITION
    )
    (if deposit-x
      (begin
        (and
          (> rebate u0)
          (try! (contract-call? tx-trait transfer rebate tx-sender current-contract
            none
          ))
        )
        (var-set pending-rebate-x rebate)
        (try! (deposit-token-x-core net limit-price none u0 u0 tx-trait tx-name))
      )
      (begin
        (and (> rebate u0) (try! (stx-transfer? rebate tx-sender current-contract)))
        (var-set pending-rebate-y rebate)
        (try! (deposit-token-y-core net limit-price none u0 u0 ty-trait ty-name))
      )
    )
    (var-set crossing true)
    (let ((result (try! (settle-with-refresh update tx-trait tx-name ty-trait ty-name))))
      (if deposit-x
        (ok (swap-result-x result
          (try! (cross-remainder-as-x limit-price (get token-x-rolled result) tx-trait
            tx-name
          ))
        ))
        (ok (swap-result-y result
          (try! (cross-remainder-as-y limit-price (get token-y-rolled result) tx-trait
            tx-name
          ))
        ))
      )
    )
  )
)

(define-private (execute-fill
    (cycle uint)
    (y-who principal)
    (y-amt uint)
    (x-who principal)
    (x-amt uint)
    (price uint)
    (mid uint)
    (y-is-taker bool)
    (t <ft-trait>)
    (tx-name (string-ascii 128))
  )
  (let (
      (scale (* PRICE_PRECISION DECIMAL_FACTOR))
      (x-from-y (/ (* y-amt scale) price))
      (x-traded (if (> x-amt x-from-y)
        x-from-y
        x-amt
      ))
      (y-traded (/ (* x-traded price) scale))
      (y-fee (/ (* y-traded FEE_BPS) BPS_PRECISION))
      (x-fee (/ (* x-traded FEE_BPS) BPS_PRECISION))
      (reb-y (if y-is-taker
        (let (
            (r (/ (* y-traded TAKER_REBATE_BPS) BPS_PRECISION))
            (pending-rey (var-get pending-rebate-y))
          )
          (if (> r pending-rey)
            pending-rey
            r
          )
        )
        u0
      ))
      (reb-x (if y-is-taker
        u0
        (let (
            (r (/ (* x-traded TAKER_REBATE_BPS) BPS_PRECISION))
            (pending-rex (var-get pending-rebate-x))
          )
          (if (> r pending-rex)
            pending-rex
            r
          )
        )
      ))
      (totals (get-cycle-totals cycle))
      (y-left (- y-amt y-traded))
      (x-left (- x-amt x-traded))
      (y-refund (if (and
          (not y-is-taker)
          (> y-left u0)
          (< y-left (var-get min-token-y-deposit))
        )
        y-left
        u0
      ))
      (x-refund (if (and
          y-is-taker
          (> x-left u0)
          (< x-left (var-get min-token-x-deposit))
        )
        x-left
        u0
      ))
    )
    (if (or (is-eq x-traded u0) (is-eq y-traded u0))
      (ok false)
      (begin
        (var-set pending-rebate-y (- (var-get pending-rebate-y) reb-y))
        (var-set pending-rebate-x (- (var-get pending-rebate-x) reb-x))
        (try! (as-contract? ((with-stx (+ y-traded reb-y)))
          (try! (stx-transfer? (+ (- y-traded y-fee) reb-y) current-contract x-who))
          (if (> y-fee u0)
            (try! (stx-transfer? y-fee current-contract (var-get treasury)))
            true
          )))
        (try! (as-contract? ((with-ft (contract-of t) tx-name (+ x-traded reb-x)))
          (try! (contract-call? t transfer (+ (- x-traded x-fee) reb-x)
            current-contract y-who none
          ))
          (if (> x-fee u0)
            (try! (contract-call? t transfer x-fee current-contract (var-get treasury)
              none
            ))
            true
          )))
        (var-set walk-taker-received
          (+ (var-get walk-taker-received)
            (if y-is-taker
              (- x-traded x-fee)
              (- y-traded y-fee)
            ))
        )
        (if (or (is-eq y-left u0) (> y-refund u0))
          (begin
            (map-delete token-y-deposits {
              cycle: cycle,
              depositor: y-who,
            })
            (map-delete token-y-deposit-limits y-who)
            (var-set bumped-token-y-principal y-who)
            (map-set token-y-depositor-list cycle
              (filter not-eq-bumped-token-y (get-token-y-depositors cycle))
            )
          )
          (map-set token-y-deposits {
            cycle: cycle,
            depositor: y-who,
          }
            y-left
          )
        )
        (if (or (is-eq x-left u0) (> x-refund u0))
          (begin
            (map-delete token-x-deposits {
              cycle: cycle,
              depositor: x-who,
            })
            (map-delete token-x-deposit-limits x-who)
            (var-set bumped-token-x-principal x-who)
            (map-set token-x-depositor-list cycle
              (filter not-eq-bumped-token-x (get-token-x-depositors cycle))
            )
          )
          (map-set token-x-deposits {
            cycle: cycle,
            depositor: x-who,
          }
            x-left
          )
        )
        (if (> y-refund u0)
          (begin
            (try! (as-contract? ((with-stx y-refund))
              (try! (stx-transfer? y-refund current-contract y-who))
            ))
            (try! (contract-call? .mock-jing-core log-refund-y y-who y-refund cycle
              (var-get token-x) (var-get token-y)
            ))
          )
          true
        )
        (if (> x-refund u0)
          (begin
            (try! (as-contract? ((with-ft (contract-of t) tx-name x-refund))
              (try! (contract-call? t transfer x-refund current-contract x-who none))
            ))
            (try! (contract-call? .mock-jing-core log-refund-x x-who x-refund cycle
              (var-get token-x) (var-get token-y)
            ))
          )
          true
        )
        (map-set cycle-totals cycle
          (merge totals {
            total-token-y: (- (get total-token-y totals) (+ y-traded y-refund)),
            total-token-x: (- (get total-token-x totals) (+ x-traded x-refund)),
          })
        )
        (try! (contract-call? .mock-jing-core log-match
          (if y-is-taker
            y-who
            x-who
          )
          (if y-is-taker
            x-who
            y-who
          ) y-is-taker
          x-traded y-traded price mid (- cycle u1) (var-get token-x)
          (var-get token-y)
        ))
        (ok true)
      )
    )
  )
)

(define-private (walk-x-book-step
    (maker principal)
    (acc (response {
      t: <ft-trait>,
      name: (string-ascii 128),
      taker: principal,
      cycle: uint,
      limit: uint,
      mid: uint,
    }
      uint
    ))
  )
  (match acc
    st (let (
        (cycle (get cycle st))
        (takr (get taker st))
        (rem (get-token-y-deposit cycle takr))
        (l (token-x-limit-at maker (get mid st)))
        (m-amt (get-token-x-deposit cycle maker))
      )
      (if (or
          (is-eq rem u0)
          (is-eq maker takr)
          (< m-amt (var-get min-token-x-deposit))
          (is-eq l MAX_UINT)
          (<= l (get mid st))
          (> l (get limit st))
        )
        (ok st)
        (begin
          (try! (execute-fill cycle takr rem maker m-amt l (get mid st) true (get t st)
            (get name st)
          ))
          (ok st)
        )
      )
    )
    e (err e)
  )
)

(define-private (walk-y-book-step
    (maker principal)
    (acc (response {
      t: <ft-trait>,
      name: (string-ascii 128),
      taker: principal,
      cycle: uint,
      limit: uint,
      mid: uint,
    }
      uint
    ))
  )
  (match acc
    st (let (
        (cycle (get cycle st))
        (takr (get taker st))
        (rem (get-token-x-deposit cycle takr))
        (l (token-y-limit-at maker (get mid st)))
        (m-amt (get-token-y-deposit cycle maker))
      )
      (if (or
          (is-eq rem u0)
          (is-eq maker takr)
          (< m-amt (var-get min-token-y-deposit))
          (is-eq l u0)
          (>= l (get mid st))
          (< l (get limit st))
        )
        (ok st)
        (begin
          (try! (execute-fill cycle maker m-amt takr rem l (get mid st) false
            (get t st) (get name st)
          ))
          (ok st)
        )
      )
    )
    e (err e)
  )
)

(define-private (push-quote
    (lst (list 50 {
      who: principal,
      l: uint,
    }))
    (e {
      who: principal,
      l: uint,
    })
  )
  (unwrap-panic (as-max-len? (append lst e) u50))
)

(define-private (quote-who (e {
  who: principal,
  l: uint,
}))
  (get who e)
)

(define-private (insert-ask-step
    (entry {
      who: principal,
      l: uint,
    })
    (acc {
      e: {
        who: principal,
        l: uint,
      },
      out: (list 50 {
        who: principal,
        l: uint,
      }),
      placed: bool,
    })
  )
  (if (and (not (get placed acc)) (< (get l (get e acc)) (get l entry)))
    (merge acc {
      out: (push-quote (push-quote (get out acc) (get e acc)) entry),
      placed: true,
    })
    (merge acc { out: (push-quote (get out acc) entry) })
  )
)

(define-private (insert-bid-step
    (entry {
      who: principal,
      l: uint,
    })
    (acc {
      e: {
        who: principal,
        l: uint,
      },
      out: (list 50 {
        who: principal,
        l: uint,
      }),
      placed: bool,
    })
  )
  (if (and (not (get placed acc)) (> (get l (get e acc)) (get l entry)))
    (merge acc {
      out: (push-quote (push-quote (get out acc) (get e acc)) entry),
      placed: true,
    })
    (merge acc { out: (push-quote (get out acc) entry) })
  )
)

(define-private (collect-ask-step
    (maker principal)
    (acc {
      cycle: uint,
      mid: uint,
      limit: uint,
      out: (list 50 {
        who: principal,
        l: uint,
      }),
    })
  )
  (let (
      (l (token-x-limit-at maker (get mid acc)))
      (m-amt (get-token-x-deposit (get cycle acc) maker))
    )
    (if (or
        (< m-amt (var-get min-token-x-deposit))
        (is-eq l MAX_UINT)
        (<= l (get mid acc))
        (> l (get limit acc))
      )
      acc
      (let ((r (fold insert-ask-step (get out acc) {
          e: {
            who: maker,
            l: l,
          },
          out: (list),
          placed: false,
        })))
        (merge acc { out: (if (get placed r)
          (get out r)
          (push-quote (get out r) {
            who: maker,
            l: l,
          })
        ) }
        )
      )
    )
  )
)

(define-private (collect-bid-step
    (maker principal)
    (acc {
      cycle: uint,
      mid: uint,
      limit: uint,
      out: (list 50 {
        who: principal,
        l: uint,
      }),
    })
  )
  (let (
      (l (token-y-limit-at maker (get mid acc)))
      (m-amt (get-token-y-deposit (get cycle acc) maker))
    )
    (if (or
        (< m-amt (var-get min-token-y-deposit))
        (is-eq l u0)
        (>= l (get mid acc))
        (< l (get limit acc))
      )
      acc
      (let ((r (fold insert-bid-step (get out acc) {
          e: {
            who: maker,
            l: l,
          },
          out: (list),
          placed: false,
        })))
        (merge acc { out: (if (get placed r)
          (get out r)
          (push-quote (get out r) {
            who: maker,
            l: l,
          })
        ) }
        )
      )
    )
  )
)

(define-private (sorted-asks
    (cycle uint)
    (mid uint)
    (limit uint)
  )
  (map quote-who
    (get out
      (fold collect-ask-step (get-token-x-depositors cycle) {
        cycle: cycle,
        mid: mid,
        limit: limit,
        out: (list),
      })
    ))
)

(define-private (sorted-bids
    (cycle uint)
    (mid uint)
    (limit uint)
  )
  (map quote-who
    (get out
      (fold collect-bid-step (get-token-y-depositors cycle) {
        cycle: cycle,
        mid: mid,
        limit: limit,
        out: (list),
      })
    ))
)

(define-private (swap-result-x
    (result {
      token-x-received: uint,
      token-y-rolled: uint,
      token-y-received: uint,
      token-x-rolled: uint,
    })
    (cross {
      rem: uint,
      left: uint,
      walk-received: uint,
    })
  )
  (merge result {
    token-y-received: (+ (get token-y-received result) (get walk-received cross)),
    token-x-rolled: (get rem cross),
    rebate-refunded: (get left cross),
  })
)

(define-private (swap-result-y
    (result {
      token-x-received: uint,
      token-y-rolled: uint,
      token-y-received: uint,
      token-x-rolled: uint,
    })
    (cross {
      rem: uint,
      left: uint,
      walk-received: uint,
    })
  )
  (merge result {
    token-x-received: (+ (get token-x-received result) (get walk-received cross)),
    token-y-rolled: (get rem cross),
    rebate-refunded: (get left cross),
  })
)

(define-private (cross-remainder-as-y
    (limit uint)
    (rolled uint)
    (t <ft-trait>)
    (tx-name (string-ascii 128))
  )
  (let (
      (swapper tx-sender)
      (cycle (var-get current-cycle))
      (reset (var-set walk-taker-received u0))
      (walked (and
        (> rolled u0)
        (begin
          (try! (fold walk-x-book-step
            (sorted-asks cycle (var-get settle-clearing-price) limit)
            (ok {
              t: t,
              name: tx-name,
              taker: swapper,
              cycle: cycle,
              limit: limit,
              mid: (var-get settle-clearing-price),
            })
          ))
          true
        )
      ))
      (left (var-get pending-rebate-y))
      (rem (get-token-y-deposit cycle swapper))
    )
    (and
      (> left u0)
      (try! (as-contract? ((with-stx left))
        (try! (stx-transfer? left current-contract swapper))
      ))
    )
    (var-set pending-rebate-y u0)
    (asserts! (< rem (var-get min-token-y-deposit)) ERR_PARTIAL_FILL)
    (and
      (> rem u0)
      (begin
        (try! (as-contract? ((with-stx rem))
          (try! (stx-transfer? rem current-contract swapper))
        ))
        (map-delete token-y-deposits {
          cycle: cycle,
          depositor: swapper,
        })
        (map-delete token-y-deposit-limits swapper)
        (var-set bumped-token-y-principal swapper)
        (map-set token-y-depositor-list cycle
          (filter not-eq-bumped-token-y (get-token-y-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge (get-cycle-totals cycle) { total-token-y: (- (get total-token-y (get-cycle-totals cycle)) rem) })
        )
        true
      )
    )
    (var-set crossing false)
    (ok {
      rem: rem,
      left: left,
      walk-received: (var-get walk-taker-received),
    })
  )
)
(define-private (cross-remainder-as-x
    (limit uint)
    (rolled uint)
    (t <ft-trait>)
    (tx-name (string-ascii 128))
  )
  (let (
      (swapper tx-sender)
      (cycle (var-get current-cycle))
      (reset (var-set walk-taker-received u0))
      (walked (and
        (> rolled u0)
        (begin
          (try! (fold walk-y-book-step
            (sorted-bids cycle (var-get settle-clearing-price) limit)
            (ok {
              t: t,
              name: tx-name,
              taker: swapper,
              cycle: cycle,
              limit: limit,
              mid: (var-get settle-clearing-price),
            })
          ))
          true
        )
      ))
      (left (var-get pending-rebate-x))
      (rem (get-token-x-deposit cycle swapper))
    )
    (and
      (> left u0)
      (try! (as-contract? ((with-ft (contract-of t) tx-name left))
        (try! (contract-call? t transfer left current-contract swapper none))
      ))
    )
    (var-set pending-rebate-x u0)
    (asserts! (< rem (var-get min-token-x-deposit)) ERR_PARTIAL_FILL)
    (and
      (> rem u0)
      (begin
        (try! (as-contract? ((with-ft (contract-of t) tx-name rem))
          (try! (contract-call? t transfer rem current-contract swapper none))
        ))
        (map-delete token-x-deposits {
          cycle: cycle,
          depositor: swapper,
        })
        (map-delete token-x-deposit-limits swapper)
        (var-set bumped-token-x-principal swapper)
        (map-set token-x-depositor-list cycle
          (filter not-eq-bumped-token-x (get-token-x-depositors cycle))
        )
        (map-set cycle-totals cycle
          (merge (get-cycle-totals cycle) { total-token-x: (- (get total-token-x (get-cycle-totals cycle)) rem) })
        )
        true
      )
    )
    (var-set crossing false)
    (ok {
      rem: rem,
      left: left,
      walk-received: (var-get walk-taker-received),
    })
  )
)
(define-private (execute-settlement
    (cycle uint)
    (feed-x {
      price: int,
      conf: uint,
      expo: int,
      ema-price: int,
      ema-conf: uint,
      publish-time: uint,
      prev-publish-time: uint,
    })
    (feed-y {
      price: int,
      conf: uint,
      expo: int,
      ema-price: int,
      ema-conf: uint,
      publish-time: uint,
      prev-publish-time: uint,
    })
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
  )
  (let (
      (price-x (to-uint (get price feed-x)))
      (price-y (to-uint (get price feed-y)))
      (min-freshness (- stacks-block-time MAX_STALENESS))
      (raw (get-cycle-totals cycle))
    )
    (asserts! (not (var-get paused)) ERR_PAUSED)
    (asserts!
      (and
        (>= (get total-token-y raw) (var-get min-token-y-deposit))
        (>= (get total-token-x raw) (var-get min-token-x-deposit))
      )
      ERR_NOTHING_TO_SETTLE
    )
    (asserts! (is-none (map-get? settlements cycle)) ERR_ALREADY_SETTLED)
    (asserts! (> price-x u0) ERR_ZERO_PRICE)
    (asserts! (> price-y u0) ERR_ZERO_PRICE)
    (asserts! (> (get publish-time feed-x) min-freshness) ERR_STALE_PRICE)
    (asserts! (> (get publish-time feed-y) min-freshness) ERR_STALE_PRICE)
    (asserts! (< (get conf feed-x) (/ price-x MAX_CONF_RATIO))
      ERR_PRICE_UNCERTAIN
    )
    (asserts! (< (get conf feed-y) (/ price-y MAX_CONF_RATIO))
      ERR_PRICE_UNCERTAIN
    )
    (asserts! (is-eq (get expo feed-x) (get expo feed-y)) ERR_EXPO_MISMATCH)
    (let ((oracle-price (/ (* price-x PRICE_PRECISION) price-y)))
      (asserts! (> oracle-price u0) ERR_ZERO_PRICE)

      (var-set settle-clearing-price oracle-price)
      (map filter-limit-violating-token-y-depositor
        (get-token-y-depositors cycle)
      )
      (map filter-limit-violating-token-x-depositor
        (get-token-x-depositors cycle)
      )
      (var-set taker-too-small false)
      (map filter-small-token-y-depositor (get-token-y-depositors cycle))
      (map filter-small-token-x-depositor (get-token-x-depositors cycle))
      (asserts! (not (var-get taker-too-small)) ERR_TAKER_TOO_SMALL)
      (let (
          (totals (get-cycle-totals cycle))
          (total-token-y (get total-token-y totals))
          (total-token-x (get total-token-x totals))
          (token-y-value-of-token-x (/ (* total-token-x oracle-price) (* PRICE_PRECISION DECIMAL_FACTOR)))
          (token-x-is-binding (<= token-y-value-of-token-x total-token-y))
          (token-y-clearing (if token-x-is-binding
            token-y-value-of-token-x
            total-token-y
          ))
          (token-x-clearing (if token-x-is-binding
            total-token-x
            (/ (* total-token-y (* PRICE_PRECISION DECIMAL_FACTOR)) oracle-price)
          ))
          (token-y-fee (/ (* token-y-clearing FEE_BPS) BPS_PRECISION))
          (token-x-fee (/ (* token-x-clearing FEE_BPS) BPS_PRECISION))
          (token-y-unfilled (- total-token-y token-y-clearing))
          (token-x-unfilled (- total-token-x token-x-clearing))
          (rebate-x (var-get pending-rebate-x))
          (rebate-y (var-get pending-rebate-y))
          (ride-x (if (> total-token-x u0)
            (/ (* rebate-x token-x-clearing) total-token-x)
            u0
          ))
          (ride-y (if (> total-token-y u0)
            (/ (* rebate-y token-y-clearing) total-token-y)
            u0
          ))
        )
        (asserts!
          (or
            (var-get crossing)
            (and
              (>= total-token-y (var-get min-token-y-deposit))
              (>= total-token-x (var-get min-token-x-deposit))
            )
          )
          ERR_NOTHING_TO_SETTLE
        )
        (map-set settlements cycle {
          price: oracle-price,
          token-y-cleared: token-y-clearing,
          token-x-cleared: token-x-clearing,
          token-y-fee: token-y-fee,
          token-x-fee: token-x-fee,
          settled-at: stacks-block-height,
        })
        (if (> token-y-fee u0)
          (try! (as-contract? ((with-stx token-y-fee))
            (try! (stx-transfer? token-y-fee current-contract (var-get treasury)))
          ))
          true
        )
        (if (> token-x-fee u0)
          (try! (as-contract? ((with-ft (contract-of tx-trait) tx-name token-x-fee))
            (try! (contract-call? tx-trait transfer token-x-fee current-contract
              (var-get treasury) none
            ))
          ))
          true
        )
        (var-set settle-token-y-cleared token-y-clearing)
        (var-set settle-token-x-cleared token-x-clearing)
        (var-set settle-total-token-y total-token-y)
        (var-set settle-total-token-x total-token-x)
        (var-set settle-token-x-after-fee
          (+ (- token-x-clearing token-x-fee) ride-x)
        )
        (var-set settle-token-y-after-fee
          (+ (- token-y-clearing token-y-fee) ride-y)
        )
        (var-set pending-rebate-x (- rebate-x ride-x))
        (var-set pending-rebate-y (- rebate-y ride-y))
        (try! (contract-call? .mock-jing-core log-settlement cycle oracle-price
          oracle-price token-x-clearing token-y-clearing token-x-unfilled
          token-y-unfilled token-x-fee token-y-fee ride-x ride-y
          token-x-is-binding (var-get token-x) (var-get token-y)
        ))
        (ok true)
      )
    )
  )
)

(define-private (distribute-to-token-y-depositor
    (depositor principal)
    (acc (response {
      t: <ft-trait>,
      name: (string-ascii 128),
    } uint
    ))
  )
  (let (
      (unwrapped (try! acc))
      (tt (get t unwrapped))
      (cycle (var-get current-cycle))
      (my-deposit (get-token-y-deposit cycle depositor))
      (total-token-y (var-get settle-total-token-y))
      (my-token-x-received (if (> total-token-y u0)
        (/ (* my-deposit (var-get settle-token-x-after-fee)) total-token-y)
        u0
      ))
      (my-token-y-unfilled (if (> total-token-y u0)
        (/ (* my-deposit (- total-token-y (var-get settle-token-y-cleared)))
          total-token-y
        )
        u0
      ))
      (my-token-y-cleared (- my-deposit my-token-y-unfilled))
      (my-refund (if (and
          (> my-token-y-unfilled u0)
          (< my-token-y-unfilled (var-get min-token-y-deposit))
          (not (and (var-get crossing) (is-eq depositor tx-sender)))
        )
        my-token-y-unfilled
        u0
      ))
      (my-roll (- my-token-y-unfilled my-refund))
      (next-cycle (+ cycle u1))
    )
    (map-delete token-y-deposits {
      cycle: cycle,
      depositor: depositor,
    })
    (var-set acc-token-x-out (+ (var-get acc-token-x-out) my-token-x-received))
    (var-set acc-token-y-rolled (+ (var-get acc-token-y-rolled) my-roll))
    (var-set acc-token-y-refunded (+ (var-get acc-token-y-refunded) my-refund))
    (if (is-eq depositor tx-sender)
      (begin
        (var-set caller-token-x-received my-token-x-received)
        (var-set caller-token-y-rolled my-token-y-unfilled)
        true
      )
      true
    )
    (if (> my-token-x-received u0)
      (try! (as-contract?
        ((with-ft (contract-of tt) (get name unwrapped) my-token-x-received))
        (try! (contract-call? tt transfer my-token-x-received current-contract
          depositor none
        ))
      ))
      true
    )
    (if (> my-roll u0)
      (begin
        (map-set token-y-deposits {
          cycle: next-cycle,
          depositor: depositor,
        }
          my-roll
        )
        (map-set token-y-depositor-list next-cycle
          (unwrap-panic (as-max-len? (append (get-token-y-depositors next-cycle) depositor) u50))
        )
        true
      )
      (begin
        (map-delete token-y-deposit-limits depositor)
        (if (> my-refund u0)
          (begin
            (try! (as-contract? ((with-stx my-refund))
              (try! (stx-transfer? my-refund current-contract depositor))
            ))
            (try! (contract-call? .mock-jing-core log-refund-y depositor my-refund cycle
              (var-get token-x) (var-get token-y)
            ))
          )
          true
        )
      )
    )
    (try! (contract-call? .mock-jing-core log-distribute-y-depositor depositor cycle
      my-token-x-received my-token-y-cleared my-roll (var-get token-x)
      (var-get token-y)
    ))
    (ok unwrapped)
  )
)

(define-private (distribute-to-token-x-depositor
    (depositor principal)
    (acc (response {
      t: <ft-trait>,
      name: (string-ascii 128),
    } uint
    ))
  )
  (let (
      (unwrapped (try! acc))
      (tt (get t unwrapped))
      (cycle (var-get current-cycle))
      (my-deposit (get-token-x-deposit cycle depositor))
      (total-token-x (var-get settle-total-token-x))
      (my-token-y-received (if (> total-token-x u0)
        (/ (* my-deposit (var-get settle-token-y-after-fee)) total-token-x)
        u0
      ))
      (my-token-x-unfilled (if (> total-token-x u0)
        (/ (* my-deposit (- total-token-x (var-get settle-token-x-cleared)))
          total-token-x
        )
        u0
      ))
      (my-token-x-cleared (- my-deposit my-token-x-unfilled))
      (my-refund (if (and
          (> my-token-x-unfilled u0)
          (< my-token-x-unfilled (var-get min-token-x-deposit))
          (not (and (var-get crossing) (is-eq depositor tx-sender)))
        )
        my-token-x-unfilled
        u0
      ))
      (my-roll (- my-token-x-unfilled my-refund))
      (next-cycle (+ cycle u1))
    )
    (map-delete token-x-deposits {
      cycle: cycle,
      depositor: depositor,
    })
    (var-set acc-token-y-out (+ (var-get acc-token-y-out) my-token-y-received))
    (var-set acc-token-x-rolled (+ (var-get acc-token-x-rolled) my-roll))
    (var-set acc-token-x-refunded (+ (var-get acc-token-x-refunded) my-refund))
    (if (is-eq depositor tx-sender)
      (begin
        (var-set caller-token-y-received my-token-y-received)
        (var-set caller-token-x-rolled my-token-x-unfilled)
        true
      )
      true
    )
    (if (> my-token-y-received u0)
      (try! (as-contract? ((with-stx my-token-y-received))
        (try! (stx-transfer? my-token-y-received current-contract depositor))
      ))
      true
    )
    (if (> my-roll u0)
      (begin
        (map-set token-x-deposits {
          cycle: next-cycle,
          depositor: depositor,
        }
          my-roll
        )
        (map-set token-x-depositor-list next-cycle
          (unwrap-panic (as-max-len? (append (get-token-x-depositors next-cycle) depositor) u50))
        )
        true
      )
      (begin
        (map-delete token-x-deposit-limits depositor)
        (if (> my-refund u0)
          (begin
            (try! (as-contract?
              ((with-ft (contract-of tt) (get name unwrapped) my-refund))
              (try! (contract-call? tt transfer my-refund current-contract depositor
                none
              ))
            ))
            (try! (contract-call? .mock-jing-core log-refund-x depositor my-refund cycle
              (var-get token-x) (var-get token-y)
            ))
          )
          true
        )
      )
    )
    (try! (contract-call? .mock-jing-core log-distribute-x-depositor depositor cycle
      my-token-y-received my-token-x-cleared my-roll (var-get token-x)
      (var-get token-y)
    ))
    (ok unwrapped)
  )
)

(define-private (roll-and-sweep-dust
    (tx-trait <ft-trait>)
    (tx-name (string-ascii 128))
    (ty-trait <ft-trait>)
    (ty-name (string-ascii 128))
  )
  (let (
      (acc-token-y-rol (var-get acc-token-y-rolled))
      (acc-token-x-rol (var-get acc-token-x-rolled))
      (token-y-payout-dust (- (var-get settle-token-y-after-fee) (var-get acc-token-y-out)))
      (token-y-roll-dust (- (- (var-get settle-total-token-y) (var-get settle-token-y-cleared))
        (+ acc-token-y-rol (var-get acc-token-y-refunded))
      ))
      (token-y-dust (+ token-y-payout-dust token-y-roll-dust))
      (token-x-payout-dust (- (var-get settle-token-x-after-fee) (var-get acc-token-x-out)))
      (token-x-roll-dust (- (- (var-get settle-total-token-x) (var-get settle-token-x-cleared))
        (+ acc-token-x-rol (var-get acc-token-x-refunded))
      ))
      (token-x-dust (+ token-x-payout-dust token-x-roll-dust))
      (next-cycle (+ (var-get current-cycle) u1))
      (next-totals (get-cycle-totals next-cycle))
    )
    (map-set cycle-totals next-cycle {
      total-token-y: (+ (get total-token-y next-totals) acc-token-y-rol),
      total-token-x: (+ (get total-token-x next-totals) acc-token-x-rol),
    })
    (if (> token-y-dust u0)
      (try! (as-contract? ((with-stx token-y-dust))
        (try! (stx-transfer? token-y-dust current-contract (var-get treasury)))
      ))
      true
    )
    (if (> token-x-dust u0)
      (try! (as-contract? ((with-ft (contract-of tx-trait) tx-name token-x-dust))
        (try! (contract-call? tx-trait transfer token-x-dust current-contract
          (var-get treasury) none
        ))
      ))
      true
    )
    (try! (contract-call? .mock-jing-core log-sweep-dust acc-token-x-rol acc-token-y-rol
      token-x-dust token-x-payout-dust token-x-roll-dust token-y-dust
      token-y-payout-dust token-y-roll-dust (var-get token-x)
      (var-get token-y)
    ))
    (ok true)
  )
)

(define-public (initialize
    (canonical principal)
    (x principal)
    (y principal)
    (min-x uint)
    (min-y uint)
    (feed-x uint)
    (feed-y uint)
  )
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (asserts! (is-eq tx-sender (contract-call? .mock-jing-core get-contract-owner))
      ERR_NOT_AUTHORIZED
    )
    (asserts! (not (var-get initialized)) ERR_ALREADY_INITIALIZED)
    (asserts! (and (> min-x u0) (> min-y u0)) ERR_ZERO_MIN_DEPOSIT)
    (var-set token-x x)
    (var-set token-y y)
    (var-set min-token-x-deposit min-x)
    (var-set min-token-y-deposit min-y)
    (var-set feed-id-x feed-x)
    (var-set feed-id-y feed-y)
    (var-set initialized true)
    (try! (contract-call? .mock-jing-core register canonical))
    (ok true)
  )
)

(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (ok (var-set treasury new-treasury))
  )
)

(define-public (set-paused (is-paused bool))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (ok (var-set paused is-paused))
  )
)

(define-public (set-operator (new-operator principal))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (ok (var-set operator new-operator))
  )
)

(define-public (set-min-token-y-deposit (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (asserts! (> amount u0) ERR_ZERO_MIN_DEPOSIT)
    (ok (var-set min-token-y-deposit amount))
  )
)

(define-public (set-min-token-x-deposit (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (asserts! (> amount u0) ERR_ZERO_MIN_DEPOSIT)
    (ok (var-set min-token-x-deposit amount))
  )
)

(define-public (set-distance-slots (slots uint))
  (begin
    (asserts! (is-eq tx-sender (var-get operator)) ERR_NOT_AUTHORIZED)
    (asserts! (<= slots MAX_DEPOSITORS) ERR_QUEUE_FULL)
    (ok (var-set distance-slots slots))
  )
)


(define-private (cap-scale)
  (* PRICE_PRECISION DECIMAL_FACTOR)
)

(define-private (cap-bid-fold
    (who principal)
    (acc {
      cycle: uint,
      mid: uint,
      limit: uint,
      in-range: uint,
      walk: uint,
    })
  )
  (let (
      (amt (get-token-y-deposit (get cycle acc) who))
      (l (token-y-limit-at who (get mid acc)))
    )
    (if (>= l (get mid acc))
      (merge acc { in-range: (+ (get in-range acc) amt) })
      (if (and
          (not (is-eq l u0))
          (>= l (get limit acc))
          (>= amt (var-get min-token-y-deposit))
        )
        (merge acc { walk: (+ (get walk acc) (/ (* amt (cap-scale)) l)) })
        acc
      )
    )
  )
)

(define-private (cap-ask-fold
    (who principal)
    (acc {
      cycle: uint,
      mid: uint,
      limit: uint,
      in-range: uint,
      walk: uint,
    })
  )
  (let (
      (amt (get-token-x-deposit (get cycle acc) who))
      (l (token-x-limit-at who (get mid acc)))
    )
    (if (<= l (get mid acc))
      (merge acc { in-range: (+ (get in-range acc) amt) })
      (if (and
          (not (is-eq l MAX_UINT))
          (<= l (get limit acc))
          (>= amt (var-get min-token-x-deposit))
        )
        (merge acc { walk: (+ (get walk acc) (/ (* amt l) (cap-scale))) })
        acc
      )
    )
  )
)

(define-private (gross-up (net uint))
  (let (
      (g (/ (* net BPS_PRECISION) (- BPS_PRECISION TAKER_REBATE_BPS)))
      (n (- g (/ (* g TAKER_REBATE_BPS) BPS_PRECISION)))
    )
    (if (> n net)
      (- g u1)
      g
    )
  )
)

(define-read-only (get-taker-capacity
    (mid uint)
    (limit uint)
    (deposit-x bool)
  )
  (let (
      (cycle (var-get current-cycle))
      (bids (fold cap-bid-fold (get-token-y-depositors cycle) {
        cycle: cycle,
        mid: mid,
        limit: (if deposit-x
          limit
          mid
        ),
        in-range: u0,
        walk: u0,
      }))
      (asks (fold cap-ask-fold (get-token-x-depositors cycle) {
        cycle: cycle,
        mid: mid,
        limit: (if deposit-x
          mid
          limit
        ),
        in-range: u0,
        walk: u0,
      }))
      (opposite (if deposit-x
        (/ (* (get in-range bids) (cap-scale)) mid)
        (/ (* (get in-range asks) mid) (cap-scale))
      ))
      (own (if deposit-x
        (get in-range asks)
        (get in-range bids)
      ))
      (taker-in-range (if deposit-x
        (<= limit mid)
        (>= limit mid)
      ))
      (mid-cap (if (and taker-in-range (> opposite own))
        (- opposite own)
        u0
      ))
      (walk-cap (if deposit-x
        (get walk bids)
        (get walk asks)
      ))
      (net-cap (+ mid-cap walk-cap))
    )
    {
      mid-cap: mid-cap,
      walk-cap: walk-cap,
      net-cap: net-cap,
      gross-cap: (gross-up net-cap),
    }
  )
)

(define-private (prune-one
    (cycle uint)
    (acc (response uint uint))
  )
  (let ((pruned (try! acc)))
    (asserts! (< cycle (var-get current-cycle)) ERR_CYCLE_OPEN)
    (map-delete token-y-depositor-list cycle)
    (map-delete token-x-depositor-list cycle)
    (map-delete cycle-totals cycle)
    (ok (+ pruned u1))
  )
)

(define-public (prune-cycles (cycles (list 50 uint)))
  (fold prune-one cycles (ok u0))
)

(define-public (refresh-mid (update (buff 8192)))
  (fresh-classification-price update)
)


;; ============================================================================
;; RENDEZVOUS INVARIANTS for markets-sbtc-stx-jing-v6 (pegged orders, seats,
;; parking, settle LIVE under fuzz)
;; ============================================================================
;; Append-only block. tests/rv/build.sh concatenates this onto the production
;; source (with the fuzz rewrites listed in its "v6" section) to produce
;; tests/rv/.build/markets-sbtc-stx-jing-v6.clar, the contract `rv` loads.
;;
;; What is different from the v2 target: the Lazer oracle is a mock, so every
;; priced path runs under fuzz: settle-with-refresh, swap, the crossing
;; branch of reprice-or-swap, the book walk, limit rolls, small-share rolls,
;; parks and readmits. The v2 target could only fuzz the deposit phase.
;;
;; RV draws uints from small naturals (fast-check `nat`, under 2^31) and
;; strings at random, which no real price or allowance name survives. The
;; rv-* wrappers below fold a price into a band around a real BTC/STX cross,
;; fold a spread under the 10000 bps ceiling, and pin the allowance name to
;; the mock token; the raw functions stay fuzzable (their calls mostly fail,
;; which is fine). Runtime panics only log in RV: a panic is not a finding
;; here, a false invariant is.
;; ============================================================================

(define-map context (string-ascii 100) { called: uint })

(define-public (update-context (function-name (string-ascii 100)) (called uint))
  (ok (map-set context function-name { called: called })))

;; the ten simnet accounts RV draws senders and principals from
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

;; price band: [2.4e13, 4.0e13) in the market unit (micro-STX per sat x 1e10),
;; i.e. 250.00 to 416.67 sats per STX, in 1e9 steps. u0 stays u0 so the
;; ERR_LIMIT_REQUIRED path is still reachable through the wrappers.
(define-constant RV-MID-BASE u24000000000000)
(define-constant RV-MID-STEPS u16000)
(define-constant RV-MID-STEP u1000000000)

(define-private (rv-price (raw uint))
  (if (is-eq raw u0)
    u0
    (+ RV-MID-BASE (* (mod raw RV-MID-STEPS) RV-MID-STEP))))

;; none stays none (a fixed order); some folds under 11000 so about one in
;; eleven pegs is refused with ERR_BAD_SPREAD and the rest rest
(define-private (rv-spread (raw (optional uint)))
  (match raw s (some (mod s u11000)) none))

;; ---------------------------------------------------------------------------
;; wrappers (fuzzed like any public function of the SUT)
;; ---------------------------------------------------------------------------

(define-public (rv-set-mid (raw uint))
  (contract-call? .mock-lazer-oracle set-mid (rv-price (+ raw u1))))

;; the price moves onto a resting order: the one way a batch settlement
;; arises (the maker gate refuses a crossing book at placement, so both
;; sides are in range only after the mid moved into the book). Bids
;; (y true) and asks (y false); u0 when `who` rests nothing.
(define-public (rv-mid-at (who principal) (y bool))
  (let ((l (if y (get-token-y-limit who) (get-token-x-limit who))))
    (asserts! (> l u0) ERR_NOTHING_TO_SETTLE)
    (contract-call? .mock-lazer-oracle set-mid l)))

;; the same move with a keeper right behind it: a batch settlement at the
;; price of `who`'s order (u1009 when the other side has nothing in range)
(define-public (rv-settle-at (who principal) (y bool))
  (begin
    (try! (rv-mid-at who y))
    (settle-with-refresh 0x .mock-ft "mock-ft" .mock-ft "mock-ft")))

(define-public (rv-deposit-x (amount uint) (limit uint) (spread (optional uint)))
  (deposit-token-x amount (rv-price limit) (rv-spread spread) 0x .mock-ft "mock-ft"))

(define-public (rv-deposit-y (amount uint) (limit uint) (spread (optional uint)))
  (deposit-token-y amount (rv-price limit) (rv-spread spread) 0x .mock-ft "mock-ft"))

(define-public (rv-set-limit-x (limit uint) (spread (optional uint)))
  (set-token-x-limit (rv-price limit) (rv-spread spread) 0x))

(define-public (rv-set-limit-y (limit uint) (spread (optional uint)))
  (set-token-y-limit (rv-price limit) (rv-spread spread) 0x))

(define-public (rv-reprice-x (limit uint) (spread (optional uint)))
  (reprice-or-swap-token-x (rv-price limit) (rv-spread spread) 0x
    .mock-ft "mock-ft" .mock-ft "mock-ft"))

(define-public (rv-reprice-y (limit uint) (spread (optional uint)))
  (reprice-or-swap-token-y (rv-price limit) (rv-spread spread) 0x
    .mock-ft "mock-ft" .mock-ft "mock-ft"))

(define-public (rv-swap (amount uint) (limit uint) (deposit-x bool))
  (swap amount (rv-price limit) 0x .mock-ft "mock-ft" .mock-ft "mock-ft" deposit-x))

(define-public (rv-settle)
  (settle-with-refresh 0x .mock-ft "mock-ft" .mock-ft "mock-ft"))

(define-public (rv-cancel-x)
  (cancel-token-x-deposit .mock-ft "mock-ft"))

(define-public (rv-withdraw-x (amount uint))
  (withdraw-token-x amount .mock-ft "mock-ft"))

;; fuzz aid: the operator (the deployer, one sender in ten) pauses the market
;; in half of its set-paused calls and RV keeps one simnet across runs, so
;; without this the book sits paused for most of a sweep (ERR_PAUSED x70 on
;; settle in the first 300-run sweep). Anyone may unpause here; no
;; invariant reads `paused`.
(define-public (rv-unpause)
  (ok (var-set paused false)))

;; same reason: one random set-min-token-x/y-deposit by the operator (a
;; natural up to 2^31) leaves nothing settleable for the rest of the sweep
(define-public (rv-reset-mins)
  (begin
    (var-set min-token-x-deposit u100)
    (var-set min-token-y-deposit u100)
    (ok true)))

;; seat / unseat an account on the mock ladder, then let the market copy it
(define-public (rv-band-x (who principal) (on bool))
  (begin
    (try! (contract-call? .mock-jing-ladder set-band-x who on))
    (if on
      (begin (try! (sync-seat who)) (ok true))
      (begin (unwrap-panic (prune-seats)) (ok true)))))

(define-public (rv-band-y (who principal) (on bool))
  (begin
    (try! (contract-call? .mock-jing-ladder set-band-y who on))
    (if on
      (begin (try! (sync-seat who)) (ok true))
      (begin (unwrap-panic (prune-seats)) (ok true)))))

;; ---------------------------------------------------------------------------
;; readers
;; ---------------------------------------------------------------------------

(define-private (rv-y-amt-curr (d principal))
  (get-token-y-deposit (var-get current-cycle) d))
(define-private (rv-y-amt-next (d principal))
  (get-token-y-deposit (+ (var-get current-cycle) u1) d))
(define-private (rv-x-amt-curr (d principal))
  (get-token-x-deposit (var-get current-cycle) d))
(define-private (rv-x-amt-next (d principal))
  (get-token-x-deposit (+ (var-get current-cycle) u1) d))
(define-private (rv-and-bool (curr bool) (acc bool))
  (and curr acc))
(define-private (rv-y-positive-curr (d principal))
  (> (get-token-y-deposit (var-get current-cycle) d) u0))
(define-private (rv-y-positive-next (d principal))
  (> (get-token-y-deposit (+ (var-get current-cycle) u1) d) u0))
(define-private (rv-x-positive-curr (d principal))
  (> (get-token-x-deposit (var-get current-cycle) d) u0))
(define-private (rv-x-positive-next (d principal))
  (> (get-token-x-deposit (+ (var-get current-cycle) u1) d) u0))
(define-private (rv-parked-x-fold (a principal) (acc uint))
  (+ acc (get-token-x-parked a)))
(define-private (rv-parked-y-fold (a principal) (acc uint))
  (+ acc (get-token-y-parked a)))
(define-private (rv-x-prev-fold (a principal) (acc uint))
  (+ acc (get-token-x-deposit (- (var-get current-cycle) u1) a)))
(define-private (rv-y-prev-fold (a principal) (acc uint))
  (+ acc (get-token-y-deposit (- (var-get current-cycle) u1) a)))
(define-private (rv-in-x-list (a principal))
  (is-some (index-of? (get-token-x-depositors (var-get current-cycle)) a)))
(define-private (rv-in-y-list (a principal))
  (is-some (index-of? (get-token-y-depositors (var-get current-cycle)) a)))

;; ============================================================================
;; 1-4: per-cycle conservation, list sum == totals (current and next, x and y)
;; ============================================================================

(define-read-only (invariant-y-curr-list-sum-matches-totals)
  (let ((cycle (var-get current-cycle)))
    (is-eq (fold + (map rv-y-amt-curr (get-token-y-depositors cycle)) u0)
           (get total-token-y (get-cycle-totals cycle)))))

(define-read-only (invariant-y-next-list-sum-matches-totals)
  (let ((cycle (+ (var-get current-cycle) u1)))
    (is-eq (fold + (map rv-y-amt-next (get-token-y-depositors cycle)) u0)
           (get total-token-y (get-cycle-totals cycle)))))

(define-read-only (invariant-x-curr-list-sum-matches-totals)
  (let ((cycle (var-get current-cycle)))
    (is-eq (fold + (map rv-x-amt-curr (get-token-x-depositors cycle)) u0)
           (get total-token-x (get-cycle-totals cycle)))))

(define-read-only (invariant-x-next-list-sum-matches-totals)
  (let ((cycle (+ (var-get current-cycle) u1)))
    (is-eq (fold + (map rv-x-amt-next (get-token-x-depositors cycle)) u0)
           (get total-token-x (get-cycle-totals cycle)))))

;; ============================================================================
;; 5-8: no ghosts, every listed depositor holds a positive deposit
;; ============================================================================

(define-read-only (invariant-y-curr-no-ghosts)
  (fold rv-and-bool
    (map rv-y-positive-curr (get-token-y-depositors (var-get current-cycle))) true))
(define-read-only (invariant-y-next-no-ghosts)
  (fold rv-and-bool
    (map rv-y-positive-next (get-token-y-depositors (+ (var-get current-cycle) u1))) true))
(define-read-only (invariant-x-curr-no-ghosts)
  (fold rv-and-bool
    (map rv-x-positive-curr (get-token-x-depositors (var-get current-cycle))) true))
(define-read-only (invariant-x-next-no-ghosts)
  (fold rv-and-bool
    (map rv-x-positive-next (get-token-x-depositors (+ (var-get current-cycle) u1))) true))

;; ============================================================================
;; 9-10: no duplicate in the current depositor lists (and nothing but the
;; RV accounts in them): the list length equals the number of accounts
;; that appear in it. A depositor appended twice (a readmit of a live maker,
;; a park that left the row) shows up here.
;; ============================================================================

(define-read-only (invariant-x-list-no-duplicates)
  (is-eq (len (get-token-x-depositors (var-get current-cycle)))
         (len (filter rv-in-x-list RV-ACCOUNTS))))

(define-read-only (invariant-y-list-no-duplicates)
  (is-eq (len (get-token-y-depositors (var-get current-cycle)))
         (len (filter rv-in-y-list RV-ACCOUNTS))))

;; ============================================================================
;; 11-12: CONSERVATION with settle live. The contract's token balance equals
;; the live totals of the open cycle (and the next, empty at rest) plus every
;; parked amount plus a pending taker escrow (zero at rest). Fees and dust
;; leave to the treasury, fills and refunds leave to makers and takers, and
;; every one of those movements has a matching totals / parked write, or
;; this trips. mock-ft is the x side; native STX is the y side.
;; ============================================================================

(define-read-only (invariant-x-balance-conserved)
  (let ((cycle (var-get current-cycle)))
    (is-eq
      (unwrap-panic (contract-call? .mock-ft get-balance current-contract))
      (+ (get total-token-x (get-cycle-totals cycle))
         (get total-token-x (get-cycle-totals (+ cycle u1)))
         (fold rv-parked-x-fold RV-ACCOUNTS u0)
         (var-get pending-rebate-x)))))

(define-read-only (invariant-y-balance-conserved)
  (let ((cycle (var-get current-cycle)))
    (is-eq
      (stx-get-balance current-contract)
      (+ (get total-token-y (get-cycle-totals cycle))
         (get total-token-y (get-cycle-totals (+ cycle u1)))
         (fold rv-parked-y-fold RV-ACCOUNTS u0)
         (var-get pending-rebate-y)))))

;; ============================================================================
;; 13: scratch state is clean at rest. The taker escrow, the crossing flag
;; and the taker-too-small flag are set inside one atomic swap / reprice and
;; cleared (or rolled back) before it returns.
;; ============================================================================

(define-read-only (invariant-scratch-zero-at-rest)
  (and (is-eq (var-get pending-rebate-x) u0)
       (is-eq (var-get pending-rebate-y) u0)
       (not (var-get crossing))
       (not (var-get taker-too-small))))

;; ============================================================================
;; 14-15: a maker is live or parked on a side, never both. A deposit while
;; parked folds the parked amount back in; a park removes the live row.
;; ============================================================================

(define-private (rv-live-and-parked-x (a principal))
  (and (> (get-token-x-deposit (var-get current-cycle) a) u0)
       (> (get-token-x-parked a) u0)))
(define-private (rv-live-and-parked-y (a principal))
  (and (> (get-token-y-deposit (var-get current-cycle) a) u0)
       (> (get-token-y-parked a) u0)))

(define-read-only (invariant-x-never-live-and-parked)
  (is-eq (len (filter rv-live-and-parked-x RV-ACCOUNTS)) u0))
(define-read-only (invariant-y-never-live-and-parked)
  (is-eq (len (filter rv-live-and-parked-y RV-ACCOUNTS)) u0))

;; ============================================================================
;; 16-17: every position (live or parked) has an order: a positive limit and
;; a spread under the ceiling. The order is what settle, walk and park read;
;; a position without one would be priced at zero.
;; ============================================================================

(define-private (rv-x-position-without-order (a principal))
  (and (or (> (get-token-x-deposit (var-get current-cycle) a) u0)
           (> (get-token-x-parked a) u0))
       (or (is-eq (get-token-x-limit a) u0)
           (not (valid-spread (get spread-bps (get-token-x-order a)))))))
(define-private (rv-y-position-without-order (a principal))
  (and (or (> (get-token-y-deposit (var-get current-cycle) a) u0)
           (> (get-token-y-parked a) u0))
       (or (is-eq (get-token-y-limit a) u0)
           (not (valid-spread (get spread-bps (get-token-y-order a)))))))

(define-read-only (invariant-x-position-has-order)
  (is-eq (len (filter rv-x-position-without-order RV-ACCOUNTS)) u0))
(define-read-only (invariant-y-position-has-order)
  (is-eq (len (filter rv-y-position-without-order RV-ACCOUNTS)) u0))

;; ============================================================================
;; 18-19: the converse, no stale order row: an order exists only for a
;; live or parked position. Cancel, a full fill, a full clear at settle and
;; a refunded remainder all delete the row. A stale row is harmless to
;; funds but would let a returning maker rest at a price it did not set.
;; ============================================================================

(define-private (rv-x-order-without-position (a principal))
  (and (is-some (map-get? token-x-deposit-limits a))
       (is-eq (get-token-x-deposit (var-get current-cycle) a) u0)
       (is-eq (get-token-x-parked a) u0)))
(define-private (rv-y-order-without-position (a principal))
  (and (is-some (map-get? token-y-deposit-limits a))
       (is-eq (get-token-y-deposit (var-get current-cycle) a) u0)
       (is-eq (get-token-y-parked a) u0)))

(define-read-only (invariant-x-no-stale-order)
  (is-eq (len (filter rv-x-order-without-position RV-ACCOUNTS)) u0))
(define-read-only (invariant-y-no-stale-order)
  (is-eq (len (filter rv-y-order-without-position RV-ACCOUNTS)) u0))

;; ============================================================================
;; 20-21: nothing stranded in the settled cycle. Distribute deletes every
;; row of the cycle it pays out; the filters delete what they roll. A row
;; left behind would be a deposit nobody can reach.
;; ============================================================================

(define-read-only (invariant-x-prev-cycle-empty)
  (or (is-eq (var-get current-cycle) u0)
      (is-eq (fold rv-x-prev-fold RV-ACCOUNTS u0) u0)))
(define-read-only (invariant-y-prev-cycle-empty)
  (or (is-eq (var-get current-cycle) u0)
      (is-eq (fold rv-y-prev-fold RV-ACCOUNTS u0) u0)))

;; ============================================================================
;; 22-23: the open cycle is not settled; the last settled cycle cleared no
;; more than it held.
;; ============================================================================

(define-read-only (invariant-open-cycle-unsettled)
  (is-none (get-settlement (var-get current-cycle))))

(define-read-only (invariant-cleared-le-deposited)
  (let ((cycle (var-get current-cycle)))
    (if (> cycle u0)
      (match (get-settlement (- cycle u1))
        s (let ((totals (get-cycle-totals (- cycle u1))))
            (and (<= (get token-y-cleared s) (get total-token-y totals))
                 (<= (get token-x-cleared s) (get total-token-x totals))))
        true)
      true)))

;; ============================================================================
;; 24-25: bounded lists and seats. Seats never exceed the reservation, the
;; reservation never exceeds the queue.
;; ============================================================================

(define-read-only (invariant-lists-bounded)
  (let ((cycle (var-get current-cycle)))
    (and (<= (len (get-token-x-depositors cycle)) MAX_DEPOSITORS)
         (<= (len (get-token-y-depositors cycle)) MAX_DEPOSITORS))))

(define-read-only (invariant-seats-bounded)
  (and (<= (len (var-get seated-x)) (protected-seats))
       (<= (len (var-get seated-y)) (protected-seats))
       (<= (protected-seats) MAX_DEPOSITORS)))
