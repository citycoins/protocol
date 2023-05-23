;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd005-city-data add-treasury u1 .mia-treasury "mining"))
		(try! (contract-call? .base-dao set-extension .ccd006-citycoin-mining-v2 false))
		(ok true)
	)
)
