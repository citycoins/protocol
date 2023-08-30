;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: stack-stx() succeeds and delegates STX

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; revoke delegation from ccip012-bootstrap
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 revoke-delegate-stx))
		(try! (contract-call? .ccd002-treasury-nyc-mining-v2 revoke-delegate-stx))
		;; delegate all treasuries in Clarinet.toml
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 delegate-stx u1000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM))
		(try! (contract-call? .ccd002-treasury-nyc-mining-v2 delegate-stx u1000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM))
		(ok true)
	)
)
