;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Sets up everything required for CCIP-014

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    ;; test-ccd004-city-registry-001
		(try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia"))
		(try! (contract-call? .ccd004-city-registry get-or-create-city-id "nyc"))
    ;; test-ccd005-city-data-001
    (try! (contract-call? .ccd005-city-data set-activation-details u1 u1 u1 u5 u1))
		(try! (contract-call? .ccd005-city-data set-activation-details u2 u2 u2 u2 u2))
    ;; test-ccd005-city-data-002
    (try! (contract-call? .ccd005-city-data set-activation-status u1 true))
		(try! (contract-call? .ccd005-city-data set-activation-status u2 true))
    ;; test-ccd006-city-mining-002 + nyc
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-mining "mining"))
    (try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-mining "mining"))
    ;; test-ccd007-city-stacking-007 + nyc
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-stacking "stacking"))
    (try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-stacking "stacking"))
    ;; test-ccd007-city-stacking-009 + nyc
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
		(try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
    (try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
		(try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
    ;; test-ccd007-city-stacking-010 + nyc
    (try! (contract-call? .ccd002-treasury-mia-stacking set-allowed .test-ccext-governance-token-mia true))
    (try! (contract-call? .ccd002-treasury-nyc-stacking set-allowed .test-ccext-governance-token-nyc true))
		(ok true)
	)
)

;; setup each passed proposal here
;; for more fine grained control
;; and ability to use both cities