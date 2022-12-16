;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd001-direct-execute: set-sunset-block-height() fails when in past

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests failure to be able to set sunset height less than current block height
		(try! (contract-call? .ccd001-direct-execute set-sunset-block-height u1))
		(ok true)
	)
)
