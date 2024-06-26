;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-mining-v2 "mining-v2"))
		(try! (contract-call? .ccd005-city-data add-treasury u2 .ccd002-treasury-nyc-mining-v2 "mining-v2"))
		(ok true)
	)
)
