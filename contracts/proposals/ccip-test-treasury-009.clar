;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: allows nft contract

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
    	(try! (contract-call? .ccd002-treasury-nyc withdraw-nft 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccext-nft-nyc u1 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(ok true)
	)
)
