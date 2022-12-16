;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: set-allowed-list() succeeds and adds contract principals
;; ccd002-treasury: set-allowed-list() succeeds and toggles the state of the asset contracts
;; ccd002-treasury: deposit-ft() fails if asset is not allowed
;; ccd002-treasury: deposit-ft() succeeds and transfers FT to the vault
;; ccd002-treasury: deposit-nft() fails if asset is not allowed
;; ccd002-treasury: withdraw-ft() fails if asset is not allowed
;; ccd002-treasury: withdraw-nft() fails if asset is not allowed

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; tests success of setting sunset height
		(try! (contract-call? .ccd002-treasury-mia-mining set-allowed-list
			(list
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-mia, enabled: true}
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-governance-token-nyc, enabled: false}
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-nft-nyc, enabled: false}
			)
		))
		(ok true)
	)
)
