;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Used in several unit tests e.g. see
;; ccd001-direct-execute: get-signals() returns true if approver is in map

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd001-direct-execute set-signals-required u2))
		(ok true)
	)
)
