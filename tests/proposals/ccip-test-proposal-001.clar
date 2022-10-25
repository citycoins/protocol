;; Title: Test Proposal
;; Author: City Coins
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Test Base-Dao.ERR_CODE ERR_ALREADY_EXECUTED=1001

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
    	(try! (contract-call? .ccd001-direct-execute set-signals-required u3))
		(ok true)
	)
)
