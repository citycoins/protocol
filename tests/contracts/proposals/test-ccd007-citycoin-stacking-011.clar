;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
	  ;; disabled - function removed from ccd007
		;; (try! (contract-call? .ccd007-citycoin-stacking set-reward-cycle-length u0))
		(ok true)
	)
)
