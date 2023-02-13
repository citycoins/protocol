;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd005-city-data: add-treasury() cannot creates two treasuries for same city with the same name and address

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
  	(try! (contract-call? .ccd005-city-data add-treasury u1 .mia-test "mia-test"))
		(ok true)
	)
)
