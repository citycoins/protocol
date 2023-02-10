;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data set-city-coinbase-amounts u1 u10 u100 u1000 u10000 u100000 u1000000 u10000000))
		(ok true)
	)
)
