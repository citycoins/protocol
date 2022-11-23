;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd002-treasury: deposit-ft() succeeds and transfers FT to the vault

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		;; mint type 01 tokens to wallets 5,6,7,8 for testing
		(try! (contract-call? .ccext-governance-token-mia edg-mint u2000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB))
		(try! (contract-call? .ccext-governance-token-mia edg-mint u2000 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(try! (contract-call? .ccext-governance-token-mia edg-mint u2000 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ))
		(try! (contract-call? .ccext-governance-token-mia edg-mint u2000 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP))
		;; mint type 02 tokens to wallets 5,6,7,8 for testing
		(try! (contract-call? .ccext-governance-token-nyc edg-mint u2000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB))
		(try! (contract-call? .ccext-governance-token-nyc edg-mint u2000 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0))
		(try! (contract-call? .ccext-governance-token-nyc edg-mint u2000 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ))
		(try! (contract-call? .ccext-governance-token-nyc edg-mint u2000 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP))
		(ok true)
	)
)
