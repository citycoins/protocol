(impl-trait .proposal-trait.proposal-trait)

(define-public (execute (sender principal))
  (begin
	  ;; enable CityCoins extensions
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
        ;; {extension: .ccd008-city-activation, enabled: true}
        {extension: .ccd009-auth-v2-adapter, enabled: true}
      )
    ))

    ;; set 3-of-5 signers
    ;; MAINNET: (try! (contract-call? .ccd001-direct-execute set-approver 'SP372JVX6EWE2M0XPA84MWZYRRG2M6CAC4VVC12V1 true))
    ;; MAINNET: (try! (contract-call? .ccd001-direct-execute set-approver 'SP2R0DQYR7XHD161SH2GK49QRP1YSV7HE9JSG7W6G true))
    ;; MAINNET: (try! (contract-call? .ccd001-direct-execute set-approver 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X true))
    ;; MAINNET: (try! (contract-call? .ccd001-direct-execute set-approver 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ true))
    ;; MAINNET: (try! (contract-call? .ccd001-direct-execute set-approver 'SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE true))
    ;; TESTNET: (try! (contract-call? .ccd001-direct-execute set-approver 'ST3AY0CM7SD9183QZ4Y7S2RGBZX9GQT54MJ6XY0BN true))
    ;; TESTNET: (try! (contract-call? .ccd001-direct-execute set-approver 'ST2D06VFWWTNCWHVB2FJ9KJ3EB30HFRTHB1A4BSP3 true))
    ;; TESTNET: (try! (contract-call? .ccd001-direct-execute set-approver 'ST113N3MMPZRMJJRZH6JTHA5CB7TBZH1EH4C22GFV true))
    ;; TESTNET: (try! (contract-call? .ccd001-direct-execute set-approver 'ST8YRW1THF2XT8E45XXCGYKZH2B70HYH71VC7737 true))
    ;; TESTNET: (try! (contract-call? .ccd001-direct-execute set-approver 'STX13Q7ZJDSFVDZMQ1PWDFGT4QSBMASRMCYE4NAP true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB true))

    ;; set signals required to pass proposals
    (try! (contract-call? .ccd001-direct-execute set-signals-required u3))

    ;; delegate stacking for the treasuries (up to 50M STX each)
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-mia-stacking delegate-stx u50000000000000 'SP700C57YJFD5RGHK0GN46478WBAM2KG3A4MN2QJ))
    ;; MAINNET: (try! (contract-call? .ccd002-treasury-nyc-stacking delegate-stx u50000000000000 'SP700C57YJFD5RGHK0GN46478WBAM2KG3A4MN2QJ))
    (try! (contract-call? .ccd002-treasury-mia-stacking delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
    (try! (contract-call? .ccd002-treasury-nyc-stacking delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))

    (print "CityCoins DAO has risen! Our mission is to empower people to take ownership in their city by transforming citizens into stakeholders with the ability to fund, build, and vote on meaningful upgrades to their communities.")

    (ok true)
  )
)
