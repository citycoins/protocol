;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-mia-stacking set-allowed .test-ccext-governance-token-mia true))
		;; added 2024-04-12 to add NYC as well
		(try! (contract-call? .ccd002-treasury-nyc-stacking set-allowed .test-ccext-governance-token-nyc true))
		(ok true)
	)
)
