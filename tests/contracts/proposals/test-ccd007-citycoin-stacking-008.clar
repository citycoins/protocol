;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-stacking "stacking"))
		(ok true)
	)
)
