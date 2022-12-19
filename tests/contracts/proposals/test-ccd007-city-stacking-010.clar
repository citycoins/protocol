;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-mia-stacking set-allowed .test-ccext-governance-token-mia true))
		(ok true)
	)
)
