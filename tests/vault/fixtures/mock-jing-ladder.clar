;; Mock jing-ladder for RV fuzzing of markets-sbtc-stx-jing-v6 and the rungs.
;;
;; The market reads three things from the ladder: how many protected seats
;; a side has (`get-max-band-per-side`) and whether a principal holds a
;; band seat (`is-band-x` / `is-band-y`). The real ladder seats only a
;; contract whose code hash matches a blessed canonical, which no RV
;; sender can be. This mock lets the SUT's rv-band-x/y wrappers seat and
;; unseat any account, capped at `max-band` per side like the real one, so
;; the seat paths (side-full for a seat holder, find-smallest skipping
;; seats, sync-seat / prune-seats) run under fuzz.
;;
;; The rung log-* endpoints are stubs: a rung's logs are best effort
;; (`is-ok`), so nothing depends on them.
(define-data-var max-band uint u2)
(define-data-var n-x uint u0)
(define-data-var n-y uint u0)
(define-map band-x principal bool)
(define-map band-y principal bool)

(define-read-only (get-max-band-per-side)
  (var-get max-band)
)
(define-read-only (is-band-x (who principal))
  (default-to false (map-get? band-x who))
)
(define-read-only (is-band-y (who principal))
  (default-to false (map-get? band-y who))
)
(define-read-only (get-band-counts)
  {
    x: (var-get n-x),
    y: (var-get n-y),
  }
)

(define-public (set-band-x
    (who principal)
    (on bool)
  )
  (if (is-eq (is-band-x who) on)
    (ok true)
    (if on
      (begin
        (asserts! (< (var-get n-x) (var-get max-band)) (err u6011))
        (map-set band-x who true)
        (var-set n-x (+ (var-get n-x) u1))
        (ok true)
      )
      (begin
        (map-delete band-x who)
        (var-set n-x (- (var-get n-x) u1))
        (ok true)
      )
    )
  )
)

(define-public (set-band-y
    (who principal)
    (on bool)
  )
  (if (is-eq (is-band-y who) on)
    (ok true)
    (if on
      (begin
        (asserts! (< (var-get n-y) (var-get max-band)) (err u6011))
        (map-set band-y who true)
        (var-set n-y (+ (var-get n-y) u1))
        (ok true)
      )
      (begin
        (map-delete band-y who)
        (var-set n-y (- (var-get n-y) u1))
        (ok true)
      )
    )
  )
)

;; ---------- rung endpoints (stubs) ----------
;; the band rungs gate their seat call on the ladder owner; the deployer
(define-read-only (get-owner)
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
)
(define-public (register-unseated
    (side (string-ascii 8))
    (price uint)
    (market-price uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (register
    (side (string-ascii 8))
    (price uint)
    (market-price uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (log-deposit
    (member principal)
    (amount uint)
    (shares uint)
    (epoch uint)
    (pushed bool)
    (held uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (log-push
    (keeper principal)
    (amount uint)
    (pushed bool)
    (held uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (log-withdraw
    (member principal)
    (amount uint)
    (shares uint)
    (epoch uint)
    (held uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (log-claim
    (member principal)
    (amount uint)
    (epoch uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
(define-public (log-epoch-closed
    (epoch uint)
    (final-proceeds-index uint)
  )
  (begin (asserts! true (err u0)) (ok true))
)
