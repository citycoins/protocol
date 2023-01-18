(define-trait stacking-trait
  (
    (stack-stx (uint principal (optional uint) (optional { version: (buff 1), hashbytes: (buff 20) }))
      (response bool uint)
    )
    (unstack-stx ()
      (response bool uint)
    )
  )  
)
