// stxer-ccd015-stx-par-check.mjs
// Mainnet-fork par check for the CURRENT STX-denominated book,
// contracts/extensions/ccd015-redemption-book-mia-stx.clar (exact repo bytes,
// sha256 pinned). Ported from the sats-book stxer-ccd015-par-check.ts
// (origin/feat/ccd015-redemption-book), which targeted the old
// `ccd015-redemption-book-mia` with a native/DIA price; this book has no
// oracle, so the price reads (get-native-price, below-par? with a price) are gone.
//
// Checks, all on one fork at the live tip:
//   1. calculate-par / get-treasury-balance / get-mia-total-supply against
//      independent reads in the same fork: stx-account (locked + unlocked) of
//      ccd002-treasury-mia-mining-v3 and ccd014-pox5-staking-mia, and
//      get-total-supply of MIA v1 (x 10^6) and MIA v2.
//   2. The same values against the Stacks node's own HTTP reads (outside stxer).
//   3. The par formula recomputed in JS: floor(T * 1e8 / S).
//   4. A real update-par through governance: a test proposal signalled by
//      three real ccd001-direct-execute approvers, executed by base-dao.
//      par-scaled must equal calculate-par, and get-par-ustx-per-1m-mia must
//      be near 2,042 STX (within 2%).
//   5. The at-or-below-par? boundary at the committed par.
// Unsigned simulated senders; nothing is broadcast. No var-set, no code patching.
// Run from the repo root: node simulations/stxer-ccd015-stx-par-check.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Cl, cvToString, deserializeCV, serializeCV } from '@stacks/transactions';
import { SimulationBuilder, getSimulationResult, getSimulationTip, submitSimulationSteps, callContract } from 'stxer';

const NODE = process.env.STACKS_API_URL || 'http://77.42.3.101/stacks-api';
const DEP = 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22';
const DAO = 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH';
const BASE = `${DAO}.base-dao`, DIRECT = `${DAO}.ccd001-direct-execute`;
const MINING = `${DAO}.ccd002-treasury-mia-mining-v3`;
const POX5 = 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X.ccd014-pox5-staking-mia';
const MIA_V1 = 'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.miamicoin-token';
const MIA_V2 = 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2';
const APPROVERS = ['SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE', 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ', 'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X'];
const CALLER = 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM';
const BOOK_NAME = 'ccd015-redemption-book-mia-stx', BOOK = `${DEP}.${BOOK_NAME}`;
const BOOK_FILE = `contracts/extensions/${BOOK_NAME}.clar`;
const BOOK_SHA = 'b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f';
const PROP_NAME = 'sim-ccd015-update-par', PROP = `${DEP}.${PROP_NAME}`;
const PROP_SRC = `(impl-trait '${DAO}.proposal-trait.proposal-trait)
(define-public (execute (sender principal))
  (begin (try! (contract-call? '${BOOK} update-par)) (ok true)))`;
const PAR_SCALE = 100000000n, ONE_M_MIA = 1000000000000n;
const OUT = process.env.SIM_RESULTS_DIR || 'simulations/results/ccd015';
fs.mkdirSync(OUT, { recursive: true });
const report = { name: 'stx-par-check', status: 'running', checks: [], fixtures: [], sourceHashes: {}, dropped: [
  'get-native-price (miner-commit price): the STX book has no oracle; asks are uSTX and compare directly with par.',
  'below-par? with a sats ask and a native price: replaced by at-or-below-par? (amount, uSTX ask), checked at the committed par boundary.',
  'get-par-ustx-per-1m-mia round-trip of a hardcoded PAR_SCALED constant: par is no longer a constant; it is committed by update-par from calculate-par, checked in step 4.',
] };
let sid;
const save = () => fs.writeFileSync(`${OUT}/stx-par-check.json`, JSON.stringify(report, null, 2) + '\n');
function check(label, actual, expected) {
  const pass = typeof expected === 'function' ? !!expected(actual) : actual === expected;
  report.checks.push({ label, actual: String(actual), expected: typeof expected === 'function' ? expected.toString() : String(expected), pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${actual}`); save();
  if (!pass) { report.status = 'failed'; save(); throw new Error(`${label}: ${actual} (url ${report.url})`); }
  return actual;
}
function decode(step) {
  const r = step?.Result ?? step;
  if (r?.Eval && 'Ok' in r.Eval) return cvToString(deserializeCV(r.Eval.Ok));
  if (r?.Transaction?.Ok && !r.Transaction.Ok.vm_error && !r.Transaction.Ok.post_condition_aborted) return cvToString(deserializeCV(r.Transaction.Ok.result));
  throw new Error(`Simulation engine: ${JSON.stringify(r).slice(0, 400)}`);
}
async function read(label, contract, code, expected) {
  const res = await submitSimulationSteps(sid, { steps: [{ Eval: [CALLER, '', contract, code] }] });
  const v = decode(res.steps[0]);
  if (expected !== undefined) check(label, v, expected); else console.log(`READ ${label}: ${v}`);
  return v;
}
async function call(label, sender, contract, functionName, functionArgs, expected) {
  const r = await callContract(sid, { sender, contract, functionName, functionArgs, fee: 0 });
  return check(label, r.vmError || (r.pcAborted ? 'post-condition-aborted' : r.result), expected);
}
const uint = (v) => { const m = String(v).match(/u(\d+)/); if (!m) throw new Error(`Not uint: ${v}`); return BigInt(m[1]); };
const field = (v, k) => BigInt(String(v).match(new RegExp(`\\(${k} u(\\d+)\\)`))[1]);
async function json(url, opt) { const r = await fetch(url, opt); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }
async function nodeAccount(p) { const a = await json(`${NODE}/v2/accounts/${p}?proof=0`); return { unlocked: BigInt(a.balance), locked: BigInt(a.locked) }; }
async function nodeSupply(id) {
  const [a, n] = id.split('.');
  const r = await json(`${NODE}/v2/contracts/call-read/${a}/${n}/get-total-supply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sender: CALLER, arguments: [] }) });
  return uint(cvToString(deserializeCV(r.result)));
}

async function main() {
  const source = fs.readFileSync(BOOK_FILE, 'utf8');
  report.sourceHashes[BOOK_FILE] = createHash('sha256').update(source).digest('hex');
  check('book source unchanged (sha256 pinned)', report.sourceHashes[BOOK_FILE], BOOK_SHA);
  const tip = (await json(`${NODE}/extended/v1/block?limit=1`)).results[0];
  const height = Number(process.env.SIM_BLOCK_HEIGHT || tip.height);
  report.forkHeight = height;
  const b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(height).withSender(DEP)
    .addContractDeploy({ contract_name: BOOK_NAME, source_code: source, clarity_version: 6 })
    .addContractDeploy({ contract_name: PROP_NAME, source_code: PROP_SRC, clarity_version: 6 });
  sid = await b.run(); report.simulationId = sid; report.url = `https://stxer.xyz/simulations/mainnet/${sid}`; console.log(report.url); save();
  const setup = (await getSimulationResult(sid)).steps.filter((s) => s.Result?.Transaction);
  check('deploy book (exact repo bytes)', decode(setup[0]), (v) => v === 'true' || v.startsWith('(ok'));
  check('deploy test proposal', decode(setup[1]), (v) => v === 'true' || v.startsWith('(ok'));
  report.forkTip = await getSimulationTip(sid);

  // 1. book reads vs independent fork reads
  const T = uint(await read('book get-treasury-balance', BOOK, '(get-treasury-balance)'));
  const S = uint(await read('book get-mia-total-supply', BOOK, '(get-mia-total-supply)'));
  const calc = uint(await read('book calculate-par', BOOK, '(calculate-par)'));
  const mining = await read('independent stx-account mining-v3', BOOK, `(stx-account '${MINING})`);
  const staked = await read('independent stx-account ccd014-pox5-staking-mia', BOOK, `(stx-account '${POX5})`);
  const forkT = field(mining, 'locked') + field(mining, 'unlocked') + field(staked, 'locked') + field(staked, 'unlocked');
  check('treasury = mining-v3 (locked+unlocked) + pox5 staking (locked+unlocked)', T, forkT);
  check('treasury is positive (STX stacked under PoX-5)', T > 0n, true);
  const v1 = uint(await read('independent MIA v1 get-total-supply', BOOK, `(contract-call? '${MIA_V1} get-total-supply)`));
  const v2 = uint(await read('independent MIA v2 get-total-supply', BOOK, `(contract-call? '${MIA_V2} get-total-supply)`));
  check('supply = v1 * 10^6 + v2', S, v1 * 1000000n + v2);
  // 2. node HTTP reads (outside stxer)
  const [nm, ns] = [await nodeAccount(MINING), await nodeAccount(POX5)];
  const nodeT = nm.locked + nm.unlocked + ns.locked + ns.unlocked;
  report.nodeReads = { mining: { locked: String(nm.locked), unlocked: String(nm.unlocked) }, pox5: { locked: String(ns.locked), unlocked: String(ns.unlocked) } };
  check('treasury equals node /v2/accounts reads', T, nodeT);
  const [nv1, nv2] = [await nodeSupply(MIA_V1), await nodeSupply(MIA_V2)];
  report.nodeReads.supplyV1 = String(nv1); report.nodeReads.supplyV2 = String(nv2);
  check('supply equals node call-read get-total-supply (v1 * 10^6 + v2)', S, nv1 * 1000000n + nv2);
  // 3. formula in JS
  const jsPar = (T * PAR_SCALE) / S;
  check('calculate-par = floor(T * 1e8 / S) recomputed in JS', calc, jsPar);
  const per1m = (ONE_M_MIA * jsPar) / PAR_SCALE;
  report.parStxPerMillionMia = Number(per1m) / 1e6;
  console.log(`par: ${Number(per1m) / 1e6} STX per 1M MIA (T ${Number(T) / 1e6} STX, S ${Number(S) / 1e6} MIA)`);
  check('advisory par near 2,042 STX per 1M MIA (within 2%)', Number(per1m) / 1e6, (v) => Math.abs(v - 2042) / 2042 < 0.02);
  // before governance: nothing committed
  await read('par-scaled u0 before update-par', BOOK, '(get-par-scaled)', 'u0');
  await read('get-par-ustx-per-1m-mia u0 before update-par', BOOK, '(get-par-ustx-per-1m-mia)', 'u0');
  await call('stranger update-par refused', CALLER, BOOK, 'update-par', [], '(err u15000)');
  // 4. real governance path
  await read('direct-execute enabled in base-dao', BASE, `(is-extension '${DIRECT})`, 'true');
  await read('direct-execute not sunset', DIRECT, '(< block-height (var-get sunsetBlock))', 'true');
  for (const [i, who] of APPROVERS.entries()) await call(`approver ${i + 1} signals update-par proposal`, who, DIRECT, 'direct-execute', [Cl.principal(PROP)], `(ok u${i + 1})`);
  await read('proposal executed by base-dao', BASE, `(executed-at '${PROP})`, (v) => v.startsWith('(some u'));
  const par = uint(await read('committed par-scaled', BOOK, '(get-par-scaled)'));
  check('committed par-scaled = calculate-par = JS formula', par, jsPar);
  await read('get-par-ustx-per-1m-mia = 1e12 * par / 1e8', BOOK, '(get-par-ustx-per-1m-mia)', `u${per1m}`);
  // 5. boundary
  const atPar = (ONE_M_MIA * par) / PAR_SCALE;
  await read('1M MIA asked at floor(par) is at-or-below par', BOOK, `(at-or-below-par? u${ONE_M_MIA} u${atPar})`, 'true');
  await read('1M MIA asked at par + 1 uSTX is above par', BOOK, `(at-or-below-par? u${ONE_M_MIA} u${atPar + 1n})`, 'false');
  await read('get-par-ustx(1M MIA) = floor', BOOK, `(get-par-ustx u${ONE_M_MIA})`, `u${atPar}`);
  await read('get-info', BOOK, '(get-info)', (v) => v.includes(`(par-scaled u${par})`) && v.includes(`(calculated-par (some u${par}))`));
  report.values = { treasuryUstx: String(T), supplyMicroMia: String(S), supplyV1: String(v1), supplyV2: String(v2), parScaled: String(par), parUstxPer1mMia: String(per1m) };
  report.passed = report.checks.filter((c) => c.pass).length; report.total = report.checks.length;
  report.status = 'passed'; save();
  console.log(`PASS ${report.passed}/${report.total}: ${report.url}`);
}
main().catch((e) => { report.status = 'failed'; report.error = e.stack || String(e); report.passed = report.checks.filter((c) => c.pass).length; report.total = report.checks.length; save(); console.error(e); process.exitCode = 1; });
