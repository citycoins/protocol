;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .base-dao set-extension .ccd007-citycoin-stacking false))
		(try! (contract-call? .ccd007-citycoin-stacking set-claim-status true))
		(ok true)
	)
)
