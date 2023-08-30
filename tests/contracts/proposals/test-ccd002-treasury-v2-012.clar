;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: revoke-delegate-stx() succeeds and revokes stacking delegation

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 revoke-delegate-stx))
		(ok true)
	)
)
