;; CCIP-028: activate the STX redemption book and sBTC -> STX vault.
;; Deploy book, vault and this proposal from the SAME address, in that order.
;; Execution is only through the existing mainnet base-dao. No tokenholder vote.
;; CCD001 retains its own approver threshold and sunset; this proposal changes neither.
(impl-trait 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.proposal-trait.proposal-trait)

(define-constant DAO 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao)
(define-constant ERR_UNAUTHORIZED (err u28000))
(define-constant ERR_BOOK_ALREADY_INITIALIZED (err u28001))

(define-public (execute (sender principal))
  (begin
    ;; base-dao.execute calls proposals as-contract. A direct call, including
    ;; one from the deployer or an approver, must not initialize anything.
    (asserts! (and (is-eq contract-caller DAO) (is-eq tx-sender DAO)) ERR_UNAUTHORIZED)
    (asserts! (is-eq (contract-call? .ccd015-redemption-book-mia-stx get-par-scaled) u0)
      ERR_BOOK_ALREADY_INITIALIZED)

    ;; Only the vault needs extension authority to withdraw treasury sBTC.
    ;; The book burns MIA it owns; neither it nor this proposal needs a
    ;; permanent entry in base-dao's Extensions map.
    (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.base-dao
      set-extension .ccd016-swap-vault-mia-v2 true))
    (try! (contract-call? 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3
      set-allowed 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token true))

    ;; Freeze the existing vault's launch settings explicitly. Pyth is free
    ;; at activation: no fee subsidy is withdrawn from the treasury.
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-window-blocks u288))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-leeway-bps u1000))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-slippage-bps u100))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-max-chunk-sats u1000000))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-maker-spread-bps u1))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-dia-band-bps u1000))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-router-cooldown u1))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-no-pyth-slippage-bps u1000))
    (try! (contract-call? .ccd016-swap-vault-mia-v2 set-pyth-fee-budget u0))

    ;; 100,000 MIA, in the token's six-decimal units. Par is computed from
    ;; the actual backing/supply by CCD015, never supplied by the executor.
    (try! (contract-call? .ccd015-redemption-book-mia-stx set-min-deposit u100000000000))
    (try! (contract-call? .ccd015-redemption-book-mia-stx update-par))
    (try! (contract-call? .ccd015-redemption-book-mia-stx set-paused false))
    (print { event: "ccip028-activated", book: .ccd015-redemption-book-mia-stx,
      vault: .ccd016-swap-vault-mia-v2, approved-by: sender })
    ;; Funding, swaps and book crossing are separate permissionless calls.
    ;; No reward balance or fresh oracle update is required for activation.
    (ok true)
  )
)
