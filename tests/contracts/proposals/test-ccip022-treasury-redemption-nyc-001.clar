;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Sets up everything required for CCIP-022

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    ;; enable CityCoins V2 mining extension
    (try! (contract-call? .base-dao set-extensions
      (list
        {extension: .ccd006-citycoin-mining-v2, enabled: true}
        {extension: .ccd012-redemption-nyc, enabled: true}
      )
    ))
    ;; disable v1 mining, enable v2
    (try! (contract-call? .ccd006-citycoin-mining set-mining-enabled false))
    (try! (contract-call? .ccd006-citycoin-mining-v2 set-mining-enabled true))
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
    ;; test-ccd006-citycoin-mining-v2-002 + nyc
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-mining-v2 "mining-v2"))
    (try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-mining-v2 "mining-v2"))
    ;; test-ccd007-city-stacking-007 + nyc
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-stacking "stacking"))
    (try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-stacking "stacking"))
    ;; test-ccd007-city-stacking-009 + nyc
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
		(try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC))
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND))
    (try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
		(try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
    (try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC))
    (try! (contract-call? .test-ccext-governance-token-nyc mint u1000 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND))
    ;; test-ccd007-city-stacking-010 + nyc
    (try! (contract-call? .ccd002-treasury-mia-stacking set-allowed .test-ccext-governance-token-mia true))
    (try! (contract-call? .ccd002-treasury-nyc-stacking set-allowed .test-ccext-governance-token-nyc true))
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
