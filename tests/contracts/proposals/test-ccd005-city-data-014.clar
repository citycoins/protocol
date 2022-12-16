;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-city-treasury u1 .mia-treasury-1 "mia-treasury1"))
		(try! (contract-call? .ccd005-city-data add-city-treasury u1 .mia-treasury-2 "mia-treasury2"))
		(try! (contract-call? .ccd005-city-data add-city-treasury u1 .mia-treasury-3 "mia-treasury3"))
		(ok true)
	)
)
