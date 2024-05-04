
(use-trait proxy-trait .ccip019-proxy-trait.proxy-trait)
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant ERR_UNAUTHORIZED (err u10000))

(define-public (is-dao-or-extension)
  (ok (asserts! (or (is-eq tx-sender .base-dao)
    (contract-call? .base-dao is-extension contract-caller)) ERR_UNAUTHORIZED
  ))
)

(define-public (stx-transfer (amount uint) (recipient principal) (memo (optional (buff 34))))
	(begin
		(try! (is-dao-or-extension))
		(as-contract (match memo
			to-print (stx-transfer-memo? amount tx-sender recipient to-print)
			(stx-transfer? amount tx-sender recipient)
		))
	)
)

(define-public (sip010-transfer (amount uint) (recipient principal) (memo (optional (buff 34))) (sip010 <sip-010-trait>))
	(begin
		(try! (is-dao-or-extension))
		(contract-call? sip010 transfer amount (as-contract tx-sender) recipient memo)
	)
)

(define-public (proxy-call (proxy <proxy-trait>) (payload (buff 2048)))
	(begin
		(try! (is-dao-or-extension))
		(as-contract (contract-call? proxy proxy-call payload))
	)
)
