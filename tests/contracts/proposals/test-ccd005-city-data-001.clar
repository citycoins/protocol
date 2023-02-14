;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-activation-status() throws error if status is unchanged
;; ccd005-city-data: set-activation-status() changes city status
;; ccd005-city-data: get-treasury-*() data is none if city is known and treasury undefined

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data set-activation-details u1 u1 u1 u5 u1))
		(try! (contract-call? .ccd005-city-data set-activation-details u2 u2 u2 u2 u2))
		(ok true)
	)
)
