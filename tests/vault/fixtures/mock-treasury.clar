;; Mock ccd002-treasury-mia-rewards-v3 for RV fuzzing of the ccd016 vault:
;; withdraw-ft hands out whatever it holds, no DAO gate (the gate is the
;; DAO's, covered on the fork). The SUT's rv-fund-treasury wrapper puts
;; mock sBTC here for fund-from-treasury to pull.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (withdraw-ft
    (ft <ft-trait>)
    (amount uint)
    (recipient principal)
  )
  (as-contract? ((with-ft (contract-of ft) "mock-ft" amount))
    (try! (contract-call? ft transfer amount current-contract recipient none))
  )
)
