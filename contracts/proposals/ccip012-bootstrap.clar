(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (begin
	  ;; Enable genesis extensions.
    (try! (contract-call? .base-dao set-extensions
      (list
        {extension: .ccd001-direct-execute, enabled: true}
        {extension: .ccd002-treasury-mia-mining, enabled: true}
        {extension: .ccd002-treasury-mia-stacking, enabled: true}
        {extension: .ccd002-treasury-nyc-mining, enabled: true}
        {extension: .ccd002-treasury-nyc-stacking, enabled: true}
        {extension: .ccd003-user-registry, enabled: true}
        {extension: .ccd004-city-registry, enabled: true}
        {extension: .ccd005-city-data, enabled: true}
        {extension: .ccd006-city-mining, enabled: true}
        {extension: .ccd007-city-stacking, enabled: true}
        {extension: .ccd008-city-activation, enabled: true}
      )
    ))

    ;; set 3-of-5 signers
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB true))
    (try! (contract-call? .ccd001-direct-execute set-signals-required u3))

    (print "CityCoins DAO has risen! Our mission is to empower people to take ownership in their city by transforming citizens into stakeholders with the ability to fund, build, and vote on meaningful upgrades to their communities.")

    (ok true)
  )
)
