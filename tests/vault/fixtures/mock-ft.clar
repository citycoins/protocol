;; Test-only strict SIP-010 ledger. Rewards are minted explicitly by the PoX fixture.
(impl-trait .sip-010-trait.sip-010-trait)
(define-fungible-token mock-ft)
;; Test-only failure injection to check atomic rollback of emergency recovery.
;; Deliberately broken token response used only to test the final recovery
;; emptiness guard and atomic rollback under faulty dependency behavior.
(define-data-var short-transfer bool false)
(define-public (set-short-transfer (b bool)) (ok (var-set short-transfer b)))
(define-data-var blocked-recipient (optional principal) none)
(define-public (set-blocked-recipient (who (optional principal)))
  (ok (var-set blocked-recipient who)))
(define-public (transfer (amount uint) (sender principal) (recipient principal)
                        (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) (err u401))
    (asserts! (not (is-eq (some recipient) (var-get blocked-recipient))) (err u402))
    (ft-transfer? mock-ft (if (and (var-get short-transfer) (> amount u0)) (- amount u1) amount) sender recipient)))
(define-public (mint (amount uint) (who principal)) (ft-mint? mock-ft amount who))
(define-read-only (get-name) (ok "Mock-FT"))
(define-read-only (get-symbol) (ok "MOCK"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-ft who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-ft)))
(define-read-only (get-token-uri) (ok none))
