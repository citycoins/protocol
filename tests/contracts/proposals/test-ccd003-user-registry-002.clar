;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd003-user-registry: get-or-create-user-id() can't be called if the user registry extension is disabled

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .base-dao set-extension .ccd003-user-registry false))
		(ok true)
	)
)
