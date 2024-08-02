;; Title: Test Proposal for CCIP-024
;; Version: 1.0.0
;; Synopsis: Test proposal for CCIP-024 MiamiCoin Community Signal Vote
;; Description:
;; Sets up everything required for CCIP-024

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (begin
    ;; Set up MIA in city registry
    (try! (contract-call? .ccd004-city-registry get-or-create-city-id "mia"))

    ;; Set activation details for MIA
    (try! (contract-call? .ccd005-city-data set-activation-details u1 u1 u1 u5 u1))

    ;; Set activation status for MIA
    (try! (contract-call? .ccd005-city-data set-activation-status u1 true))

    ;; Add MIA mining treasury
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-mining-v2 "mining"))

    ;; Add MIA stacking treasury
    (try! (contract-call? .ccd005-city-data add-treasury u1 .ccd002-treasury-mia-stacking "stacking"))

    ;; Mint MIA tokens to test users
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))
    (try! (contract-call? .test-ccext-governance-token-mia mint u1000 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC))

    ;; Add MIA token to stacking treasury allow list
    (try! (contract-call? .ccd002-treasury-mia-stacking set-allowed .test-ccext-governance-token-mia true))

    (ok true)
  )
)
