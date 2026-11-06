// stxer-ccd015-stx-coverage.mjs
// Self-verifying mainnet-fork coverage for the CURRENT STX-denominated book,
// contracts/extensions/ccd015-redemption-book-mia-stx.clar (exact repo bytes,
// sha256 pinned). Ported from stxer-ccd015-oracle-coverage.js
// (origin/feat/ccd015-redemption-book), which targeted the old sats book
// `ccd015-redemption-book-mia` (sBTC asks, DIA price, native miner-commit band).
//
// KEPT (adapted to uSTX asks): stranger gating of every DAO setter; cross
// before par (u15011) and with no budget (u15010); offer validation (min
// deposit, zero ask, duplicate) plus the new per-offer cap, MAX_ASK and
// at-placement par gate; cheapest-first ordering with out-of-order insertion;
// MIA escrow accounting; change-offer and cancel-offer; pause; crossing with a
// full fill and a partial frontier fill, then a second partial on the
// remainder; burn accounting (real MIA v2 supply, total-burned-mia,
// total-spent-ustx, exact payments to sellers); nothing stranded at the end.
// ADDED: par gate at cross time after a governance par refresh, DAO-only
// set-min-deposit, and a full 50-offer book with eviction of the worst
// (phase 2, separate fork).
//
// DROPPED, and why:
//   - DIA stale / too-low / too-high price reverts (u14014, u14015) and the
//     get-price checks: the STX book has no price oracle. Asks are uSTX and par
//     is uSTX per micro-MIA, so the par check is a direct comparison.
//   - set-band-enabled and set-coinbase-ustx, and the phase-1 native-price band
//     probe: those setters and the miner-commit price do not exist in this book.
//   - fund-from-treasury and the rewards-treasury sBTC allowlist: this book
//     never touches a treasury. Its budget is its own STX balance, pushed in by
//     the ccd016 vault (fuel-fair-book, covered by stxer-ccip028-activation.mjs)
//     or by any plain transfer; here a real STX holder transfers it.
//   - "offer above par rests and is skipped at cross": the current book refuses
//     above-par offers at placement (u15008). The skip path is reached instead
//     through a real par refresh between placement and cross.
//   - the base-dao SetContractCode patch and the forwarding proxy: DAO calls go
//     through the real ccd001-direct-execute path (three real approvers signal
//     a deployed test proposal; base-dao executes it).
//
// Fixtures: real MIA holders and a real STX holder transfer real balances on
// the fork; 49 phase-2 sellers are fresh addresses funded with 100,000 MIA each
// from a real holder. A test proposal withdraws the extra STX it was given
// from the mining treasury through the real ccd002 withdraw-stx. Unsigned
// simulated senders; nothing is broadcast; no var-set or code patching.
// Run from the repo root: node simulations/stxer-ccd015-stx-coverage.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Cl, cvToString, deserializeCV, getAddressFromPrivateKey } from '@stacks/transactions';
import { SimulationBuilder, getSimulationResult, getSimulationTip, submitSimulationSteps, callContract } from 'stxer';

const NODE = process.env.STACKS_API_URL || 'http://77.42.3.101/stacks-api';
const DEP = 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22';
const DAO = 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH';
const BASE = `${DAO}.base-dao`, DIRECT = `${DAO}.ccd001-direct-execute`;
const MINING = `${DAO}.ccd002-treasury-mia-mining-v3`;
const MIA = 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2';
const APPROVERS = ['SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE', 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ', 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X'];
const STRANGER = 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM';
const STX_WHALE = 'SP2XXSW2KPPTY7KJDYS9RQ868D7JH58QSZKK8KXAV'; // ~336M liquid STX
// real MIA v2 holders (Hiro holders list, 2026-11-05)
const A = 'SP3HXJJMJQ06GNAZ8XWDN1QM48JEDC6PP6W3YZPZJ'; // 1.64B MIA
const B = 'SP22WH53NS94VR6N145ZX77BK4S0EWFBE41VW3Z6B'; // 739M
const C = 'SP1MGH8BH1KRY49Z7EE5TY0JVKT6C3NT9RTVM8FND'; // 124M
const D = 'SP3TF26QFS3YMYHC9N3ZZTZQKCM4AFYMVW1WMFRTT'; // 100M
const E = 'SP1FJ0MY8M18KZF43E85WJN48SDXYS1EC4BCQW02S'; // 475M
const BOOK_NAME = 'ccd015-redemption-book-mia-stx', BOOK = `${DEP}.${BOOK_NAME}`;
const BOOK_FILE = `contracts/extensions/${BOOK_NAME}.clar`;
const BOOK_SHA = 'b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f';
const PAR_SCALE = 100000000n, MICRO = 1000000n, M = (n) => BigInt(n) * MICRO;
const MAX_ASK = 1000000000000000n, CAP = M(10000000), RAISE = 1000000000000n; // 1M STX
const OUT = process.env.SIM_RESULTS_DIR || 'simulations/results/ccd015';
fs.mkdirSync(OUT, { recursive: true });
const DROPPED = [
  'DIA stale/low/high price reverts (u14014/u14015) and get-price checks: no oracle in the STX book; uSTX asks compare directly with par.',
  'set-band-enabled, set-coinbase-ustx and the native-price band probe phase: these setters and the miner-commit price do not exist in this book.',
  'fund-from-treasury and the rewards-treasury sBTC allowlist: the book never touches a treasury; its budget is its own STX balance (ccd016 fuel-fair-book or any transfer).',
  'above-par offer resting and being skipped at cross: placement now refuses above par (u15008); the cross-time skip is reached through a real par refresh instead.',
  'base-dao SetContractCode patch + forwarding proxy: replaced by real ccd001-direct-execute signals on deployed test proposals.',
];
const report = { name: 'stx-coverage', status: 'running', phases: [], checks: [], dropped: DROPPED, fixtures: [
  'Real MIA holders and a real STX holder move real balances on the fork.',
  'Phase 2: 49 fresh seller addresses funded with 100,000 MIA each from a real holder.',
  '1,000,000 STX is sent into ccd002-treasury-mia-mining-v3 to raise par, then withdrawn by a test proposal via ccd002 withdraw-stx.',
  'STX moves through sim-stx-send, a one-line helper the holder calls: (stx-transfer? amount tx-sender to).',
  'DAO calls: test proposals signalled by three real ccd001-direct-execute approvers, executed by base-dao.',
], sourceHashes: {} };
let sid, phase;
const save = () => fs.writeFileSync(`${OUT}/stx-coverage.json`, JSON.stringify(report, null, 2) + '\n');
function check(label, actual, expected) {
  const pass = typeof expected === 'function' ? !!expected(actual) : actual === expected;
  report.checks.push({ phase, label, actual: String(actual), expected: typeof expected === 'function' ? expected.toString() : String(expected), pass, sid });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${report.checks.length}] ${label}: ${String(actual).slice(0, 300)}`);
  if (!pass) { report.status = 'failed'; fin(); throw new Error(`${label}: ${actual} expected ${expected} (https://stxer.xyz/simulations/mainnet/${sid})`); }
  return actual;
}
function fin() { report.passed = report.checks.filter((c) => c.pass).length; report.total = report.checks.length; save(); }
function decode(step) {
  const r = step?.Result ?? step;
  if (r?.Eval && 'Ok' in r.Eval) return cvToString(deserializeCV(r.Eval.Ok));
  if (r?.Transaction?.Ok && !r.Transaction.Ok.vm_error && !r.Transaction.Ok.post_condition_aborted) return cvToString(deserializeCV(r.Transaction.Ok.result));
  throw new Error(`Simulation engine: ${JSON.stringify(r).slice(0, 400)}`);
}
async function read(label, code, expected, contract = BOOK) {
  const res = await submitSimulationSteps(sid, { steps: [{ Eval: [STRANGER, '', contract, code] }] });
  const v = decode(res.steps[0]);
  if (expected !== undefined) check(label, v, expected);
  return v;
}
async function call(label, sender, contract, fn, args, expected = (v) => v.startsWith('(ok')) {
  const r = await callContract(sid, { sender, contract, functionName: fn, functionArgs: args, fee: 0 });
  return check(label, r.vmError || (r.pcAborted ? 'post-condition-aborted' : r.result), expected);
}
const uint = (v) => { const m = String(v).match(/u(\d+)/); if (!m) throw new Error(`Not uint: ${v}`); return BigInt(m[1]); };
const field = (v, k) => BigInt(String(v).match(new RegExp(`\\(${k} u(\\d+)\\)`))[1]);
const P = Cl.principal, u = Cl.uint;
const stx = async (p) => uint(await read('', `(stx-get-balance '${p})`));
const mia = async (p) => uint(await read('', `(unwrap-panic (contract-call? '${MIA} get-balance '${p}))`));
const supply = async () => uint(await read('', `(unwrap-panic (contract-call? '${MIA} get-total-supply))`));
async function book() {
  const v = await read('', '(get-offer-book)');
  return [...v.matchAll(/\(tuple \(amount u(\d+)\) \(owner ([0-9A-Z.a-z-]+)\) \(ustx u(\d+)\)\)/g)].map((m) => ({ owner: m[2], amount: BigInt(m[1]), ustx: BigInt(m[3]) }));
}
async function stxTransfer(label, amount, to) {
  // callContract only builds contract calls, so the holder calls a one-line
  // helper that runs stx-transfer? from tx-sender (the holder's real STX).
  return call(label, STX_WHALE, `${DEP}.sim-stx-send`, 'send', [u(amount), P(to)], '(ok true)');
}
const miaSend = (label, amount, from, to) => call(label, from, MIA, 'transfer', [u(amount), P(from), P(to), Cl.none()], '(ok true)');
const parUstx = (amount, par) => (amount * par) / PAR_SCALE;
const proposal = (name, body) => [name, `(impl-trait '${DAO}.proposal-trait.proposal-trait)
(define-public (execute (sender principal))
  (begin ${body} (ok true)))`];
async function govern(name, lastExpected = '(ok u3)') {
  for (const [i, who] of APPROVERS.entries()) await call(`approver ${i + 1} signals ${name}`, who, DIRECT, 'direct-execute', [P(`${DEP}.${name}`)], i === 2 ? lastExpected : `(ok u${i + 1})`);
}
async function startFork(label, proposals) {
  const source = fs.readFileSync(BOOK_FILE, 'utf8');
  report.sourceHashes[BOOK_FILE] = createHash('sha256').update(source).digest('hex');
  check('book source unchanged (sha256 pinned)', report.sourceHashes[BOOK_FILE], BOOK_SHA);
  const tip = (await (await fetch(`${NODE}/extended/v1/block?limit=1`)).json()).results[0];
  const height = Number(process.env.SIM_BLOCK_HEIGHT || tip.height);
  let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(height).withSender(DEP)
    .addContractDeploy({ contract_name: BOOK_NAME, source_code: source, clarity_version: 6 })
    .addContractDeploy({ contract_name: 'sim-stx-send', source_code: '(define-public (send (amount uint) (to principal)) (stx-transfer? amount tx-sender to))', clarity_version: 6 });
  for (const [n, src] of proposals) b = b.addContractDeploy({ contract_name: n, source_code: src, clarity_version: 6 });
  sid = await b.run();
  const url = `https://stxer.xyz/simulations/mainnet/${sid}`;
  console.log(`${label}: ${url}`);
  const ph = { phase: label, simulationId: sid, url, forkHeight: height };
  report.phases.push(ph); save();
  const steps = (await getSimulationResult(sid)).steps.filter((s) => s.Result?.Transaction);
  const names = [BOOK_NAME, 'sim-stx-send', ...proposals.map((p) => p[0])];
  names.forEach((n, i) => check(`deploy ${n}`, decode(steps[i]), (v) => v === 'true' || v.startsWith('(ok')));
  ph.forkTip = await getSimulationTip(sid);
  await read('direct-execute is an enabled extension', `(is-extension '${DIRECT})`, 'true', BASE);
  await read('direct-execute not sunset', '(< block-height (var-get sunsetBlock))', 'true', DIRECT);
  return ph;
}

async function phase1() {
  phase = 'phase 1: lifecycle';
  const W = `'${STX_WHALE}`;
  await startFork(phase, [
    proposal('sim-p-par1', `(try! (contract-call? '${BOOK} update-par))`),
    proposal('sim-p-min-zero', `(try! (contract-call? '${BOOK} set-min-deposit u0))`),
    proposal('sim-p-pause', `(try! (contract-call? '${BOOK} set-paused true))`),
    proposal('sim-p-unpause', `(try! (contract-call? '${BOOK} set-paused false))`),
    proposal('sim-p-min-200k', `(try! (contract-call? '${BOOK} set-min-deposit u${M(200000)}))`),
    proposal('sim-p-min-100k', `(try! (contract-call? '${BOOK} set-min-deposit u${M(100000)}))`),
    proposal('sim-p-par2', `(try! (contract-call? '${BOOK} update-par))`),
    proposal('sim-p-withdraw-par3', `(try! (contract-call? '${MINING} withdraw-stx u${RAISE} ${W})) (try! (contract-call? '${BOOK} update-par))`),
  ]);
  // --- gating ---
  await call('stranger update-par -> u15000', STRANGER, BOOK, 'update-par', [], '(err u15000)');
  await call('stranger set-paused -> u15000', STRANGER, BOOK, 'set-paused', [Cl.bool(true)], '(err u15000)');
  await call('stranger set-min-deposit -> u15000', STRANGER, BOOK, 'set-min-deposit', [u(1)], '(err u15000)');
  await call('real approver calling set-paused directly -> u15000', APPROVERS[0], BOOK, 'set-paused', [Cl.bool(true)], '(err u15000)');
  await call('book deployer update-par directly -> u15000', DEP, BOOK, 'update-par', [], '(err u15000)');
  await read('initial info: par u0, unpaused, min 100k MIA, empty', '(get-info)', (v) => v.includes('(par-scaled u0)') && v.includes('(paused false)') && v.includes(`(min-deposit u${M(100000)})`) && v.includes('(offer-count u0)'));
  // --- before par ---
  const a0 = await mia(A);
  await call('place-offer before par -> u15011', A, BOOK, 'place-offer', [u(M(200000)), u(1)], '(err u15011)');
  check('refused offer moved no MIA', await mia(A), a0);
  await call('cross-book with zero budget -> u15010', STRANGER, BOOK, 'cross-book', [], '(err u15010)');
  const SEED = 1000000n;
  await stxTransfer('real STX holder sends 1 STX to the book', SEED, BOOK);
  await call('cross-book funded but par unset -> u15011', STRANGER, BOOK, 'cross-book', [], '(err u15011)');
  // --- governance: failing proposal leaves nothing, then par ---
  await govern('sim-p-min-zero', '(err u15001)');
  await read('set-min-deposit u0 refused: min unchanged', '(get-info)', (v) => v.includes(`(min-deposit u${M(100000)})`));
  await read('reverted proposal not recorded as executed', `(executed-at '${DEP}.sim-p-min-zero)`, 'none', BASE);
  const calc = uint(await read('calculate-par before commit', '(calculate-par)'));
  await govern('sim-p-par1');
  const par1 = uint(await read('par-scaled committed = calculate-par', '(get-par-scaled)', `u${calc}`));
  report.par1 = String(par1);
  // --- offer validation ---
  await call('amount = min - 1 -> u15005', A, BOOK, 'place-offer', [u(M(100000) - 1n), u(1)], '(err u15005)');
  await call('amount = 10M MIA + 1 (per-offer cap) -> u15001', A, BOOK, 'place-offer', [u(CAP + 1n), u(1)], '(err u15001)');
  await call('zero ask -> u15001', A, BOOK, 'place-offer', [u(M(200000)), u(0)], '(err u15001)');
  await call('ask = MAX_ASK + 1 -> u15001', A, BOOK, 'place-offer', [u(CAP), u(MAX_ASK + 1n)], '(err u15001)');
  const amtA = M(5000000), amtB = M(3000000), amtC = M(1000000);
  const askA = parUstx(amtA, par1) * 60n / 100n, askB = parUstx(amtB, par1) * 80n / 100n, askC = parUstx(amtC, par1);
  await call('5M MIA asked at par + 1 uSTX -> u15008', A, BOOK, 'place-offer', [u(amtA), u(parUstx(amtA, par1) + 1n)], '(err u15008)');
  check('validation failures moved no MIA', await mia(A), a0);
  const [b0, c0] = [await mia(B), await mia(C)];
  await call('A offers 5M MIA at 60% of par', A, BOOK, 'place-offer', [u(amtA), u(askA)], '(ok true)');
  await call('C offers 1M MIA exactly at par (boundary admitted)', C, BOOK, 'place-offer', [u(amtC), u(askC)], '(ok true)');
  await call('B offers 3M MIA at 80% of par (inserted between)', B, BOOK, 'place-offer', [u(amtB), u(askB)], '(ok true)');
  await call('A duplicate offer -> u15004', A, BOOK, 'place-offer', [u(M(200000)), u(1)], '(err u15004)');
  let bk = await book();
  check('book cheapest-first: A, B, C', bk.map((r) => r.owner).join(','), [A, B, C].join(','));
  check('records exact', JSON.stringify(bk.map((r) => [String(r.amount), String(r.ustx)])), JSON.stringify([[amtA, askA], [amtB, askB], [amtC, askC]].map((x) => x.map(String))));
  check('MIA escrow = A + B + C', await mia(BOOK), amtA + amtB + amtC);
  check('A debited exactly 5M MIA', a0 - await mia(A), amtA);
  check('B debited exactly 3M MIA', b0 - await mia(B), amtB);
  check('C debited exactly 1M MIA', c0 - await mia(C), amtC);
  await read('get-offer B', `(get-offer '${B})`, (v) => v.includes(`(amount u${amtB})`) && v.includes(`(ustx u${askB})`));
  await read('get-book-totals', '(get-book-totals)', `(tuple (amount u${amtA + amtB + amtC}) (ustx u${askA + askB + askC}))`);
  // --- change-offer ---
  await call('change-offer without an offer -> u15002', D, BOOK, 'change-offer', [Cl.none(), u(1)], '(err u15002)');
  await call('change-offer zero ask -> u15001', B, BOOK, 'change-offer', [Cl.none(), u(0)], '(err u15001)');
  await call('change-offer above par -> u15008', B, BOOK, 'change-offer', [Cl.none(), u(parUstx(amtB, par1) + 1n)], '(err u15008)');
  await call('change-offer past the 10M cap -> u15001', B, BOOK, 'change-offer', [Cl.some(u(M(8000000))), u(1)], '(err u15001)');
  const amtB2 = amtB + M(1000000), askB2 = parUstx(amtB2, par1) * 50n / 100n;
  await call('B adds 1M MIA and reprices to 50% of par', B, BOOK, 'change-offer', [Cl.some(u(M(1000000))), u(askB2)], '(ok true)');
  bk = await book();
  check('B moved to the front: B, A, C', bk.map((r) => r.owner).join(','), [B, A, C].join(','));
  check('B record 4M MIA at its new ask', `${bk[0].amount}/${bk[0].ustx}`, `${amtB2}/${askB2}`);
  check('B debited the extra 1M only', b0 - await mia(B), amtB2);
  const askB3 = parUstx(amtB2, par1) * 80n / 100n;
  await call('B reprices (no add) back to 80% of par', B, BOOK, 'change-offer', [Cl.none(), u(askB3)], '(ok true)');
  bk = await book();
  check('order back to A, B, C', bk.map((r) => r.owner).join(','), [A, B, C].join(','));
  check('MIA escrow = A + B(4M) + C', await mia(BOOK), amtA + amtB2 + amtC);
  // --- cancel ---
  const d0 = await mia(D), amtD = M(2000000), askD = parUstx(amtD, par1) * 70n / 100n;
  await call('D offers 2M MIA at 70% of par', D, BOOK, 'place-offer', [u(amtD), u(askD)], '(ok true)');
  check('D inserted at its price: A, D, B, C', (await book()).map((r) => r.owner).join(','), [A, D, B, C].join(','));
  await call('D cancels', D, BOOK, 'cancel-offer', [], '(ok true)');
  check('D refunded exactly', await mia(D), d0);
  await call('D cancels again -> u15002', D, BOOK, 'cancel-offer', [], '(err u15002)');
  check('book back to A, B, C', (await book()).map((r) => r.owner).join(','), [A, B, C].join(','));
  // --- pause ---
  await call('D offers again before the pause', D, BOOK, 'place-offer', [u(amtD), u(askD)], '(ok true)');
  await govern('sim-p-pause');
  await read('paused', '(get paused (get-info))', 'true');
  await call('place-offer while paused -> u15007', E, BOOK, 'place-offer', [u(M(200000)), u(1)], '(err u15007)');
  await call('change-offer while paused -> u15007', A, BOOK, 'change-offer', [Cl.none(), u(askA)], '(err u15007)');
  await call('cross-book while paused -> u15007', STRANGER, BOOK, 'cross-book', [], '(err u15007)');
  await call('cancel-offer while paused still lets D exit', D, BOOK, 'cancel-offer', [], '(ok true)');
  check('D refunded exactly while paused', await mia(D), d0);
  await govern('sim-p-unpause');
  await read('unpaused', '(get paused (get-info))', 'false');
  // --- min deposit setter ---
  await govern('sim-p-min-200k');
  await read('min-deposit 200k MIA', '(get min-deposit (get-info))', `u${M(200000)}`);
  await call('150k MIA under the raised min -> u15005', D, BOOK, 'place-offer', [u(M(150000)), u(1)], '(err u15005)');
  await govern('sim-p-min-100k');
  await read('min-deposit restored to 100k MIA', '(get min-deposit (get-info))', `u${M(100000)}`);
  // --- cross #1: A full + B partial, C kept ---
  const budget1 = askA + askB3 / 2n;
  await stxTransfer('real STX holder funds the book to A + half of B', budget1 - SEED, BOOK);
  check('book budget', await stx(BOOK), budget1);
  const [sa, sb, sc] = [await stx(A), await stx(B), await stx(C)];
  const sup0 = await supply(), esc0 = await mia(BOOK);
  const remB = budget1 - askA, takenB = (amtB2 * remB) / askB3, acq1 = amtA + takenB;
  await call('cross-book #1 (stranger triggers)', STRANGER, BOOK, 'cross-book', [], `(ok (tuple (acquired u${acq1}) (spent u${budget1})))`);
  check('A paid exactly its ask', await stx(A) - sa, askA);
  check('B paid the remaining budget (frontier partial)', await stx(B) - sb, remB);
  check('C paid nothing', await stx(C) - sc, 0n);
  check('book STX spent to zero', await stx(BOOK), 0n);
  check('MIA v2 supply fell by exactly the acquired (burn)', sup0 - await supply(), acq1);
  check('escrow fell by exactly the acquired', esc0 - await mia(BOOK), acq1);
  bk = await book();
  check('kept: B remainder then C', bk.map((r) => r.owner).join(','), [B, C].join(','));
  check('B remainder = (amount - taken, ask - paid)', `${bk[0].amount}/${bk[0].ustx}`, `${amtB2 - takenB}/${askB3 - remB}`);
  check('B remainder implied price <= original (sort and par preserved)', (askB3 - remB) * amtB2 <= askB3 * (amtB2 - takenB), true);
  check('C untouched', `${bk[1].amount}/${bk[1].ustx}`, `${amtC}/${askC}`);
  await read('total-burned-mia and total-spent-ustx', '(get-info)', (v) => v.includes(`(total-burned-mia u${acq1})`) && v.includes(`(total-spent-ustx u${budget1})`) && v.includes('(offer-count u2)'));
  const T = uint(await read('', '(get-treasury-balance)')), S1 = uint(await read('', '(get-mia-total-supply)'));
  await read('advisory par rose after the burn; committed par unchanged', '{ calc: (calculate-par), par: (get-par-scaled) }', `(tuple (calc (some u${(T * PAR_SCALE) / S1})) (par u${par1}))`);
  check('burn raised the advisory par', (T * PAR_SCALE) / S1 >= par1, true);
  await call('cross-book with empty budget -> u15010', STRANGER, BOOK, 'cross-book', [], '(err u15010)');
  // --- cross #2: partial on the remainder ---
  const [rAmt, rAsk] = [bk[0].amount, bk[0].ustx], fund2 = 100000000n, taken2 = (rAmt * fund2) / rAsk;
  await stxTransfer('real STX holder sends 100 STX to the book', fund2, BOOK);
  const sb2 = await stx(B), sup1 = await supply();
  await call('cross-book #2: B remainder partial again', STRANGER, BOOK, 'cross-book', [], `(ok (tuple (acquired u${taken2}) (spent u${fund2})))`);
  check('B paid 100 STX', await stx(B) - sb2, fund2);
  check('supply fell by pro-rata taken', sup1 - await supply(), taken2);
  bk = await book();
  check('B remainder after #2', `${bk[0].owner}/${bk[0].amount}/${bk[0].ustx}`, `${B}/${rAmt - taken2}/${rAsk - fund2}`);
  // --- par gate at cross time ---
  const bRefund = bk[0].amount, b1 = await mia(B);
  await call('B cancels the remainder', B, BOOK, 'cancel-offer', [], '(ok true)');
  check('B refunded exactly the unfilled remainder', await mia(B) - b1, bRefund);
  await stxTransfer('real STX holder sends 1M STX into the mining treasury', RAISE, MINING);
  const calc2 = uint(await read('advisory par after +1M STX backing', '(calculate-par)'));
  await govern('sim-p-par2');
  const par2 = uint(await read('par refreshed upward by governance', '(get-par-scaled)', `u${calc2}`));
  check('par2 > par1', par2 > par1, true);
  const amtE = M(1000000), askE = parUstx(amtE, par2);
  check('E ask is above the old par', askE * PAR_SCALE > amtE * par1, true);
  const e0 = await mia(E);
  await call('E offers 1M MIA at the raised par', E, BOOK, 'place-offer', [u(amtE), u(askE)], '(ok true)');
  const w0 = await stx(STX_WHALE);
  await govern('sim-p-withdraw-par3');
  check('ccd002 withdraw-stx returned 1M STX to the holder', await stx(STX_WHALE) - w0, RAISE);
  const par3 = uint(await read('par refreshed downward', '(get-par-scaled)'));
  check('par3 = calculate-par after withdrawal', par3, uint(await read('', '(calculate-par)')));
  check('par3 < par2', par3 < par2, true);
  await read('E is now above par', `(at-or-below-par? u${amtE} u${askE})`, 'false');
  await read('C is still at or below par', `(at-or-below-par? u${amtC} u${askC})`, 'true');
  await call('E change-offer at the same ask -> u15008 (placement gate on change)', E, BOOK, 'change-offer', [Cl.none(), u(askE)], '(err u15008)');
  check('book: C then E', (await book()).map((r) => r.owner).join(','), [C, E].join(','));
  await stxTransfer('fund the book with C + E asks', askC + askE, BOOK);
  const [sc2, se2, bud] = [await stx(C), await stx(E), await stx(BOOK)];
  await call('cross-book: C fills, E skipped above par', STRANGER, BOOK, 'cross-book', [], `(ok (tuple (acquired u${amtC}) (spent u${askC})))`);
  check('C paid its ask', await stx(C) - sc2, askC);
  check('E paid nothing', await stx(E) - se2, 0n);
  check('unspent budget stays in the book', await stx(BOOK), bud - askC);
  bk = await book();
  check('E kept untouched', `${bk.length}/${bk[0].owner}/${bk[0].amount}/${bk[0].ustx}`, `1/${E}/${amtE}/${askE}`);
  await call('cross-book with only an above-par offer -> u15006', STRANGER, BOOK, 'cross-book', [], '(err u15006)');
  check('budget unchanged by the refused cross', await stx(BOOK), bud - askC);
  await call('E cancels', E, BOOK, 'cancel-offer', [], '(ok true)');
  check('E refunded exactly', await mia(E), e0);
  await read('book empty', '(get-offer-count)', 'u0');
  check('no MIA stranded in the book', await mia(BOOK), 0n);
  const burned = acq1 + taken2 + amtC;
  await read('final accounting', '(get-info)', (v) => v.includes(`(total-burned-mia u${burned})`) && v.includes(`(total-spent-ustx u${budget1 + fund2 + askC})`));
}

async function phase2() {
  phase = 'phase 2: full book + eviction';
  await startFork(phase, [proposal('sim-p-par1', `(try! (contract-call? '${BOOK} update-par))`)]);
  await govern('sim-p-par1');
  const par = uint(await read('par committed', '(get-par-scaled)'));
  const AMT = M(100000), base = parUstx(AMT, par);
  const sellers = [A, ...Array.from({ length: 49 }, (_, i) => getAddressFromPrivateKey((i + 1).toString(16).padStart(2, '0').repeat(32) + '01', 'mainnet'))];
  for (const [i, s] of sellers.entries()) if (i > 0) await miaSend(`fund seller ${i} with 100k MIA from a real holder`, AMT, A, s);
  // place in a scrambled price order; seller i asks (40 + i)% of par
  const order = Array.from({ length: 50 }, (_, i) => (i * 17) % 50);
  const ask = (i) => (base * BigInt(40 + i)) / 100n;
  for (const i of order) await call(`seller ${i} offers 100k MIA at ${40 + i}% of par`, sellers[i], BOOK, 'place-offer', [u(AMT), u(ask(i))], '(ok true)');
  let bk = await book();
  check('50 offers, sorted ascending by price', bk.map((r) => r.owner).join(','), sellers.join(','));
  check('escrow 5M MIA', await mia(BOOK), AMT * 50n);
  const worst = sellers[49], wAsk = ask(49), b0 = await mia(B);
  await call('51st offer at the worst price (not strictly better) -> u15003', B, BOOK, 'place-offer', [u(AMT), u(wAsk)], '(err u15003)');
  await call('51st offer at a worse price -> u15003', B, BOOK, 'place-offer', [u(AMT), u(wAsk + 1n)], '(err u15003)');
  check('refused 51st moved no MIA', await mia(B), b0);
  const w0 = await mia(worst);
  await call('51st offer 1 uSTX better than the worst evicts it', B, BOOK, 'place-offer', [u(AMT), u(wAsk - 1n)], '(ok true)');
  check('evicted seller refunded exactly 100k MIA', await mia(worst) - w0, AMT);
  bk = await book();
  check('still 50 offers, worst gone, newcomer last', `${bk.length}/${bk.some((r) => r.owner === worst)}/${bk[49].owner}`, `50/false/${B}`);
  check('escrow still 5M MIA', await mia(BOOK), AMT * 50n);
  // cheapest-first over the full book: fill the first 10, partial into the 11th
  const first10 = bk.slice(0, 10).reduce((s, r) => s + r.ustx, 0n), part = bk[10].ustx / 3n;
  const taken = (bk[10].amount * part) / bk[10].ustx;
  const STX_WHALE_SEND = first10 + part;
  await call('real STX holder funds the book', STX_WHALE, `${DEP}.sim-stx-send`, 'send', [u(STX_WHALE_SEND), P(BOOK)], '(ok true)');
  const before = await Promise.all(bk.slice(0, 12).map((r) => stx(r.owner)));
  const sup0 = await supply();
  await call('cross-book over 50 offers', STRANGER, BOOK, 'cross-book', [], `(ok (tuple (acquired u${AMT * 10n + taken}) (spent u${STX_WHALE_SEND})))`);
  const after = await Promise.all(bk.slice(0, 12).map((r) => stx(r.owner)));
  check('the 10 cheapest paid their full asks', bk.slice(0, 10).every((r, i) => after[i] - before[i] === r.ustx), true);
  check('11th paid the partial', after[10] - before[10], part);
  check('12th paid nothing', after[11] - before[11], 0n);
  check('supply burned = acquired', sup0 - await supply(), AMT * 10n + taken);
  const kept = await book();
  check('40 kept, frontier remainder first', `${kept.length}/${kept[0].owner}/${kept[0].amount}/${kept[0].ustx}`, `40/${bk[10].owner}/${bk[10].amount - taken}/${bk[10].ustx - part}`);
}

async function main() {
  await phase1();
  await phase2();
  report.status = 'passed'; fin();
  console.log(`PASS ${report.passed}/${report.total}`);
  for (const p of report.phases) console.log(`${p.phase}: ${p.url}`);
}
main().catch((e) => { report.status = 'failed'; report.error = e.stack || String(e); fin(); console.error(e); process.exitCode = 1; });
