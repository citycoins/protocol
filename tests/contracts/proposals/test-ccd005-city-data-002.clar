;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-activation-details() throws error if status is unchanged
;; ccd005-city-data: get-treasury-*() data is none if city is known and treasury undefined

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data set-activation-status u1 true))
		(try! (contract-call? .ccd005-city-data set-activation-status u2 true))
		(ok true)
	)
)
