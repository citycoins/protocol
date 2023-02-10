;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-constant AMOUNT u1000000000)

(define-public (execute (sender principal))
	(begin
    ;; transfer STX to contract
	  (try! (stx-transfer? AMOUNT sender (as-contract tx-sender)))
    ;; set contract as pool operator
    (try! (contract-call? .ccd011-stacking-payouts set-pool-operator (as-contract tx-sender)))
    ;; send reward to contracts
    (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u0 (/ AMOUNT u2)))
    (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u0 (/ AMOUNT u2)))
		(ok true)
	)
)
