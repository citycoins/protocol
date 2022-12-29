;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd004-city-registry: get-or-create-city-id() succeeds and returns the city id if the city already exists

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia"))
		(ok true)
	)
)
