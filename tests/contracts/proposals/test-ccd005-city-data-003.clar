;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-city-activation-details() throws error if status is unchanged
;; ccd005-city-data: set-city-activation-status() changes city status

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data set-city-activation-status u1 false))
		(ok true)
	)
)
