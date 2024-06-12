;; Title: Test Proposal
;; Version: 1.0.0
;; Synopsis: Test proposal for clarinet layer
;; Description:
;; Prepares everything for CCD012 execution

(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (begin
    ;; to simulate newyorkcitycoin-token-v2
    (try! (contract-call? .test-ccext-governance-token-nyc mint u10000000000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))   ;; 10K NYC
		(try! (contract-call? .test-ccext-governance-token-nyc mint u1000000000000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)) ;; 1M NYC
    (try! (contract-call? .test-ccext-governance-token-nyc mint u5000000000000 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)) ;; 5M NYC
    (try! (contract-call? .test-ccext-governance-token-nyc mint u10000000000000 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND)) ;; 10M NYC
    (try! (contract-call? .test-ccext-governance-token-nyc mint u100000000000000 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB)) ;; 100M NYC
    (try! (contract-call? .test-ccext-governance-token-nyc mint u1000000000000000 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0)) ;; 1B NYC
    (try! (contract-call? .test-ccext-governance-token-nyc mint u4000000000000000 'ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ)) ;; 4B NYC
    (ok true)
  )
)
