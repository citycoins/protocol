;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-city-token-contract u1 .mia-token-contract-1))
		(try! (contract-call? .ccd005-city-data add-city-token-contract u1 .mia-token-contract-2))
		(try! (contract-call? .ccd005-city-data add-city-token-contract u1 .mia-token-contract-3))
		(ok true)
	)
)
