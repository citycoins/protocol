(define-trait stacking-trait
  (
    (stack-stx (uint principal (buff 1) (buff 20) (optional uint))
      (response bool uint)
    )
    (unstack-stx ()
      (response bool uint)
    )
  )  
)
