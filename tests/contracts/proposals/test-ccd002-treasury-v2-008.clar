;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: withdraw-ft() fails if withdrawal exceed balance
;; ccd002-treasury: withdraw-ft() succeeds and transfers FT to recipient

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 set-allowed-list
			(list
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-mia, enabled: true}
			)
		))
		(try! (contract-call? .test-ccext-governance-token-mia edg-mint u2000 .ccd002-treasury-mia-mining-v2))
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 withdraw-ft .test-ccext-governance-token-mia u500 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(ok true)
	)
)
