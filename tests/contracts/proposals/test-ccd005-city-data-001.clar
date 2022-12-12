;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd004-city-registry: get-or-create-city-id() increments the user id nonce
;; ccd004-city-registry: get-or-create-city-id() increments the user id nonce

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd005-city-data get-or-create-city-id "mia"))
    	(try! (contract-call? .ccd005-city-data get-or-create-city-id "nyc"))
		(ok true)
	)
)
