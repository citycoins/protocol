;; Test-only RFQ native-price response, configurable independently of DIA.
(define-data-var mid uint u32000000000000)
(define-data-var failed bool false)
(define-public (set-mid (m uint)) (begin (asserts! true (err u0)) (ok (var-set mid m))))
(define-public (set-failed (b bool)) (begin (asserts! true (err u0)) (ok (var-set failed b))))
(define-read-only (get-native-price)
  (begin (asserts! (not (var-get failed)) (err u900)) (ok (var-get mid))))
