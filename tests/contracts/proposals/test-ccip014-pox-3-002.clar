;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Sets up everything required for mining claims after CCIP-014

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    ;; test-ccd005-city-data-009
    (try! (contract-call? .ccd005-city-data set-coinbase-amounts u1 u10 u100 u1000 u10000 u100000 u1000000 u10000000))
    ;; test-ccd005-city-data-010
    (try! (contract-call? .ccd005-city-data set-coinbase-thresholds u1 u50 u60 u70 u80 u90))
    ;; test-ccd005-city-data-018
    (try! (contract-call? .ccd005-city-data set-coinbase-details u1 u20 u1))
    ;; same operations for NYC
    (try! (contract-call? .ccd005-city-data set-coinbase-amounts u2 u10 u100 u1000 u10000 u100000 u1000000 u10000000))
    (try! (contract-call? .ccd005-city-data set-coinbase-thresholds u2 u50 u60 u70 u80 u90))
    (try! (contract-call? .ccd005-city-data set-coinbase-details u2 u20 u1))
		(ok true)
	)
)
