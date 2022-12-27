;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: deposit-nft() succeeds and transfers NFT to the vault
;; ccd002-treasury: withdraw-nft() succeeds and transfers NFT to recipient

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd002-treasury-nyc-mining set-allowed-list
			(list
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-nft-mia, enabled: true}
				{token: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-ccext-nft-nyc, enabled: true}
			)
		))
		(ok true)
	)
)
