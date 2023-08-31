;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: withdraw-ft() fails if asset is not allowed

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-nyc-mining-v2 withdraw-ft .test-ccext-governance-token-nyc u500 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(ok true)
	)
)
