import { test, expect } from 'vitest';
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl, cvToString } from '@stacks/transactions';
import { readFileSync } from 'node:fs';

const PROPOSAL = 'ccip028-activate-mia-fair-redemption';
const BOOK = 'ccd015-redemption-book-mia-stx';
const VAULT = 'ccd016-swap-vault-mia-v2';
const DIRECT = 'ccd001-direct-execute';
const BACKING = ['ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP', 'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6'];

function result(receipt: any) { return cvToString(receipt.result); }
function ok(receipt: any) { expect(result(receipt)).toMatch(/^\(ok /); return receipt.result.value; }

async function setup() {
  const sim = await initSimnet('tests/activation/.build/Clarinet.toml', true);
  const accounts = sim.getAccounts();
  const deployer = accounts.get('deployer')!;
  const approvers: string[] = [];
  for (let index = 1; index <= 5; index++) approvers.push(accounts.get(`wallet_${index}`)!);
  const stranger = accounts.get('wallet_6')!;
  function cp(name: string) { return Cl.contractPrincipal(deployer, name); }
  function call(name: string, fn: string, args: any[] = [], sender = stranger) {
    return sim.callPublicFn(name, fn, args, sender);
  }
  function read(name: string, fn: string, args: any[] = []) {
    return sim.callReadOnlyFn(name, fn, args, stranger).result;
  }
  function signal(sender: string, proposal = PROPOSAL) { return call(DIRECT, 'direct-execute', [cp(proposal)], sender); }
  function activate() { for (const who of approvers.slice(0, 3)) ok(signal(who)); }
  function stx(who: string) { return sim.getAssetsMap().get('STX')?.get(who) ?? 0n; }
  function ft(who: string) { return read('mock-ft', 'get-balance', [Cl.principal(who)]).value.value; }
  function extension(name: string) { return cvToString(read('base-dao', 'is-extension', [cp(name)])); }
  ok(call('bootstrap', 'configure', [Cl.list(approvers.map(function principal(who) { return Cl.principal(who); }))], deployer));
  ok(call('base-dao', 'construct', [cp('bootstrap')], deployer));
  return { sim, deployer, approvers, stranger, cp, call, read, signal, activate, stx, ft, extension };
}

test('strangers, deployer and approvers cannot invoke activation directly or through a proxy', async function () {
  const w = await setup();
  for (const who of [w.stranger, w.deployer, w.approvers[0]]) {
    expect(result(w.call(PROPOSAL, 'execute', [Cl.principal(w.approvers[0])], who))).toBe('(err u28000)');
    expect(result(w.call('forwarder', 'run', [Cl.principal(who)], who))).toBe('(err u28000)');
    expect(result(w.call('base-dao', 'execute', [w.cp(PROPOSAL), Cl.principal(who)], who))).toBe('(err u900)');
  }
  expect(result(w.signal(w.stranger))).toBe('(err u1001)');
  expect(w.extension(VAULT)).toBe('false');
  expect(cvToString(w.read(BOOK, 'get-par-scaled'))).toBe('u0');
});

test('three distinct approvers activate without a vote; duplicates do not count; no funds move', async function () {
  const w = await setup();
  const treasury = `${w.deployer}.mock-treasury`;
  ok(w.call('mock-ft', 'mint', [Cl.uint(123456), w.cp('mock-treasury')]));
  const backing = w.read(BOOK, 'get-treasury-balance');
  const par = w.read(BOOK, 'calculate-par').value;
  expect(result(w.signal(w.approvers[0]))).toBe('(ok u1)');
  expect(result(w.signal(w.approvers[0]))).toBe('(ok u1)');
  expect(result(w.signal(w.approvers[1]))).toBe('(ok u2)');
  expect(w.extension(VAULT)).toBe('false');
  expect(cvToString(w.read(BOOK, 'get-par-scaled'))).toBe('u0');
  expect(result(w.signal(w.approvers[2]))).toBe('(ok u3)');
  expect(w.extension(VAULT)).toBe('true');
  expect(w.extension(BOOK)).toBe('false');
  expect(w.extension(PROPOSAL)).toBe('false');
  expect(w.read(BOOK, 'get-par-scaled')).toEqual(par);
  expect(w.read(BOOK, 'get-treasury-balance')).toEqual(backing);
  expect(cvToString(w.read('mock-treasury', 'is-allowed', [w.cp('mock-ft')]))).toBe('true');
  expect(w.ft(treasury)).toBe(123456n);
  expect(w.ft(`${w.deployer}.${VAULT}`)).toBe(0n);
  expect(w.read(VAULT, 'get-clock').value['batch-start']).toEqual(Cl.none());
  const config = w.read(VAULT, 'get-config').value;
  const expected = { 'window-blocks': 288, 'leeway-bps': 1000, 'slippage-bps': 100,
    'max-chunk-sats': 1000000, 'maker-spread-bps': 1, 'dia-band-bps': 1000,
    'router-cooldown-blocks': 1, 'no-pyth-slippage-bps': 1000, 'pyth-fee-budget': 0 };
  for (const [name, amount] of Object.entries(expected)) expect(config[name]).toEqual(Cl.uint(amount));
  expect(cvToString(w.read(DIRECT, 'get-signals-required'))).toBe('u3');
});

test('activation works with an empty rewards treasury and cannot execute twice', async function () {
  const w = await setup();
  w.activate();
  expect(result(w.signal(w.approvers[3]))).toBe('(err u901)');
  expect(cvToString(w.read(DIRECT, 'get-signals', [w.cp(PROPOSAL)]))).toBe('u3');
  expect(result(w.call(VAULT, 'fund-from-treasury'))).toBe('(err u16010)');
});

test('a separately deployed copy cannot reinitialize an already active book', async function () {
  const w = await setup();
  w.activate();
  const snapshot = w.read(BOOK, 'get-par-scaled');
  const source = readFileSync(`tests/activation/.build/contracts/${PROPOSAL}.clar`, 'utf8');
  expect(result(w.sim.deployContract('activation-copy', source, { clarityVersion: 6 }, w.deployer))).toBe('true');
  ok(w.signal(w.approvers[0], 'activation-copy'));
  ok(w.signal(w.approvers[1], 'activation-copy'));
  expect(result(w.signal(w.approvers[2], 'activation-copy'))).toBe('(err u28001)');
  expect(w.read(BOOK, 'get-par-scaled')).toEqual(snapshot);
});

test('the existing Direct Execute sunset still prevents activation', async function () {
  const w = await setup();
  ok(w.signal(w.approvers[0]));
  ok(w.signal(w.approvers[1]));
  w.sim.mineEmptyBurnBlocks(1001);
  expect(result(w.signal(w.approvers[2]))).toBe('(err u1002)');
  expect(w.extension(VAULT)).toBe('false');
});

test('failed par initialization rolls back extension, allowlist, proposal execution and final signal', async function () {
  const w = await setup();
  const saved: bigint[] = [];
  for (const who of BACKING) {
    const balance = w.stx(who); saved.push(balance);
    if (balance > 0n) ok(w.sim.transferSTX(balance, w.deployer, who));
  }
  expect(cvToString(w.read(BOOK, 'calculate-par'))).toBe('none');
  ok(w.signal(w.approvers[0])); ok(w.signal(w.approvers[1]));
  expect(result(w.signal(w.approvers[2]))).toBe('(err u15012)');
  expect(w.extension(VAULT)).toBe('false');
  expect(cvToString(w.read('mock-treasury', 'is-allowed', [w.cp('mock-ft')]))).toBe('false');
  expect(cvToString(w.read('base-dao', 'executed-at', [w.cp(PROPOSAL)]))).toBe('none');
  expect(cvToString(w.read(DIRECT, 'get-signals', [w.cp(PROPOSAL)]))).toBe('u2');
  expect(cvToString(w.read(DIRECT, 'has-signalled', [w.cp(PROPOSAL), Cl.principal(w.approvers[2])]))).toBe('false');
  for (let i = 0; i < BACKING.length; i++) if (saved[i] > 0n) ok(w.sim.transferSTX(saved[i], BACKING[i], w.deployer));
  expect(result(w.signal(w.approvers[2]))).toBe('(ok u3)');
});

test('treasury withdrawals and governance settings remain inaccessible to ordinary callers', async function () {
  const w = await setup();
  ok(w.call('mock-ft', 'mint', [Cl.uint(100000), w.cp('mock-treasury')]));
  expect(result(w.call(VAULT, 'fund-from-treasury'))).toBe('(err u2000)');
  w.activate();
  expect(result(w.call('mock-treasury', 'withdraw-ft', [w.cp('mock-ft'), Cl.uint(1), Cl.principal(w.stranger)]))).toBe('(err u2000)');
  expect(result(w.call(BOOK, 'update-par'))).toBe('(err u15000)');
  expect(result(w.call(VAULT, 'set-pyth-fee-budget', [Cl.uint(1)]))).toBe('(err u16000)');
  expect(result(w.call(VAULT, 'dao-recall-sbtc'))).toBe('(err u16000)');
  ok(w.call(VAULT, 'fund-from-treasury'));
  expect(w.ft(`${w.deployer}.${VAULT}`)).toBe(100000n);
});

test('permissionless funding, maker placement, expired-window swap, book funding and MIA burn', async function () {
  const w = await setup();
  const mia = 100000000000n;
  ok(w.call('mock-mia', 'mint', [Cl.uint(mia), Cl.principal(w.stranger)]));
  w.activate();
  ok(w.call(BOOK, 'place-offer', [Cl.uint(mia), Cl.uint(100000000)]));
  ok(w.call('mock-ft', 'mint', [Cl.uint(100000), w.cp('mock-treasury')]));
  ok(w.sim.transferSTX(1000000000n, `${w.deployer}.mock-router`, w.deployer));
  ok(w.call(VAULT, 'fund-from-treasury'));
  const update = Cl.buffer(new Uint8Array());
  ok(w.call(VAULT, 'jing-place', [update]));
  expect(result(w.call(VAULT, 'router-swap', [update]))).toBe('(err u16031)');
  w.sim.mineEmptyBurnBlocks(289);
  ok(w.call(VAULT, 'jing-reclaim', [Cl.some(update)]));
  ok(w.call(VAULT, 'router-swap', [update]));
  const proceeds = w.stx(`${w.deployer}.${VAULT}`);
  expect(proceeds).toBeGreaterThanOrEqual(100000000n);
  ok(w.call(VAULT, 'fuel-fair-book'));
  expect(w.stx(`${w.deployer}.${BOOK}`)).toBe(proceeds);
  const before = w.stx(w.stranger);
  ok(w.call(BOOK, 'cross-book'));
  expect(w.stx(w.stranger) - before).toBe(100000000n);
  expect(w.read('mock-mia', 'get-burned')).toEqual(Cl.uint(mia));
  expect(w.ft(`${w.deployer}.${VAULT}`)).toBe(0n);
  expect(w.stx(`${w.deployer}.${VAULT}`)).toBe(0n);
});
