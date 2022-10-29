;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: allows nft contract

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
		(try! (contract-call? .ccd002-treasury-mia set-allowed-list
			(list
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccext-governance-token-mia, enabled: true}
			)
		))
		(try! (contract-call? .ccext-governance-token-mia edg-mint u2000 .ccd002-treasury-mia))
    	(try! (contract-call? .ccd002-treasury-mia withdraw-ft .ccext-governance-token-mia u500 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(ok true)
	)
)
