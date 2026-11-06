// The LIVE Jing stack for the ccd016 v2 stxer sims (fork only, nothing broadcast).
//
// markets-sbtc-stx-jing-v6-4 and swap-router-sbtc-stx-jing-v5-5 run at their
// real mainnet principals with their deployed bytes and live state: no Jing
// contract is redeployed, aliased or rebound. The vault and the book deploy
// from the repo bytes unchanged (sha256 pinned below), so the vault's
// hard-coded JING_MARKET / JING_ROUTER are the real ones.
//
// The deterministic scenarios (a taker filling the vault at its exact price,
// the vault as the only maker, a full side built from known entrants) need an
// empty book. At the tip the live book holds third-party makers, so
// planLiveBookClear() empties it first with real actions only, worked out on a
// throwaway fork of the same block and then replayed as the first steps of the
// scenario's own fork:
//   1. a real STX holder takes every fillable ask (market `swap`, sized by the
//      market's own get-taker-capacity), a real sBTC holder sells into every
//      fillable bid the same way;
//   2. a maker still resting after that (an order pegged outside the current
//      mid) is cancelled by its own principal: a standard principal calls
//      cancel-token-{x,y}-deposit itself; a contract maker that exposes
//      cancel-buy-back is cancelled by its real owner (get-owner).
// liveJingChecks() then asserts the live market is initialized, verified in
// core-v6, and has no depositor on either side. Parked entries and pending
// escrows of third parties are not touched (they do not rest in the book).
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {Cl, cvToString, deserializeCV} from '@stacks/transactions';
import {SimulationBuilder, submitSimulationSteps, callContract} from 'stxer';
import {fetchLazerUpdateAny} from './_vault-lazer.mjs';

export const DEP = 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22';
export const MKT = 'markets-sbtc-stx-jing-v6-4', ROUTER = 'swap-router-sbtc-stx-jing-v5-5';
export const CORE = 'jing-core-v6', LADDER = 'jing-ladder-v1';
export const MKT_ID = `${DEP}.${MKT}`, ROUTER_ID = `${DEP}.${ROUTER}`, CORE_ID = `${DEP}.${CORE}`, LADDER_ID = `${DEP}.${LADDER}`;
const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', WSTX = 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2';
// Real holders at the tip (2026-11-05). The older sims' STX holder
// SP9BP4PN74CNR5XT7CMAMBPA0GWC9HMB69HVVV51 is empty now.
export const STX_HOLDER = 'SP2XXSW2KPPTY7KJDYS9RQ868D7JH58QSZKK8KXAV';
export const SBTC_HOLDER = 'SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2';
// FORK_BLOCK pins a rerun set to one height; default: the node tip - 3.
export const FORK_BLOCK = process.env.FORK_BLOCK ? Number(process.env.FORK_BLOCK) : undefined;
export async function forkTip(node) {
  const get = async (p) => { const r = await fetch(`${node}${p}`); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
  if (FORK_BLOCK !== undefined) return get(`/extended/v1/block/by_height/${FORK_BLOCK}`);
  // A few blocks behind the node tip: stxer can lag the node by a block or two.
  const head = (await get('/extended/v1/block?limit=1')).results[0];
  return get(`/extended/v1/block/by_height/${head.height - 3}`);
}

// Deployed bytes (GET /v2/contracts/source/<id>), checked at run time.
export const LIVE_SHA = {
  [MKT]: '6b3e6943806350daace1498b6b923479cf61b1f555e814f9a01d5db972f436bf',
  [ROUTER]: '6b65927e564d0bc3df239c5b872b45358f4349e2ec652cf8198e36fd4f3dac7c',
};
export const VAULT_FILE = 'contracts/extensions/ccd016-swap-vault-mia-v2.clar';
export const BOOK_FILE = 'contracts/extensions/ccd015-redemption-book-mia-stx.clar';
export const VAULT_SHA = 'ac0c305f8bfcfd9f210fb37cba6e1f4d61a26ad40ed7ca4792beca948778502e';
export const BOOK_SHA = 'b3526d4ce89e615108c1b6781bf67b6f8354e3880adb404883a30fbdd36ec65f';

const sha = (s) => createHash('sha256').update(s).digest('hex');

// Exact repo bytes for the vault and the book; throws on a hash mismatch.
export function exactSources() {
  const vault = readFileSync(VAULT_FILE, 'utf8'), book = readFileSync(BOOK_FILE, 'utf8');
  if (sha(vault) !== VAULT_SHA) throw new Error(`vault sha ${sha(vault)} != pinned ${VAULT_SHA}`);
  if (sha(book) !== BOOK_SHA) throw new Error(`book sha ${sha(book)} != pinned ${BOOK_SHA}`);
  if (!vault.includes(`'${MKT_ID})`) || !vault.includes(`'${ROUTER_ID})`)) throw new Error('vault does not bind live market v6-4 / router v5-5');
  return {vault, book, vaultSha: VAULT_SHA, bookSha: BOOK_SHA};
}

// Fetch the deployed Jing bytes and check them against LIVE_SHA.
export async function liveJingHashes(node) {
  const out = {};
  for (const name of [MKT, ROUTER]) {
    const r = await fetch(`${node}/v2/contracts/source/${DEP}/${name}?proof=0`);
    if (!r.ok) throw new Error(`source ${name}: ${r.status}`);
    const h = sha((await r.json()).source);
    if (h !== LIVE_SHA[name]) throw new Error(`${name} deployed sha ${h} != ${LIVE_SHA[name]}`);
    out[name] = h;
  }
  return out;
}

const swapArgs = (amount, limit, updHex, depositX) => [Cl.uint(amount), Cl.uint(limit), Cl.bufferFromHex(updHex), Cl.principal(SBTC),
  Cl.stringAscii('sbtc-token'), Cl.principal(WSTX), Cl.stringAscii('wstx'), Cl.bool(depositX)];
const HUGE = 10n ** 18n;

// Work out the clearing steps on a throwaway fork of `height` with the same
// signed update the scenario will use. Returns [{label, sender, contract, fn, args, want}].
export async function planLiveBookClear(node, height, updHex, mid) {
  updHex = updHex.replace(/^0x/, '');
  const sid = await SimulationBuilder.new({stacksNodeAPI: node}).useBlockHeight(height).withSender(DEP).addEvalCode(MKT_ID, '(get-current-cycle)').run();
  const ev = async (contract, code) => {
    const r = await submitSimulationSteps(sid, {steps: [{Eval: [DEP, '', contract, code]}]});
    const e = (r.steps[0].Result ?? r.steps[0]).Eval;
    if (!('Ok' in e)) throw new Error(`clear-plan eval ${code}: ${JSON.stringify(e)}`);
    return cvToString(deserializeCV(e.Ok));
  };
  const lists = async () => {
    const s = await ev(MKT_ID, '{x: (get-token-x-depositors (get-current-cycle)), y: (get-token-y-depositors (get-current-cycle))}');
    const side = (k) => [...(s.match(new RegExp(`\\(${k} \\(list([^)]*)\\)`))?.[1] ?? '').matchAll(/S[PM][0-9A-Z]+(?:\.[a-zA-Z0-9-]+)?/g)].map((m) => m[0]);
    return {x: side('x'), y: side('y')};
  };
  const steps = [];
  const run = async (step) => {
    const r = await callContract(sid, {sender: step.sender, contract: step.contract, functionName: step.fn, functionArgs: step.args, fee: 0});
    const v = r.vmError || r.result;
    if (!String(v).startsWith('(ok')) throw new Error(`clear-plan ${step.label}: ${v} (https://stxer.xyz/simulations/mainnet/${sid})`);
    steps.push({...step, want: (x) => String(x).startsWith('(ok'), probe: v});
  };
  for (const [depositX, taker, limit, label] of [[false, STX_HOLDER, HUGE, 'takes every fillable live ask'], [true, SBTC_HOLDER, 1n, 'sells into every fillable live bid']]) {
    const before = await lists();
    if (!(depositX ? before.y : before.x).length) continue;
    const cap = await ev(MKT_ID, `(get-taker-capacity u${mid} u${limit} ${depositX} '${taker} (some 0x${updHex}))`);
    const gross = BigInt(cap.match(/gross-cap u(\d+)/)[1]);
    if (gross === 0n) continue;
    await run({label: `CLEAR live book: real ${depositX ? 'sBTC' : 'STX'} holder ${label} (swap ${gross}, sized by get-taker-capacity)`,
      sender: taker, contract: MKT_ID, fn: 'swap', args: swapArgs(gross, limit, updHex, depositX)});
  }
  const rest = await lists();
  for (const [side, makers] of [['x', rest.x], ['y', rest.y]]) for (const who of makers) {
    if (!who.includes('.')) {
      await run({label: `CLEAR live book: ${who} cancels its own resting ${side.toUpperCase()} order`, sender: who, contract: MKT_ID,
        fn: `cancel-token-${side}-deposit`, args: side === 'x' ? [Cl.principal(SBTC), Cl.stringAscii('sbtc-token')] : [Cl.principal(WSTX), Cl.stringAscii('wstx')]});
      continue;
    }
    const owner = await ev(who, '(get-owner)').catch(() => null);
    if (!owner || !/^S[PM]/.test(owner)) throw new Error(`clear-plan: no owner path to cancel ${who}`);
    await run({label: `CLEAR live book: owner ${owner} cancels ${who.split('.')[1]}'s out-of-range ${side.toUpperCase()} order (cancel-buy-back)`,
      sender: owner, contract: who, fn: 'cancel-buy-back', args: []});
  }
  const end = await lists();
  if (end.x.length || end.y.length) throw new Error(`clear-plan left makers: ${JSON.stringify(end)} (https://stxer.xyz/simulations/mainnet/${sid})`);
  return {steps, planSid: sid};
}

// Eval checks that the fork has the live stack initialized with an empty book.
// ev(label, contractId, code, want) is each harness's own plan-step helper.
export function liveJingChecks(ev) {
  ev('S0 LIVE market v6-4: initialized sBTC/wSTX, feeds 1/45, mins 1000 sats / 1 STX, unpaused',
    MKT_ID, '{i: (var-get initialized), x: (var-get token-x), y: (var-get token-y), fx: (var-get feed-id-x), fy: (var-get feed-id-y), mx: (var-get min-token-x-deposit), my: (var-get min-token-y-deposit), p: (var-get paused)}',
    `(tuple (fx u1) (fy u45) (i true) (mx u1000) (my u1000000) (p false) (x ${SBTC}) (y ${WSTX}))`);
  ev('S0 LIVE market v6-4: verified in core-v6', CORE_ID, `(is-verified-contract '${MKT_ID})`, 'true');
  ev('S0 LIVE market v6-4: book empty after the clear (no depositor either side)', MKT_ID,
    '{x: (len (get-token-x-depositors (get-current-cycle))), y: (len (get-token-y-depositors (get-current-cycle)))}', '(tuple (x u0) (y u0))');
  ev('S0 LIVE router v5-5 targets market v6-4', ROUTER_ID, 'JING_MARKET', MKT_ID);
}

// Plan steps for a harness: clear, then the live checks.
export async function liveJingSetup({node, tip, updHex, mid, tx, ev}) {
  const {steps, planSid} = await planLiveBookClear(node, tip.height, updHex, mid);
  for (const s of steps) tx(s.label, s.sender, s.contract, s.fn, s.args, s.want);
  liveJingChecks(ev);
  return {clearSteps: steps.map(({label, sender, contract, fn, probe}) => ({label, sender, contract, fn, probe})), clearPlanSimulation: planSid};
}

// A real signed Lazer update newer than the fork clock. Keyless through the
// public faktory-dao route (PYTH_API_KEY is used when set).
const JING_SIM = process.env.JING_SIM || resolve(homedir(), 'projects/jing-contracts-v3/simulations');
export const {lazerFeedTimes} = await import(resolve(JING_SIM, '_lazer.js'));
export async function freshProofAfter(stamp) {
  if (!Number.isFinite(stamp)) throw new Error('Fork block timestamp missing');
  for (let i = 0; i < 30; i++) {
    const p = await fetchLazerUpdateAny();
    if ((await lazerFeedTimes(p.hex)).at > stamp) return p;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('No signed price newer than ' + stamp);
}
