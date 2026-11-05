;; Mock miamicoin-token (v1) for RV fuzzing: the STX book reads only its
;; total supply for the par denominator (v1 has no decimals, scaled to
;; micro by the book). One million v1 MIA, fixed.
(define-read-only (get-total-supply) (ok u1000000))
