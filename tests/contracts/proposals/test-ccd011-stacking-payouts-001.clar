;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-constant AMOUNT u1000000000)

(define-public (execute (sender principal))
	(begin
    ;; set contract as pool operator
    (try! (contract-call? .ccd011-stacking-payouts set-pool-operator (as-contract tx-sender)))
    ;; send reward to contracts
    (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u0 AMOUNT))
    ;; (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u0 (/ AMOUNT u2)))
		(ok true)
	)
)

(define-public (fund (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender))
)

(define-read-only (get-balance)
  (stx-get-balance (as-contract tx-sender))
)
