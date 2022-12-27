;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; ccd003-user-registry: get-or-create-user-id() increments the user id nonce

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
	(begin
		(try! (contract-call? .ccd003-user-registry get-or-create-user-id 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
		(try! (contract-call? .ccd003-user-registry get-or-create-user-id 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
		(try! (contract-call? .ccd003-user-registry get-or-create-user-id 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC))
		(ok true)
	)
)
