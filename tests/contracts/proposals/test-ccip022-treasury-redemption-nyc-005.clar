;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Mints 10K NYC V2 to deployer address

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (begin
    ;; to simulate newyorkcitycoin-token-v2
    (try! (contract-call? .test-ccext-governance-token-nyc mint u10000000000 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM))   ;; 10K NYC
    (ok true)
  )
)

