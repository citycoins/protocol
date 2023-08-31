;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: set-allowed-list() succeeds and toggles the state of the asset contracts

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-mia-mining-v2 set-allowed-list
			(list
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-mia, enabled: false}
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-nyc, enabled: true}
			)
		))
		(ok true)
	)
)
