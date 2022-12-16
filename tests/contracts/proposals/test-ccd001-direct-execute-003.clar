;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd001-direct-execute: set-sunset-block-height() succeeds

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
		(try! (contract-call? .ccd001-direct-execute set-sunset-block-height u10))
		(ok true)
	)
)
