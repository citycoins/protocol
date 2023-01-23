(impl-trait .proposal-trait.proposal-trait)

(define-constant ERR_PANIC (err u500))

(define-public (execute (sender principal))
  (let
    (
      (miaId (unwrap! (contract-call? .ccd004-city-registry get-city-id "mia") ERR_PANIC))
      (nycId (unwrap! (contract-call? .ccd004-city-registry get-city-id "nyc") ERR_PANIC))
    )
    ;; set city activation status
    (try! (contract-call? .ccd005-city-data set-city-activation-status miaId true))
    (try! (contract-call? .ccd005-city-data set-city-activation-status nycId true))
    
    (ok true)
  )
)
