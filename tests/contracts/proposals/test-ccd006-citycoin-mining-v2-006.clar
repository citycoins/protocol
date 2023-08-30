;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (contract-call? .base-dao set-extension .ccd006-citycoin-mining-v2 false)
)
