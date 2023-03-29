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
        {extension: .ccd006-citycoin-mining, enabled: true}
        {extension: .ccd007-citycoin-stacking, enabled: true}
        {extension: .ccd009-auth-v2-adapter, enabled: true}
        {extension: .ccd010-core-v2-adapter, enabled: true}
        {extension: .ccd011-stacking-payouts, enabled: true}
      )
    ))

    ;; set 3-of-5 signers
    ;; MAINNET: 'SP372JVX6EWE2M0XPA84MWZYRRG2M6CAC4VVC12V1
    ;; MAINNET: 'SP2R0DQYR7XHD161SH2GK49QRP1YSV7HE9JSG7W6G
    ;; MAINNET: 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X
    ;; MAINNET: 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ
    ;; MAINNET: 'SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE
    ;; TESTNET: 'ST3AY0CM7SD9183QZ4Y7S2RGBZX9GQT54MJ6XY0BN
    ;; TESTNET: 'ST2D06VFWWTNCWHVB2FJ9KJ3EB30HFRTHB1A4BSP3
    ;; TESTNET: 'ST113N3MMPZRMJJRZH6JTHA5CB7TBZH1EH4C22GFV
    ;; TESTNET: 'ST8YRW1THF2XT8E45XXCGYKZH2B70HYH71VC7737
    ;; TESTNET: 'STX13Q7ZJDSFVDZMQ1PWDFGT4QSBMASRMCYE4NAP
    ;; LOCAL: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
    ;; LOCAL: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
    ;; LOCAL: 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC
    ;; LOCAL: 'ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND
    ;; LOCAL: 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST3AY0CM7SD9183QZ4Y7S2RGBZX9GQT54MJ6XY0BN true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST2D06VFWWTNCWHVB2FJ9KJ3EB30HFRTHB1A4BSP3 true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST113N3MMPZRMJJRZH6JTHA5CB7TBZH1EH4C22GFV true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'ST8YRW1THF2XT8E45XXCGYKZH2B70HYH71VC7737 true))
    (try! (contract-call? .ccd001-direct-execute set-approver 'STX13Q7ZJDSFVDZMQ1PWDFGT4QSBMASRMCYE4NAP true))

    ;; set signals required to pass proposals
    (try! (contract-call? .ccd001-direct-execute set-signals-required u3))

    ;; delegate stack the STX in the mining treasuries (up to 50M STX each)
    ;; MAINNET: 'SP700C57YJFD5RGHK0GN46478WBAM2KG3A4MN2QJ
    ;; MAINNET: 'SP700C57YJFD5RGHK0GN46478WBAM2KG3A4MN2QJ
    ;; TESTNET: 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6
    ;; LOCAL: 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6
    (try! (contract-call? .ccd002-treasury-mia-mining delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))
    (try! (contract-call? .ccd002-treasury-nyc-mining delegate-stx u50000000000000 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6))

    (print "CityCoins DAO has risen! Our mission is to empower people to take ownership in their city by transforming citizens into stakeholders with the ability to fund, build, and vote on meaningful upgrades to their communities.")

    (ok true)
  )
)
