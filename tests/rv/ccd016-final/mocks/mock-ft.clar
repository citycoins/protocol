;; RV ccd016-final: strict SIP-010 ledger (overrides tests/vault/fixtures),
;; one token for sBTC and wSTX as in the fixture. Ghost: every transfer whose
;; sender is the vault is classified by recipient. The vault may only send
;; sBTC to the rewards treasury, the Jing market or the router; anything else
;; increments bad-out (invariant-sbtc-destinations).
(impl-trait .sip-010-trait.sip-010-trait)
(define-fungible-token mock-ft)
(define-constant RV-VAULT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd016-swap-vault-mia-v2)
(define-constant RV-TREASURY 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-treasury)
(define-constant RV-MARKET 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.v6-market)
(define-constant RV-ROUTER 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-router)
(define-data-var vault-out { treasury: uint, market: uint, router: uint, bad: uint } { treasury: u0, market: u0, router: u0, bad: u0 })
(define-read-only (get-vault-out) (var-get vault-out))
(define-private (track (amount uint) (sender principal) (recipient principal))
  (let ((o (var-get vault-out)))
    (if (is-eq sender RV-VAULT)
      (var-set vault-out
        (if (is-eq recipient RV-TREASURY) (merge o { treasury: (+ (get treasury o) amount) })
        (if (is-eq recipient RV-MARKET) (merge o { market: (+ (get market o) amount) })
        (if (is-eq recipient RV-ROUTER) (merge o { router: (+ (get router o) amount) })
          (merge o { bad: (+ (get bad o) amount) })))))
      true)))
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) (err u401))
    (try! (ft-transfer? mock-ft amount sender recipient))
    (track amount sender recipient)
    (ok true)))
(define-public (mint (amount uint) (who principal)) (ft-mint? mock-ft amount who))
(define-read-only (get-name) (ok "Mock-FT"))
(define-read-only (get-symbol) (ok "MOCK"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-ft who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-ft)))
(define-read-only (get-token-uri) (ok none))
