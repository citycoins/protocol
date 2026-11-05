Title: feat: activate MiamiCoin STX redemption book and sBTC swap vault through Direct Execute

MiamiCoin's PoX-5 rewards arrive as sBTC, while redemption offers are denominated
in STX. This change includes the existing CCD015 fair book and CCD016 v2 swap
vault, plus an executable CCIP-028 activation proposal and a reproducible
Clarinet SDK integration suite.

Authorized approvers signal through the existing CCD001 Direct Execute contract.
At its configured threshold, the proposal enables the vault's treasury funding,
sets explicit launch parameters with a zero Pyth fee budget, and initializes the
book's par from the backing/supply formula. It contains no tokenholder ballot
and changes neither the approvers nor their threshold/sunset. Subsequent funding,
conversion and MIA retirement calls are permissionless. The book and vault use
their existing source bytes; their implementations are not rewritten here.

Run `npm ci && npm run test:ccip028`. The eight integration cases exercise the
complete DAO/Direct Execute/treasury policies and book/vault/proposal against
local market, oracle and token fixtures. They cover authorization, signals,
sunset, duplicate/replayed activation, atomic rollback/retry and a funding-to-burn
cycle. These are local SDK tests, not a live-mainnet deployment rehearsal.

Deployment order, source hashes, settings, exact approver call and operational
call sequence are in `README-ccip028-activation.md`. The existing governance
discussion at citycoins/governance#53 describes an older RFQ implementation;
reviewers should align that specification before authorizing this variant.

No funds are moved by activation, and this PR does not deploy or execute anything.
