;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-city-coinbase-thresholds() successfully sets threshold

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd005-city-data set-city-coinbase-thresholds u1 u6 u7 u8 u9 u10	))
		(ok true)
	)
)
