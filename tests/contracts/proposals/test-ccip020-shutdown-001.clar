;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Pays out cycle 5 as pool operator for MIA and NYC

(impl-trait .proposal-trait.proposal-trait)

(define-constant SELF (as-contract tx-sender))
(define-constant PAYOUT u1000000000) ;; 1,000 STX

(define-public (execute (sender principal))
	(begin
    ;; set pool operator to self
    (try! (contract-call? .ccd011-stacking-payouts set-pool-operator SELF))
    ;; pay out cycle 5
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-mia u5 PAYOUT)))
    (as-contract (try! (contract-call? .ccd011-stacking-payouts send-stacking-reward-nyc u5 PAYOUT)))
    ;; restore pool operator
    (try! (contract-call? .ccd011-stacking-payouts set-pool-operator 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
		(ok true)
	)
)

;; fund contract for payouts
(stx-transfer? (* PAYOUT u2) tx-sender SELF)
