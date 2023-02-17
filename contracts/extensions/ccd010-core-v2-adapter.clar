;; Title: CCD010 Core V2 Adapter
;; Version: 1.0.0
;; Summary: Simulates a core v2 contract in the CityCoins legacy protocol.
;; Description: An extension contract that allows the DAO to process and mint CityCoins from the legacy protocol won by miners.

;; TRAITS

(impl-trait .extension-trait.extension-trait)
;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.citycoin-core-v2-trait.citycoin-core-v2
;; TESTNET: 'ST1XQXW9JNQ1W4A7PYTN3HCHPEY7SHM6KPA085ES6.citycoin-core-v2-trait.citycoin-core-v2
(impl-trait .citycoin-core-v2-trait.citycoin-core-v2)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u10000))
(define-constant ERR_DISABLED (err u10001))
(define-constant ERR_NOTHING_TO_MINT (err u10002))

;; PUBLIC FUNCTIONS

(define-public (is-extension)
  (ok (asserts! (contract-call? .base-dao is-extension contract-caller) ERR_UNAUTHORIZED))
)

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)

;; CITYCOINS PROTOCOL V2 FUNCTIONS

;; disabled functions
(define-public (register-user (memo (optional (string-utf8 50)))) ERR_DISABLED)
(define-public (mine-tokens (amount uint) (memo (optional (buff 34)))) ERR_DISABLED)
(define-public (mine-many (amounts (list 200 uint))) ERR_DISABLED)
(define-public (claim-mining-reward (minerBlockHeight uint)) ERR_DISABLED)
(define-public (stack-tokens (amountTokens uint) (lockPeriod uint)) ERR_DISABLED)
(define-public (claim-stacking-reward (targetCycle uint)) ERR_DISABLED)
(define-public (shutdown-contract (stacksHeight uint)) ERR_DISABLED)

;; backwards-compatibility
(define-public (set-city-wallet (newCityWallet principal)) (ok true))
(define-public (update-coinbase-thresholds) (ok true))
(define-public (update-coinbase-amounts) (ok true))
(define-public (activate-core-contracts (activationHeight uint))
  (begin
    (try! (is-extension))
    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-auth-v2
    ;; TESTNET: 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-auth-v2
    (try! (contract-call? .miamicoin-auth-v2 activate-core-contract (as-contract tx-sender) activationHeight))
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-auth-v2
    ;; TESTNET: 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-auth-v2
    (try! (contract-call? .newyorkcitycoin-auth-v2 activate-core-contract (as-contract tx-sender) activationHeight))
    (ok true)
  )
)

;; minting for legacy MIA/NYC token contracts
(define-public (mint-coinbase (cityName (string-ascii 10)) (recipient principal) (amount uint))
  (begin
    (try! (is-extension))
    (asserts! (> amount u0) ERR_NOTHING_TO_MINT)
    ;; contract addresses hardcoded for this version
    ;; MAINNET: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2
    ;; TESTNET: 'ST1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8WRH7C6H.miamicoin-token-v2
    ;; DEVNET: .test-ccext-governance-token-mia
    (and (is-eq cityName "mia") (try! (as-contract (contract-call? .miamicoin-token-v2 mint amount recipient))))
    ;; MAINNET: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2
    ;; TESTNET: 'STSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1D64KKHQ.newyorkcitycoin-token-v2
    ;; DEVNET: .test-ccext-governance-token-nyc
    (and (is-eq cityName "nyc") (try! (as-contract (contract-call? .newyorkcitycoin-token-v2 mint amount recipient))))
    (ok true)
  )
)
