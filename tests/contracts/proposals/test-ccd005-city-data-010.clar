;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: set-coinbase-thresholds() successfully sets threshold

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data set-coinbase-thresholds u1 u50 u60 u70 u80 u90))
		(ok true)
	)
)
