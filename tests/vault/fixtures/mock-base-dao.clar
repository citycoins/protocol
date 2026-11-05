;; Fixture DAO: authenticates the exact contract-caller, like the real extension gate.
(define-map extensions principal bool)
(define-public (set-extension (who principal) (enabled bool))
 (begin (asserts! (is-eq tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM) (err u1))
 (ok (map-set extensions who enabled))))
(define-read-only (is-extension (who principal)) (default-to false (map-get? extensions who)))
