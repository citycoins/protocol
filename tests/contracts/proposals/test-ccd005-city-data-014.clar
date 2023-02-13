;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-treasury u1 .mia-treasury-1 "mia-test-1"))
		(try! (contract-call? .ccd005-city-data add-treasury u1 .mia-treasury-2 "mia-test-2"))
		(try! (contract-call? .ccd005-city-data add-treasury u1 .mia-treasury-3 "mia-test-3"))
		(ok true)
	)
)
