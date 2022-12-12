;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: set-allowed() succeeds and adds a contract principal
;; ccd002-treasury: is-allowed() succeeds and returns true if asset is found in map
;; ccd002-treasury: get-allowed-asset() succeeds and returns tuple if asset is found in map

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
    	(try! (contract-call? .ccd002-treasury-mia set-allowed 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-mia true))
		(ok true)
	)
)
