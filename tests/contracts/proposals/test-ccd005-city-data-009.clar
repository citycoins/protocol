;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-city-coinbase-thresholds() fails if any threshold is 0

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd005-city-data set-city-coinbase-amounts u1 u0 u10 u10 u10 u10 u10 u10	))
		(ok true)
	)
)
