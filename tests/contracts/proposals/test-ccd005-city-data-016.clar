;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd005-city-data set-active-city-token-contract u1 u3))
		(ok true)
	)
)
