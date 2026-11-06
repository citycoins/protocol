(define-constant JING_MARKET 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4)
(define-constant SBTC 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant WSTX 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2)
(define-constant ASSET_SBTC "sbtc-token")
(define-constant ASSET_WSTX "wstx")

(define-constant DLMM_ROUTER 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-swap-router-v-1-2)
(define-constant DLMM_POOL_1 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-stx-sbtc-v-1-bps-15)
(define-constant DLMM_POOL_2 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-stx-sbtc-v-2-bps-15)
(define-constant DLMM_POOL_3 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-stx-sbtc-v-3-bps-15)
(define-constant DLMM_CORE 'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-core-v-1-1)
(define-constant DLMM_POOL_ID_1 u6)
(define-constant DLMM_POOL_ID_2 u15)
(define-constant DLMM_POOL_ID_3 u16)
(define-constant DLMM_MAX_STEPS u230)

(define-constant XYK_CORE 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant XYK_POOL 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1)

(define-constant VELAR_POOL 'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-pool-v1_0_0-0070)
(define-constant VELAR_FEES 'SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-fees-v1_0_0-0070)
(define-constant VELAR_WSTX 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx)

(define-constant VENUE_DLMM u1)
(define-constant VENUE_XYK u2)
(define-constant VENUE_VELAR u3)

(define-constant ERR_ZERO_AMOUNT (err u3001))
(define-constant ERR_MIN_OUT (err u3002))
(define-constant ERR_BAD_VENUE (err u3003))
(define-constant ERR_SPLIT_MISMATCH (err u3004))
(define-constant ERR_VAA_REQUIRED (err u3005))
(define-constant ERR_ZERO_LIMIT (err u3006))
(define-constant ERR_ZERO_MID (err u3007))

(define-private (sbtc-balance (who principal))
  (unwrap-panic (contract-call? SBTC get-balance who))
)

(define-private (gain
    (before uint)
    (after uint)
  )
  (if (> after before)
    (- after before)
    u0
  )
)

(define-private (jing-swap
    (amount uint)
    (limit-price uint)
    (update (buff 8192))
    (deposit-x bool)
  )
  (match (contract-call? JING_MARKET swap amount limit-price update SBTC ASSET_SBTC WSTX
    ASSET_WSTX deposit-x
  )
    res (some {
      spent: (- amount
        (if deposit-x
          (get token-x-rolled res)
          (get token-y-rolled res)
        )
        (get rebate-refunded res)
      ),
      out: (if deposit-x
        (get token-y-received res)
        (get token-x-received res)
      ),
    })
    e none
  )
)

(define-private (jing-spent (r (optional {
  spent: uint,
  out: uint,
})))
  (match r
    v (get spent v)
    u0
  )
)

(define-private (jing-out (r (optional {
  spent: uint,
  out: uint,
})))
  (match r
    v (get out v)
    u0
  )
)

(define-private (xyk-x-is-sbtc)
  (is-eq (get x-token (unwrap-panic (contract-call? XYK_POOL get-pool))) SBTC)
)

(define-private (xyk-swap
    (sell-sbtc bool)
    (amount uint)
    (min-received uint)
    (x-is-sbtc bool)
  )
  (begin
    (if x-is-sbtc
      (if sell-sbtc
        (contract-call? XYK_CORE swap-x-for-y XYK_POOL SBTC WSTX amount
          min-received
        )
        (contract-call? XYK_CORE swap-y-for-x XYK_POOL SBTC WSTX amount
          min-received
        )
      )
      (if sell-sbtc
        (contract-call? XYK_CORE swap-y-for-x XYK_POOL WSTX SBTC amount
          min-received
        )
        (contract-call? XYK_CORE swap-x-for-y XYK_POOL WSTX SBTC amount
          min-received
        )
      )
    )
  )
)

(define-private (dlmm-sell
    (pool uint)
    (sell-sbtc bool)
    (amount uint)
    (min-received uint)
  )
  (if sell-sbtc
    (if (is-eq pool u2)
      (contract-call? DLMM_ROUTER swap-y-for-x-simple-range-multi DLMM_POOL_2
        WSTX SBTC amount min-received DLMM_MAX_STEPS none
      )
      (if (is-eq pool u3)
        (contract-call? DLMM_ROUTER swap-y-for-x-simple-range-multi DLMM_POOL_3
          WSTX SBTC amount min-received DLMM_MAX_STEPS none
        )
        (contract-call? DLMM_ROUTER swap-y-for-x-simple-range-multi DLMM_POOL_1
          WSTX SBTC amount min-received DLMM_MAX_STEPS none
        )
      )
    )
    (if (is-eq pool u2)
      (contract-call? DLMM_ROUTER swap-x-for-y-simple-range-multi DLMM_POOL_2
        WSTX SBTC amount min-received DLMM_MAX_STEPS none
      )
      (if (is-eq pool u3)
        (contract-call? DLMM_ROUTER swap-x-for-y-simple-range-multi DLMM_POOL_3
          WSTX SBTC amount min-received DLMM_MAX_STEPS none
        )
        (contract-call? DLMM_ROUTER swap-x-for-y-simple-range-multi DLMM_POOL_1
          WSTX SBTC amount min-received DLMM_MAX_STEPS none
        )
      )
    )
  )
)

(define-private (amm-sell-sbtc
    (amount uint)
    (min-received uint)
    (venue uint)
  )
  (if (is-eq venue VENUE_DLMM)
    (dlmm-sell (dlmm-pick true amount u0) true amount min-received)
    (if (is-eq venue VENUE_XYK)
      (ok {
        in: amount,
        out: (try! (xyk-swap true amount min-received (xyk-x-is-sbtc))),
      })
      (ok {
        in: amount,
        out: (get amt-out
          (try! (contract-call? VELAR_POOL swap SBTC VELAR_WSTX VELAR_FEES amount
            min-received
          ))
        ),
      })
    )
  )
)

(define-private (amm-sell-stx
    (amount uint)
    (min-received uint)
    (venue uint)
  )
  (if (is-eq venue VENUE_DLMM)
    (dlmm-sell (dlmm-pick false amount u0) false amount min-received)
    (if (is-eq venue VENUE_XYK)
      (ok {
        in: amount,
        out: (try! (xyk-swap false amount min-received (xyk-x-is-sbtc))),
      })
      (ok {
        in: amount,
        out: (get amt-out
          (try! (contract-call? VELAR_POOL swap VELAR_WSTX SBTC VELAR_FEES amount
            min-received
          ))
        ),
      })
    )
  )
)

(define-private (amm-floor (min-received uint))
  (if (> min-received u0)
    min-received
    u1
  )
)

(define-private (leg-sbtc
    (amount uint)
    (min-received uint)
    (venue uint)
  )
  (if (> amount u0)
    (amm-sell-sbtc amount (amm-floor min-received) venue)
    (ok {
      in: u0,
      out: u0,
    })
  )
)

(define-private (leg-stx
    (amount uint)
    (min-received uint)
    (venue uint)
  )
  (if (> amount u0)
    (amm-sell-stx amount (amm-floor min-received) venue)
    (ok {
      in: u0,
      out: u0,
    })
  )
)

(define-private (with-fallback
    (planned uint)
    (venue uint)
    (fallback (optional uint))
    (residual uint)
  )
  (if (is-eq (some venue) fallback)
    (+ planned residual)
    planned
  )
)

(define-private (fallback-residual
    (residual uint)
    (jing (optional {
      spent: uint,
      out: uint,
    }))
    (sell-sbtc bool)
  )
  (match jing
    j (if (and
        (> (get spent j) u0)
        (> (get out j) u0)
        (dust-left residual
          (if sell-sbtc
            (/ (* (get out j) PRICE_SCALE) (get spent j))
            (/ (* (get spent j) PRICE_SCALE) (get out j))
          )
          sell-sbtc
        )
      )
      u0
      residual
    )
    residual
  )
)

(define-private (scale-min
    (min-received uint)
    (planned uint)
    (actual uint)
  )
  (if (or (is-eq planned u0) (is-eq actual planned))
    min-received
    (/ (* min-received actual) planned)
  )
)

(define-private (valid-fallback (fallback (optional uint)))
  (match fallback
    v (or
      (is-eq v VENUE_DLMM)
      (is-eq v VENUE_XYK)
      (is-eq v VENUE_VELAR)
    )
    true
  )
)

(define-public (swap-sbtc-for-stx
    (amount uint)
    (jing-amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (fallback (optional uint))
    (amm-amounts {
      dlmm: uint,
      xyk: uint,
      velar: uint,
    })
    (amm-mins {
      dlmm: uint,
      xyk: uint,
      velar: uint,
    })
    (min-stx-out uint)
  )
  (begin
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)
    (asserts!
      (is-eq amount
        (+ jing-amount (get dlmm amm-amounts) (get xyk amm-amounts)
          (get velar amm-amounts)
        ))
      ERR_SPLIT_MISMATCH
    )
    (asserts! (valid-fallback fallback) ERR_BAD_VENUE)
    (let (
        (user tx-sender)
        (stx-before (stx-get-balance user))
        (jing (if (> jing-amount u0)
          (jing-swap jing-amount limit-price (unwrap! update ERR_VAA_REQUIRED)
            true
          )
          none
        ))
        (jing-in (jing-spent jing))
        (residual (- jing-amount jing-in))
        (routed (fallback-residual residual jing true))
        (dlmm-in (with-fallback (get dlmm amm-amounts) VENUE_DLMM fallback routed))
        (xyk-in (with-fallback (get xyk amm-amounts) VENUE_XYK fallback routed))
        (velar-in (with-fallback (get velar amm-amounts) VENUE_VELAR fallback routed))
        (dlmm (try! (leg-sbtc dlmm-in
          (scale-min (get dlmm amm-mins) (get dlmm amm-amounts) dlmm-in)
          VENUE_DLMM
        )))
        (xyk (try! (leg-sbtc xyk-in
          (scale-min (get xyk amm-mins) (get xyk amm-amounts) xyk-in)
          VENUE_XYK
        )))
        (velar (try! (leg-sbtc velar-in
          (scale-min (get velar amm-mins) (get velar amm-amounts) velar-in)
          VENUE_VELAR
        )))
        (out (gain stx-before (stx-get-balance user)))
      )
      (asserts! (>= out min-stx-out) ERR_MIN_OUT)
      (print {
        topic: "swap-sbtc-for-stx",
        user: user,
        amount: amount,
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get in xyk),
        xyk-out: (get out xyk),
        velar-in: (get in velar),
        velar-out: (get out velar),
        unsold: (+
          (if (is-none fallback)
            residual
            (- residual routed)
          )
          (- dlmm-in (get in dlmm))
        ),
        out: out,
      })
      (ok {
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get in xyk),
        xyk-out: (get out xyk),
        velar-in: (get in velar),
        velar-out: (get out velar),
        unsold: (+
          (if (is-none fallback)
            residual
            (- residual routed)
          )
          (- dlmm-in (get in dlmm))
        ),
        out: out,
      })
    )
  )
)

(define-public (swap-stx-for-sbtc
    (amount uint)
    (jing-amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (fallback (optional uint))
    (amm-amounts {
      dlmm: uint,
      xyk: uint,
      velar: uint,
    })
    (amm-mins {
      dlmm: uint,
      xyk: uint,
      velar: uint,
    })
    (min-sbtc-out uint)
  )
  (begin
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)
    (asserts!
      (is-eq amount
        (+ jing-amount (get dlmm amm-amounts) (get xyk amm-amounts)
          (get velar amm-amounts)
        ))
      ERR_SPLIT_MISMATCH
    )
    (asserts! (valid-fallback fallback) ERR_BAD_VENUE)
    (let (
        (user tx-sender)
        (sbtc-before (sbtc-balance user))
        (jing (if (> jing-amount u0)
          (jing-swap jing-amount limit-price (unwrap! update ERR_VAA_REQUIRED)
            false
          )
          none
        ))
        (jing-in (jing-spent jing))
        (residual (- jing-amount jing-in))
        (routed (fallback-residual residual jing false))
        (dlmm-in (with-fallback (get dlmm amm-amounts) VENUE_DLMM fallback routed))
        (xyk-in (with-fallback (get xyk amm-amounts) VENUE_XYK fallback routed))
        (velar-in (with-fallback (get velar amm-amounts) VENUE_VELAR fallback routed))
        (dlmm (try! (leg-stx dlmm-in
          (scale-min (get dlmm amm-mins) (get dlmm amm-amounts) dlmm-in)
          VENUE_DLMM
        )))
        (xyk (try! (leg-stx xyk-in
          (scale-min (get xyk amm-mins) (get xyk amm-amounts) xyk-in)
          VENUE_XYK
        )))
        (velar (try! (leg-stx velar-in
          (scale-min (get velar amm-mins) (get velar amm-amounts) velar-in)
          VENUE_VELAR
        )))
        (out (gain sbtc-before (sbtc-balance user)))
      )
      (asserts! (>= out min-sbtc-out) ERR_MIN_OUT)
      (print {
        topic: "swap-stx-for-sbtc",
        user: user,
        amount: amount,
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get in xyk),
        xyk-out: (get out xyk),
        velar-in: (get in velar),
        velar-out: (get out velar),
        unsold: (+
          (if (is-none fallback)
            residual
            (- residual routed)
          )
          (- dlmm-in (get in dlmm))
        ),
        out: out,
      })
      (ok {
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get in xyk),
        xyk-out: (get out xyk),
        velar-in: (get in velar),
        velar-out: (get out velar),
        unsold: (+
          (if (is-none fallback)
            residual
            (- residual routed)
          )
          (- dlmm-in (get in dlmm))
        ),
        out: out,
      })
    )
  )
)

(define-constant PRICE_SCALE u10000000000)
(define-constant BPS u10000)
(define-constant CP_SAFETY u9980)

(define-private (xyk-quote (sell-sbtc bool))
  (let (
      (pool (unwrap-panic (contract-call? XYK_POOL get-pool)))
      (x-is-sbtc (is-eq (get x-token pool) SBTC))
      (x-in (is-eq x-is-sbtc sell-sbtc))
    )
    {
      reserves: (if x-in
        {
          in: (get x-balance pool),
          out: (get y-balance pool),
        }
        {
          in: (get y-balance pool),
          out: (get x-balance pool),
        }
      ),
      keep: (if x-in
        {
          num: (- BPS (+ (get x-protocol-fee pool) (get x-provider-fee pool))),
          den: BPS,
        }
        {
          num: (- BPS (+ (get y-protocol-fee pool) (get y-provider-fee pool))),
          den: BPS,
        }
      ),
      x-is-sbtc: x-is-sbtc,
      status: (get pool-status pool),
    }
  )
)

(define-private (velar-keep)
  (let ((fees (unwrap-panic (contract-call? VELAR_FEES get-fees))))
    {
      num: (get num (get swap-fee fees)),
      den: (get den (get swap-fee fees)),
    }
  )
)

(define-private (velar-reserves (sell-sbtc bool))
  (let ((pool (unwrap-panic (contract-call? VELAR_POOL get-pool))))
    (if (is-eq (is-eq (get token0 pool) SBTC) sell-sbtc)
      {
        in: (get reserve0 pool),
        out: (get reserve1 pool),
      }
      {
        in: (get reserve1 pool),
        out: (get reserve0 pool),
      }
    )
  )
)

(define-private (cp-capacity
    (r {
      in: uint,
      out: uint,
    })
    (k {
      num: uint,
      den: uint,
    })
    (limit uint)
    (sell-sbtc bool)
  )
  (let ((top (if sell-sbtc
      (/ (* (get out r) PRICE_SCALE (get num k)) (* limit (get den k)))
      (/ (* (get out r) limit (get num k)) (* PRICE_SCALE (get den k)))
    )))
    (if (> top (get in r))
      (/ (* (- top (get in r)) (get den k) CP_SAFETY) (* (get num k) BPS))
      u0
    )
  )
)

(define-constant ROUND_SLACK u2)

(define-private (limit-min
    (leg uint)
    (limit uint)
    (sell-sbtc bool)
  )
  (let ((base (if (> leg ROUND_SLACK)
      (- leg ROUND_SLACK)
      u0
    )))
    (if sell-sbtc
      (/ (* base limit) PRICE_SCALE)
      (/ (* base PRICE_SCALE) limit)
    )
  )
)

(define-constant JING_FEE_BPS u10)

(define-private (book-limit
    (limit uint)
    (bps uint)
    (sell-sbtc bool)
  )
  (if sell-sbtc
    (/ (- (+ (* limit (+ BPS bps)) (- BPS JING_FEE_BPS)) u1) (- BPS JING_FEE_BPS))
    (/ (* limit (- BPS JING_FEE_BPS)) (+ BPS bps))
  )
)

(define-private (jing-size
    (amount uint)
    (limit uint)
    (update (optional (buff 8192)))
    (mid uint)
    (sell-sbtc bool)
  )
  (match update
    v (let (
        (bps (get rebate-bps
          (contract-call? JING_MARKET get-taker-capacity mid limit sell-sbtc
            tx-sender (some v)
          )))
        (blimit (book-limit limit bps sell-sbtc))
        (quote (contract-call? JING_MARKET get-taker-capacity mid blimit sell-sbtc
          tx-sender (some v)
        ))
        (cap (get gross-cap quote))
        (size (if (> cap amount)
          amount
          cap
        ))
        (net (/ (* size BPS) (+ BPS (get rebate-bps quote))))
        (mins (contract-call? JING_MARKET get-min-deposits))
        (min-dep (if sell-sbtc
          (get min-token-x mins)
          (get min-token-y mins)
        ))
      )
      {
        size: (if (and
            (> blimit u0)
            (>= net min-dep)
            (>= net (get min-taker quote))
          )
          size
          u0
        ),
        limit: blimit,
      }
    )
    {
      size: u0,
      limit: limit,
    }
  )
)

(define-private (cp-split
    (residual uint)
    (cap-xyk uint)
    (cap-velar uint)
  )
  (let ((total (+ cap-xyk cap-velar)))
    (if (<= residual total)
      (let ((xyk (if (> total u0)
          (/ (* residual cap-xyk) total)
          u0
        )))
        {
          xyk: xyk,
          velar: (- residual xyk),
        }
      )
      {
        xyk: cap-xyk,
        velar: cap-velar,
      }
    )
  )
)

(define-constant DLMM_PRICE_SCALE u100000000)
(define-constant DLMM_CENTER_BIN 500)
(define-constant DLMM_WALK_BINS (list
  u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20
  u21 u22 u23 u24 u25 u26 u27 u28 u29
))

(define-private (dlmm-pick
    (sell-sbtc bool)
    (amount uint)
    (limit uint)
  )
  (let (
      (d1 (dlmm-depth DLMM_POOL_1 DLMM_POOL_ID_1 sell-sbtc))
      (d2 (dlmm-depth DLMM_POOL_2 DLMM_POOL_ID_2 sell-sbtc))
      (d3 (dlmm-depth DLMM_POOL_3 DLMM_POOL_ID_3 sell-sbtc))
      (floor (/
        (if (> d1 d2)
          (if (> d1 d3)
            d1
            d3
          )
          (if (> d2 d3)
            d2
            d3
          )
        )
        u100
      ))
      (e1 (and (> d1 u0) (>= d1 floor)))
      (e2 (and (> d2 u0) (>= d2 floor)))
      (e3 (and (> d3 u0) (>= d3 floor)))
    )
    (if (not (or
        (and e1 e2)
        (and e1 e3)
        (and e2 e3)
      ))
      (if e2
        u2
        (if e3
          u3
          u1
        )
      )
      (let (
          (factors (unwrap-panic (unwrap-panic (contract-call? DLMM_CORE get-bin-factors-by-step DLMM_BIN_STEP))))
          (o1 (if e1
            (dlmm-out u1 amount sell-sbtc factors limit)
            u0
          ))
          (o2 (if e2
            (dlmm-out u2 amount sell-sbtc factors limit)
            u0
          ))
          (o3 (if e3
            (dlmm-out u3 amount sell-sbtc factors limit)
            u0
          ))
        )
        (if (and (>= o1 o2) (>= o1 o3))
          u1
          (if (>= o2 o3)
            u2
            u3
          )
        )
      )
    )
  )
)

(define-constant DLMM_BIN_STEP u15)

(define-private (dlmm-threshold
    (limit uint)
    (sell-sbtc bool)
    (fee uint)
  )
  (if sell-sbtc
    (/ (* (/ (* PRICE_SCALE DLMM_PRICE_SCALE) limit) (- BPS fee)) BPS)
    (/ (* (/ (* PRICE_SCALE DLMM_PRICE_SCALE) limit) BPS) (- BPS fee))
  )
)

(define-private (dlmm-out
    (pool uint)
    (amount uint)
    (sell-sbtc bool)
    (factors (list 1001 uint))
    (limit uint)
  )
  (let (
      (info (dlmm-pool-info pool))
      (fee (if sell-sbtc
        (+ (get y-protocol-fee info) (get y-provider-fee info)
          (get y-variable-fee info)
        )
        (+ (get x-protocol-fee info) (get x-provider-fee info)
          (get x-variable-fee info)
        )
      ))
    )
    (if (is-eq (get bin-step info) DLMM_BIN_STEP)
      (let (
          (aid (to-uint (+ (get active-bin-id info) DLMM_CENTER_BIN)))
          (lo (if sell-sbtc
            aid
            (if (>= aid u29)
              (- aid u29)
              u0
            )
          ))
          (hi (if sell-sbtc
            (if (<= (+ aid u30) u1001)
              (+ aid u30)
              u1001
            )
            (+ aid u1)
          ))
          (threshold (if (is-eq limit u0)
            (if sell-sbtc
              u340282366920938463463374607431768211455
              u0
            )
            (dlmm-threshold limit sell-sbtc fee)
          ))
        )
        (get out
          (fold dlmm-out-step DLMM_WALK_BINS {
            pool: pool,
            bin: (get active-bin-id info),
            up: sell-sbtc,
            threshold: threshold,
            initial-price: (get initial-price info),
            factors: (unwrap-panic (slice? factors lo hi)),
            base: lo,
            fee: fee,
            left: amount,
            out: u0,
            done: false,
          })
        )
      )
      u0
    )
  )
)

(define-private (dlmm-out-step
    (i uint)
    (acc {
      pool: uint,
      bin: int,
      up: bool,
      threshold: uint,
      initial-price: uint,
      factors: (list 1001 uint),
      base: uint,
      fee: uint,
      left: uint,
      out: uint,
      done: bool,
    })
  )
  (if (or (get done acc) (is-eq (get left acc) u0))
    acc
    (let (
        (id (to-uint (+ (get bin acc) DLMM_CENTER_BIN)))
        (price (/
          (* (get initial-price acc)
            (unwrap-panic (element-at? (get factors acc) (- id (get base acc))))
          )
          DLMM_PRICE_SCALE
        ))
        (bal (dlmm-bin-balances (get pool acc) id))
        (avail (if (get up acc)
          (get x-balance bal)
          (get y-balance bal)
        ))
        (raw (if (get up acc)
          (/ (+ (* avail price) (- DLMM_PRICE_SCALE u1)) DLMM_PRICE_SCALE)
          (/ (+ (* avail DLMM_PRICE_SCALE) (- price u1)) price)
        ))
        (grossed (if (> (get fee acc) u0)
          (/ (* raw BPS) (- BPS (get fee acc)))
          raw
        ))
        (edge (is-eq (get bin acc)
          (if (get up acc)
            500
            -500
          )))
        (ok-price (if (get up acc)
          (<= price (get threshold acc))
          (>= price (get threshold acc))
        ))
      )
      (if (and ok-price (>= (get left acc) grossed))
        (merge acc {
          out: (+ (get out acc) avail),
          left: (- (get left acc) grossed),
          bin: (if edge
            (get bin acc)
            (if (get up acc)
              (+ (get bin acc) 1)
              (- (get bin acc) 1)
            )
          ),
          done: edge,
        })
        (let ((net (if ok-price
            (/ (* (get left acc) (- BPS (get fee acc))) BPS)
            u0
          )))
          (merge acc {
            out: (+ (get out acc)
              (if (get up acc)
                (/ (* net DLMM_PRICE_SCALE) price)
                (/ (* net price) DLMM_PRICE_SCALE)
              )),
            left: u0,
            done: true,
          })
        )
      )
    )
  )
)

(define-private (dlmm-depth
    (pool principal)
    (id uint)
    (sell-sbtc bool)
  )
  (let ((bal (if sell-sbtc
      (stx-get-balance pool)
      (sbtc-balance pool)
    )))
    (if (and (> bal u0) (dlmm-enabled pool id))
      bal
      u0
    )
  )
)

(define-private (dlmm-enabled
    (pool principal)
    (id uint)
  )
  (match (unwrap-panic (contract-call? DLMM_CORE get-pool-by-id id))
    entry (and
      (get status entry)
      (is-eq (get pool-contract entry) pool)
      (is-eq
        (get core-address
          (dlmm-pool-info (if (is-eq id DLMM_POOL_ID_2)
            u2
            (if (is-eq id DLMM_POOL_ID_3)
              u3
              u1
            )
          ))
        )
        DLMM_CORE
      )
    )
    false
  )
)

(define-private (dlmm-pool-info (pool uint))
  (unwrap-panic (if (is-eq pool u2)
    (contract-call? DLMM_POOL_2 get-pool)
    (if (is-eq pool u3)
      (contract-call? DLMM_POOL_3 get-pool)
      (contract-call? DLMM_POOL_1 get-pool)
    )
  ))
)

(define-private (dlmm-bin-balances
    (pool uint)
    (id uint)
  )
  (unwrap-panic (if (is-eq pool u2)
    (contract-call? DLMM_POOL_2 get-bin-balances id)
    (if (is-eq pool u3)
      (contract-call? DLMM_POOL_3 get-bin-balances id)
      (contract-call? DLMM_POOL_1 get-bin-balances id)
    )
  ))
)

(define-private (dlmm-bin-step
    (i uint)
    (acc {
      pool: uint,
      bin: int,
      up: bool,
      threshold: uint,
      initial-price: uint,
      bin-step: uint,
      fee: uint,
      cap: uint,
      done: bool,
    })
  )
  (if (get done acc)
    acc
    (let (
        (price (unwrap-panic (contract-call? DLMM_CORE get-bin-price (get initial-price acc)
          (get bin-step acc) (get bin acc)
        )))
        (bal (dlmm-bin-balances (get pool acc)
          (to-uint (+ (get bin acc) DLMM_CENTER_BIN))
        ))
        (ok-price (if (get up acc)
          (<= price (get threshold acc))
          (>= price (get threshold acc))
        ))
        (raw (if (get up acc)
          (/ (+ (* (get x-balance bal) price) (- DLMM_PRICE_SCALE u1))
            DLMM_PRICE_SCALE
          )
          (/ (+ (* (get y-balance bal) DLMM_PRICE_SCALE) (- price u1)) price)
        ))
        (grossed (if (> (get fee acc) u0)
          (/ (* raw BPS) (- BPS (get fee acc)))
          raw
        ))
        (edge (is-eq (get bin acc)
          (if (get up acc)
            500
            -500
          )))
      )
      (if ok-price
        (merge acc {
          cap: (+ (get cap acc) grossed),
          bin: (if edge
            (get bin acc)
            (if (get up acc)
              (+ (get bin acc) 1)
              (- (get bin acc) 1)
            )
          ),
          done: edge,
        })
        (merge acc { done: true })
      )
    )
  )
)

(define-private (dlmm-capacity
    (limit uint)
    (sell-sbtc bool)
    (pick uint)
  )
  (let (
      (pool (dlmm-pool-info pick))
      (fee (if sell-sbtc
        (+ (get y-protocol-fee pool) (get y-provider-fee pool)
          (get y-variable-fee pool)
        )
        (+ (get x-protocol-fee pool) (get x-provider-fee pool)
          (get x-variable-fee pool)
        )
      ))
    )
    (get cap
      (fold dlmm-bin-step DLMM_WALK_BINS {
        pool: pick,
        bin: (get active-bin-id pool),
        up: sell-sbtc,
        threshold: (dlmm-threshold limit sell-sbtc fee),
        initial-price: (get initial-price pool),
        bin-step: (get bin-step pool),
        fee: fee,
        cap: u0,
        done: false,
      })
    )
  )
)

(define-private (dust-left
    (left uint)
    (limit uint)
    (sell-sbtc bool)
  )
  (or (is-eq left u0) (<= (limit-min left limit sell-sbtc) u1))
)

(define-private (amm-leg
    (amount uint)
    (limit uint)
    (sell-sbtc bool)
    (venue uint)
  )
  (if sell-sbtc
    (leg-sbtc amount (limit-min amount limit true) venue)
    (leg-stx amount (limit-min amount limit false) venue)
  )
)

(define-private (dlmm-stage
    (left uint)
    (limit uint)
    (sell-sbtc bool)
  )
  (if (dust-left left limit sell-sbtc)
    (ok {
      cap: u0,
      in: u0,
      out: u0,
    })
    (let (
        (pick (dlmm-pick sell-sbtc left limit))
        (cap (if (or (> pick u1) (dlmm-enabled DLMM_POOL_1 DLMM_POOL_ID_1))
          (dlmm-capacity limit sell-sbtc pick)
          u0
        ))
        (plan (if (> cap left)
          left
          cap
        ))
        (leg (if (not (dust-left plan limit sell-sbtc))
          (try! (dlmm-sell pick sell-sbtc plan
            (amm-floor (limit-min plan limit sell-sbtc))
          ))
          {
            in: u0,
            out: u0,
          }
        ))
      )
      (ok {
        cap: cap,
        in: (get in leg),
        out: (get out leg),
      })
    )
  )
)

(define-private (cp-stage
    (left uint)
    (limit uint)
    (sell-sbtc bool)
  )
  (if (dust-left left limit sell-sbtc)
    (ok {
      xyk-cap: u0,
      velar-cap: u0,
      xyk-in: u0,
      xyk-out: u0,
      velar-in: u0,
      velar-out: u0,
      unsold: left,
    })
    (let (
        (q (xyk-quote sell-sbtc))
        (cap-xyk (if (get status q)
          (cp-capacity (get reserves q) (get keep q) limit sell-sbtc)
          u0
        ))
        (cap-velar (cp-capacity (velar-reserves sell-sbtc) (velar-keep) limit sell-sbtc))
        (split (cp-split left cap-xyk cap-velar))
        (plan {
          xyk: (if (dust-left (get xyk split) limit sell-sbtc)
            u0
            (get xyk split)
          ),
          velar: (if (dust-left (get velar split) limit sell-sbtc)
            u0
            (get velar split)
          ),
        })
        (xyk (if (> (get xyk plan) u0)
          {
            in: (get xyk plan),
            out: (try! (xyk-swap sell-sbtc (get xyk plan)
              (amm-floor (limit-min (get xyk plan) limit sell-sbtc))
              (get x-is-sbtc q)
            )),
          }
          {
            in: u0,
            out: u0,
          }
        ))
        (velar (try! (amm-leg (get velar plan) limit sell-sbtc VENUE_VELAR)))
      )
      (ok {
        xyk-cap: cap-xyk,
        velar-cap: cap-velar,
        xyk-in: (get in xyk),
        xyk-out: (get out xyk),
        velar-in: (get in velar),
        velar-out: (get out velar),
        unsold: (- left (get xyk plan) (get velar plan)),
      })
    )
  )
)

(define-public (smart-swap-sbtc-for-stx
    (amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (mid uint)
    (min-stx-out uint)
  )
  (begin
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)
    (asserts! (> limit-price u0) ERR_ZERO_LIMIT)
    (asserts! (> mid u0) ERR_ZERO_MID)
    (let (
        (user tx-sender)
        (stx-before (stx-get-balance user))
        (book (jing-size amount limit-price update mid true))
        (jing-amount (get size book))
        (jing (if (> jing-amount u0)
          (jing-swap jing-amount (get limit book) (unwrap-panic update) true)
          none
        ))
        (jing-in (jing-spent jing))
        (dlmm (try! (dlmm-stage (- amount jing-in) limit-price true)))
        (cp (try! (cp-stage (- amount jing-in (get in dlmm)) limit-price true)))
        (out (gain stx-before (stx-get-balance user)))
      )
      (asserts! (>= out min-stx-out) ERR_MIN_OUT)
      (print {
        topic: "smart-swap-sbtc-for-stx",
        user: user,
        amount: amount,
        limit-price: limit-price,
        jing-cap: jing-amount,
        dlmm-cap: (get cap dlmm),
        xyk-cap: (get xyk-cap cp),
        velar-cap: (get velar-cap cp),
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get xyk-in cp),
        xyk-out: (get xyk-out cp),
        velar-in: (get velar-in cp),
        velar-out: (get velar-out cp),
        unsold: (get unsold cp),
        out: out,
      })
      (ok {
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get xyk-in cp),
        xyk-out: (get xyk-out cp),
        velar-in: (get velar-in cp),
        velar-out: (get velar-out cp),
        unsold: (get unsold cp),
        out: out,
      })
    )
  )
)

(define-public (smart-swap-stx-for-sbtc
    (amount uint)
    (limit-price uint)
    (update (optional (buff 8192)))
    (mid uint)
    (min-sbtc-out uint)
  )
  (begin
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)
    (asserts! (> limit-price u0) ERR_ZERO_LIMIT)
    (asserts! (> mid u0) ERR_ZERO_MID)
    (let (
        (user tx-sender)
        (sbtc-before (sbtc-balance user))
        (book (jing-size amount limit-price update mid false))
        (jing-amount (get size book))
        (jing (if (> jing-amount u0)
          (jing-swap jing-amount (get limit book) (unwrap-panic update) false)
          none
        ))
        (jing-in (jing-spent jing))
        (dlmm (try! (dlmm-stage (- amount jing-in) limit-price false)))
        (cp (try! (cp-stage (- amount jing-in (get in dlmm)) limit-price false)))
        (out (gain sbtc-before (sbtc-balance user)))
      )
      (asserts! (>= out min-sbtc-out) ERR_MIN_OUT)
      (print {
        topic: "smart-swap-stx-for-sbtc",
        user: user,
        amount: amount,
        limit-price: limit-price,
        jing-cap: jing-amount,
        dlmm-cap: (get cap dlmm),
        xyk-cap: (get xyk-cap cp),
        velar-cap: (get velar-cap cp),
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get xyk-in cp),
        xyk-out: (get xyk-out cp),
        velar-in: (get velar-in cp),
        velar-out: (get velar-out cp),
        unsold: (get unsold cp),
        out: out,
      })
      (ok {
        jing-ok: (is-some jing),
        jing-in: jing-in,
        jing-out: (jing-out jing),
        dlmm-in: (get in dlmm),
        dlmm-out: (get out dlmm),
        xyk-in: (get xyk-in cp),
        xyk-out: (get xyk-out cp),
        velar-in: (get velar-in cp),
        velar-out: (get velar-out cp),
        unsold: (get unsold cp),
        out: out,
      })
    )
  )
)

(define-read-only (get-jing-min-deposits)
  (contract-call?
    'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-4
    get-min-deposits
  )
)
