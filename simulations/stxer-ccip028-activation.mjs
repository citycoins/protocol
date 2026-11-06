// Mainnet-fork only: unsigned simulated senders, never broadcasts transactions.
// Exact repository source bytes; no SetContractCode, governance bypass or var-set.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Cl, cvToString, deserializeCV } from '@stacks/transactions';
import { SimulationBuilder, getSimulationResult, getSimulationTip, submitSimulationSteps, callContract } from 'stxer';

const NODE = process.env.STACKS_API_URL || 'http://77.42.3.101/stacks-api';
const DEP = 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22';
const DAO = 'SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH';
const BASE = `${DAO}.base-dao`, DIRECT = `${DAO}.ccd001-direct-execute`;
const TREASURY = `${DAO}.ccd002-treasury-mia-rewards-v3`;
const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
const MIA = 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2';
const DIA = 'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle';
const MARKET = `${DEP}.markets-sbtc-stx-jing-v6-4`;
const BOOK_NAME = 'ccd015-redemption-book-mia-stx', VAULT_NAME = 'ccd016-swap-vault-mia-v2';
const PROPOSAL_NAME = 'ccip028-activate-mia-fair-redemption';
const BOOK = `${DEP}.${BOOK_NAME}`, VAULT = `${DEP}.${VAULT_NAME}`, PROPOSAL = `${DEP}.${PROPOSAL_NAME}`;
const APPROVERS = ['SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE', 'SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ',
  'SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X', 'SP2R0DQYR7XHD161SH2GK49QRP1YSV7HE9JSG7W6G', 'SP372JVX6EWE2M0XPA84MWZYRRG2M6CAC4VVC12V1'];
const CALLER = 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM';
const SBTC_HOLDER = 'SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2';
const SELLER = 'SP3HXJJMJQ06GNAZ8XWDN1QM48JEDC6PP6W3YZPZJ';
const OUT = process.env.SIM_RESULTS_DIR || 'simulations/results/ccip028-activation';
fs.mkdirSync(OUT, { recursive: true });
const report = { status: 'running', checks: [], fixtures: [], sourceHashes: {}, receipts: [], updates: [] };
let sid;
function save() { fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(report, null, 2) + '\n'); }
function check(label, actual, expected) {
  const pass = typeof expected === 'function' ? expected(actual) : actual === expected;
  report.checks.push({ label, actual, expected: typeof expected === 'function' ? expected.toString() : expected, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${actual}`); save();
  if (!pass) throw new Error(`${label}: ${actual}`);
  return actual;
}
function decode(step) {
  const r = step?.Result ?? step;
  if (r?.Eval && 'Ok' in r.Eval) return cvToString(deserializeCV(r.Eval.Ok));
  if (r?.Transaction?.Ok && !r.Transaction.Ok.vm_error && !r.Transaction.Ok.post_condition_aborted)
    return cvToString(deserializeCV(r.Transaction.Ok.result));
  throw new Error(`Simulation engine: ${JSON.stringify(r)}`);
}
async function read(label, contract, code, expected) {
  const res = await submitSimulationSteps(sid, { steps: [{ Eval: [CALLER, '', contract, code] }] });
  report.receipts.push({ label, ...res });
  const value = decode(res.steps[0]);
  if (expected !== undefined) check(label, value, expected);
  else { console.log(`READ ${label}: ${value}`); save(); }
  return value;
}
function ok(value) { return value.startsWith('(ok'); }
function uint(value) { const match = value.match(/u(\d+)/); if (!match) throw new Error(`Not uint: ${value}`); return BigInt(match[1]); }
async function call(label, sender, contract, functionName, functionArgs = [], expected = ok) {
  const result = await callContract(sid, { sender, contract, functionName, functionArgs, fee: 0 });
  report.receipts.push({ label, sender, contract, functionName, ...result });
  check(label, result.vmError || (result.pcAborted ? 'post-condition-aborted' : result.result), expected);
  return result;
}
async function json(url, options) { const r = await fetch(url, options); if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`); return r.json(); }
async function update(label) {
  // Public frontend access key; override with FAKTORY_API_KEY if rotated.
  const key = process.env.FAKTORY_API_KEY || 'jc_e4d2e10396eef95215a7afd492f42d743a3325739d29200c2a28b256f778be01';
  const { data } = await json('https://faktory-dao-backend.vercel.app/api/auction/pyth-lazer-update?pair=sbtc-stx', { headers: { 'x-api-key': key } });
  report.updates.push({ label, ...data }); save();
  return { cv: Cl.bufferFromHex(data.hex.replace(/^0x/, '')), x: BigInt(data.priceX), y: BigInt(data.priceY), timestamp: BigInt(data.timestampUs) / 1000n };
}
async function main() {
  const tip = (await json(`${NODE}/extended/v1/block?limit=1`)).results[0];
  // A recent parent leaves room for 289 synthetic one-second burn blocks
  // without requiring future signed oracle data. Height, not elapsed seconds,
  // controls this vault's patience window. No vault parameter is shortened.
  const height = Number(process.env.SIM_BLOCK_HEIGHT || tip.height - 600);
  const block = await json(`${NODE}/extended/v1/block/by_height/${height}`);
  report.parentBlock = block;
  report.fixtures.push('Unsigned simulated senders; no real approvals or asset transfers.',
    '289 synthetic burn blocks at one second each; tests the full 288-block window, not two days of market evolution.');
  const files = [`contracts/extensions/${BOOK_NAME}.clar`, `contracts/extensions/${VAULT_NAME}.clar`, `contracts/proposals/${PROPOSAL_NAME}.clar`];
  const expectedHashes = ['b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f', 'ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e'];
  let builder = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(height).withSender(DEP);
  for (const [i, file] of files.entries()) {
    const source = fs.readFileSync(file, 'utf8');
    const hash = createHash('sha256').update(source).digest('hex'); report.sourceHashes[file] = hash;
    if (expectedHashes[i]) check(`unchanged ${file}`, hash, expectedHashes[i]);
    if (i === 2) check('proposal leeway is 10%', source.includes('set-leeway-bps u1000)'), true);
    builder = builder.addContractDeploy({ contract_name: [BOOK_NAME, VAULT_NAME, PROPOSAL_NAME][i], source_code: source, clarity_version: 6 });
  }
  sid = await builder.run(); report.simulationId = sid; report.url = `https://stxer.xyz/simulations/mainnet/${sid}`;
  console.log(report.url); save();
  const setup = await getSimulationResult(sid); report.setup = setup;
  let i = 0;
  for (const step of setup.steps) if (step.Result?.Transaction) check(`deploy ${files[i++]}`, decode(step), (v) => v === 'true' || v === '(ok true)');
  check('three deploy receipts', i, 3);
  report.initialTip = await getSimulationTip(sid);
  await read('Direct Execute enabled', BASE, `(is-extension '${DIRECT})`, 'true');
  await read('live signal threshold', DIRECT, '(get-signals-required)', 'u3');
  for (const who of APPROVERS) await read(`real approver ${who}`, DIRECT, `(is-approver '${who})`, 'true');
  await read('sunset and current height', DIRECT, '{ sunset: (var-get sunsetBlock), height: block-height, open: (< block-height (var-get sunsetBlock)) }', function open(v) { return v.includes('(open true)'); });
  for (const [index, who] of APPROVERS.slice(0, 3).entries()) {
    await call(`approver signal ${index + 1}`, who, DIRECT, 'direct-execute', [Cl.principal(PROPOSAL)], `(ok u${index + 1})`);
    await read(`vault enabled after signal ${index + 1}`, BASE, `(is-extension '${VAULT})`, index === 2 ? 'true' : 'false');
  }
  await read('proposal execution recorded', BASE, `(executed-at '${PROPOSAL})`, function recorded(v) { return v.startsWith('(some u'); });
  const par = uint(await read('par micro-STX per 1M MIA', BOOK, '(get-par-ustx-per-1m-mia)'));
  report.parStxPerMillionMia = Number(par) / 1e6;
  check('par near 2042 STX per 1M MIA (within 2%)', Number(par) / 1e6, function near(v) { return Math.abs(v - 2042) / 2042 < 0.02; });
  await read('book unpaused', BOOK, '(get paused (get-info))', 'false');
  await read('treasury allows sBTC', TREASURY, `(is-allowed '${SBTC})`, 'true');
  await read('10% leeway active', VAULT, '(get leeway-bps (get-config))', 'u1000');
  await read('zero Pyth fee budget', VAULT, '(get pyth-fee-budget (get-config))', 'u0');
  await read('vault launch config', VAULT, '(get-config)');
  report.activationPassed = true; save();
  const treasurySats = uint(await read('treasury sBTC before funding', SBTC, `(get-balance '${TREASURY})`));
  if (treasurySats < 100000n) {
    const topup = 100000n - treasurySats;
    report.fixtures.push(`Real holder ${SBTC_HOLDER} transfers ${topup} sats into rewards treasury on the fork.`);
    await call('fund treasury from real sBTC holder', SBTC_HOLDER, SBTC, 'transfer', [Cl.uint(topup), Cl.principal(SBTC_HOLDER), Cl.principal(TREASURY), Cl.none()]);
  }
  const miaAmount = 100000000000n, ask = 100000000n;
  await read('seller owns at least 100000 MIA', MIA, `(>= (unwrap-panic (get-balance '${SELLER})) u${miaAmount})`, 'true');
  await call('seller offers 100000 MIA for 100 STX', SELLER, BOOK, 'place-offer', [Cl.uint(miaAmount), Cl.uint(ask)]);
  await call('permissionless fund-from-treasury', CALLER, VAULT, 'fund-from-treasury');
  await read('maker window open', VAULT, '(window-open)', 'true');
  const u1 = await update('placement');
  await call('permissionless jing-place', CALLER, VAULT, 'jing-place', [u1.cv]);
  if (await read('pending deposit?', MARKET, `(is-some (get-token-x-pending-deposit '${VAULT}))`) === 'true')
    await call('keeper settles vault deposit', DEP, MARKET, 'settle-token-x-deposit', [Cl.principal(VAULT), u1.cv, Cl.principal(SBTC), Cl.stringAscii('sbtc-token')]);
  await read('vault resting on real Jing market', VAULT, '(get jing-resting (get-status))', function positive(v) { return uint(v) > 0n; });
  const advanced = await submitSimulationSteps(sid, { steps: [{ AdvanceBlocks: { bitcoin_blocks: 289, stacks_blocks_per_bitcoin: 1, bitcoin_interval_secs: 1 } }] });
  report.receipts.push({ label: 'advance full maker window', ...advanced }); save();
  if (advanced.steps.some(function failed(step) { return step.Result?.AdvanceBlocks?.Err; })) throw new Error(JSON.stringify(advanced));
  report.elapsedTip = await getSimulationTip(sid);
  check('advanced 289 Bitcoin blocks', report.elapsedTip.burn_height - report.initialTip.burn_height, 289);
  await read('maker window elapsed', VAULT, '(window-elapsed)', 'true');
  const u2 = await update('liquidation');
  await call('permissionless jing-reclaim', CALLER, VAULT, 'jing-reclaim', [Cl.some(u2.cv)]);
  await call('permissionless router-swap', CALLER, VAULT, 'router-swap', [u2.cv]);
  const proceeds = uint(await read('vault STX proceeds', VAULT, `(stx-get-balance '${VAULT})`));
  check('proceeds cover the 100 STX offer', proceeds.toString(), function enough(v) { return BigInt(v) >= ask; });
  await call('permissionless fuel-fair-book', CALLER, VAULT, 'fuel-fair-book');
  await read('all STX proceeds reached book', BOOK, `(stx-get-balance '${BOOK})`, `u${proceeds}`);
  const supplyBefore = uint(await read('MIA supply before crossing', MIA, '(get-total-supply)'));
  const sellerBefore = uint(await read('seller STX before crossing', BOOK, `(stx-get-balance '${SELLER})`));
  await call('permissionless cross-book', CALLER, BOOK, 'cross-book');
  const supplyAfter = uint(await read('MIA supply after crossing', MIA, '(get-total-supply)'));
  const sellerAfter = uint(await read('seller STX after crossing', BOOK, `(stx-get-balance '${SELLER})`));
  check('100000 MIA burned from real token supply', (supplyBefore - supplyAfter).toString(), miaAmount.toString());
  check('seller received exactly 100 STX', (sellerAfter - sellerBefore).toString(), ask.toString());
  await read('book burn accounting', BOOK, '(get total-burned-mia (get-info))', `u${miaAmount}`);
  await read('offer fully consumed', BOOK, '(get-offer-count)', 'u0');
  await read('remaining vault state', VAULT, '(get-status)');
  report.status = 'passed'; save();
  console.log(`PASS ${report.checks.length}/${report.checks.length}: ${report.url}`);
}
main().catch(function failure(error) { report.status = 'failed'; report.error = error.stack || String(error); save(); console.error(error); process.exitCode = 1; });
