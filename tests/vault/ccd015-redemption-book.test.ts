// @vitest-environment node

import { test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { initSimnet } from '@stacks/clarinet-sdk';
import { Cl, cvToString } from '@stacks/transactions';

const testDir = dirname(fileURLToPath(import.meta.url));
const bookManifest = resolve(testDir, '.build/Clarinet.toml');

if (process.env.RUN_CCD015_BOOK === '1') {
  test('ccd015 redemption book against the source-pinned Clarinet manifest', async () => {
    const sim = await initSimnet(bookManifest, true, { trackCoverage: true });
    const accounts = sim.getAccounts();
    const admin = accounts.get('deployer');
    const alice = accounts.get('wallet_1');
    const bob = accounts.get('wallet_2');
    const carol = accounts.get('wallet_3');
    const B = 'ccd015-redemption-book-mia-stx';
    const u = Cl.uint;
    const extension = Cl.contractPrincipal(admin, 'mock-book-extension');
    const cp = name => Cl.contractPrincipal(admin, name);
    const call = (fn, args = [], sender = alice) => sim.callPublicFn(B, fn, args, sender);
    const gov = (fn, args = []) => sim.callPublicFn('mock-book-extension', fn, args, admin);
    const maker = index => `mock-book-seller-${index}`;
    const read = (fn, args = []) => sim.callReadOnlyFn(B, fn, args, admin).result;
    const readContract = (contract, fn, args = []) => sim.callReadOnlyFn(contract, fn, args, admin).result;
    const ok = result => {
      assert.equal(result.result.type, 'ok', cvToString(result.result));
      return result.result.value;
    };
    const err = (result, code) => assert.equal(cvToString(result.result), `(err u${code})`);
    const eq = (actual, expected) => assert.equal(actual, expected);
    const parFor = amount => read('get-par-ustx', [u(amount)]).value;

    // Arrange the production book's exact DAO-extension identity and initial par.
    err(call('is-dao-or-extension', [], alice), 15000);
    ok(call('callback', [Cl.principal(alice), Cl.buffer(new Uint8Array())]));
    err(call('set-paused', [Cl.bool(true)]), 15000);
    err(call('set-min-deposit', [u(1)]), 15000);
    err(call('update-par', [], alice), 15000);
    ok(sim.callPublicFn('mock-base-dao', 'set-extension', [extension, Cl.bool(true)], admin));
    ok(gov('set-paused', [Cl.bool(false)]));
    err(gov('set-min-deposit', [u(0)]), 15001);
    ok(gov('set-min-deposit', [u(10)]));
    err(call('place-offer', [u(100), u(1)]), 15011);
    err(call('cross-book', [], alice), 15010);
    ok(sim.transferSTX(1n, `${admin}.${B}`, admin));
    err(call('cross-book', [], alice), 15011);
    ok(gov('update-par'));

    // Read-only API and offer validation paths.
    assert.ok(cvToString(read('get-info')).includes('(paused false)'));
    assert.ok(read('get-par-scaled').value > 0n);
    assert.ok(read('get-par-ustx-per-1m-mia').value > 0n);
    assert.ok(read('get-treasury-balance').value > 0n);
    assert.ok(read('get-mia-total-supply').value > 0n);
    assert.equal(read('calculate-par').type, 'some');
    eq(read('get-offer-count').value, 0n);
    eq(cvToString(read('get-offer-book')), '(list )');
    assert.ok(cvToString(read('get-book-totals')).includes('(amount u0)'));
    eq(cvToString(read('get-offer', [Cl.principal(alice)])), 'none');
    assert.equal(read('at-or-below-par?', [u(1000), u(1)]).type, 'true');
    assert.equal(read('at-or-below-par?', [u(1000), u(parFor(1000) + 1n)]).type, 'false');
    eq(read('get-par-ustx', [u(0)]).value, 0n);
    err(call('place-offer', [u(9), u(1)]), 15005);
    err(call('place-offer', [u(10_000_000_000_001n), u(1)]), 15001);
    err(call('place-offer', [u(100), u(0)]), 15001);
    err(call('place-offer', [u(100), u(1_000_000_000_000_001n)]), 15001);
    err(call('place-offer', [u(1000), u(parFor(1000) + 1n)]), 15008);

    // Sorted insertion, duplicate protection, updates with and without deposits.
    ok(call('place-offer', [u(1000), u(1)], alice));
    const oldPar = parFor(1000);
    ok(call('place-offer', [u(1000), u(oldPar * 3n / 4n)], bob));
    ok(call('place-offer', [u(1000), u(oldPar / 4n)], carol));
    eq(read('get-offer-count').value, 3n);
    const bookText = cvToString(read('get-offer-book'));
    assert.ok(bookText.indexOf(alice) < bookText.indexOf(carol));
    assert.ok(bookText.indexOf(carol) < bookText.indexOf(bob));
    assert.ok(cvToString(read('get-offer', [Cl.principal(bob)])).includes('(amount u1000)'));
    assert.ok(cvToString(read('get-book-totals')).includes('(amount u3000)'));
    err(call('place-offer', [u(1000), u(1)], alice), 15004);
    err(call('change-offer', [Cl.none(), u(1)], admin), 15002);
    err(call('cancel-offer', [], admin), 15002);
    ok(call('change-offer', [Cl.none(), u(oldPar / 2n)], alice));
    ok(call('change-offer', [Cl.some(u(50)), u(oldPar / 3n)], bob));
    ok(gov('set-min-deposit', [u(2000)]));
    err(call('change-offer', [Cl.none(), u(1)], alice), 15005);
    ok(gov('set-min-deposit', [u(10)]));
    err(call('change-offer', [Cl.none(), u(0)], bob), 15001);
    err(call('change-offer', [Cl.none(), u(1_000_000_000_000_001n)], bob), 15001);
    err(call('change-offer', [Cl.some(u(10_000_000_000_000n)), u(1)], bob), 15001);
    err(call('change-offer', [Cl.none(), u(parFor(1000) + 1n)], alice), 15008);
    ok(gov('set-paused', [Cl.bool(true)]));
    err(call('place-offer', [u(100), u(1)]), 15007);
    err(call('change-offer', [Cl.none(), u(1)]), 15007);
    err(call('cross-book', [], alice), 15007);
    ok(gov('set-paused', [Cl.bool(false)]));
    ok(call('cancel-offer', [], alice));

    // Refreshing par leaves stale high offers untouched; crossing skips them.
    ok(gov('update-par'));
    const currentPar = parFor(1000);
    ok(call('change-offer', [Cl.none(), u(currentPar / 2n)], carol));
    const carolAsk = currentPar / 2n;
    ok(sim.transferSTX(carolAsk + 1n, `${admin}.${B}`, admin));
    const beforeBurn = readContract('mock-mia', 'get-total-supply');
    const crossed = ok(call('cross-book', [], bob));
    assert.ok(cvToString(crossed).includes('acquired'));
    assert.ok(readContract('mock-mia', 'get-total-supply').value.value < beforeBurn.value.value);
    assert.ok(cvToString(read('get-offer', [Cl.principal(bob)])).includes('(amount u1050)'));

    // A one-unit budget cannot buy one unit at the current ask; the partial fill
    // path then pays from a smaller-than-ask budget and leaves the remainder.
    ok(call('change-offer', [Cl.none(), u(parFor(1050))], bob));
    ok(sim.transferSTX(1n, `${admin}.${B}`, admin));
    err(call('cross-book', [], alice), 15006);
    const partialBudget = parFor(1000) / 2n;
    ok(sim.transferSTX(partialBudget, `${admin}.${B}`, admin));
    ok(call('cross-book', [], alice));
    assert.ok(cvToString(read('get-offer', [Cl.principal(bob)])).includes('(amount'));
    assert.ok(read('get-book-totals').value.amount.value > 0n);

    // Fill the fixed-capacity book, reject an equal-or-worse newcomer, then
    // admit a strictly cheaper offer and refund the evicted owner's MIA.
    for (let index = 0; index < 49; index += 1) {
      ok(sim.callPublicFn(maker(index), 'place', [u(1000), u(1)], admin));
    }
    eq(read('get-offer-count').value, 50n);
    ok(sim.callPublicFn(maker(49), 'place', [u(2000), u(1)], admin));
    err(sim.callPublicFn(maker(50), 'place', [u(1000), u(2)], admin), 15003);
    eq(read('get-offer-count').value, 50n);
    ok(sim.callPublicFn(maker(0), 'cancel', [], admin));
    eq(read('get-offer-count').value, 49n);

    // Exercise the empty-backing and zero-snapshot guards without changing the
    // production formula or its dependencies.
    const wallet8 = accounts.get('wallet_8');
    const faucet = accounts.get('faucet');
    ok(sim.transferSTX(99_999_999_999_999n, admin, wallet8));
    ok(sim.transferSTX(99_999_999_999_999n, admin, faucet));
    ok(sim.transferSTX(1n, admin, wallet8));
    ok(sim.transferSTX(1n, admin, faucet));
    eq(read('get-treasury-balance').value, 0n);
    eq(read('calculate-par').type, 'none');
    err(gov('update-par'), 15012);
    ok(sim.transferSTX(1n, wallet8, admin));
    eq(read('calculate-par').value.value, 0n);
    err(gov('update-par'), 15012);

    const sourcePath = resolve(testDir, '../../contracts/extensions/ccd015-redemption-book-mia-stx.clar');
    const source = readFileSync(sourcePath, 'utf8');
    const sourceSha256 = createHash('sha256').update(source).digest('hex');
    const report = sim.collectReport(false, '');
    const record = report.coverage.split('end_of_record').find(entry =>
      entry.includes('/ccd015-redemption-book-mia-stx.clar'));
    assert.ok(record, 'book coverage record is present');
    const functions = new Map([...record.matchAll(/^FNDA:(\d+),(.+)$/gm)].map(match => [match[2], Number(match[1])]));
    const publicNames = [...source.matchAll(/^\(define-(?:public|read-only)\s+\(([a-zA-Z0-9!?-]+)/gm)]
      .map(match => match[1]);
    const missedPublic = publicNames.filter(name => !functions.has(name) || functions.get(name) === 0);
    assert.deepEqual(missedPublic, [], 'every public and read-only function has a hit');
    const lcov = record.replace(/^SF:.*$/m, 'SF:contracts/extensions/ccd015-redemption-book-mia-stx.clar') + 'end_of_record\n';
    const lineCounts = [...lcov.matchAll(/^DA:(\d+),(\d+)$/gm)].map(match => Number(match[2]));
    const lineTotal = lineCounts.length;
    const lineHits = lineCounts.filter(hits => hits > 0).length;
    const branchTotal = Number(lcov.match(/^BRF:(\d+)$/m)?.[1] ?? 0);
    const branchHits = Number(lcov.match(/^BRH:(\d+)$/m)?.[1] ?? 0);
    const functionTotal = Number(lcov.match(/^FNF:(\d+)$/m)?.[1] ?? 0);
    const functionHits = Number(lcov.match(/^FNH:(\d+)$/m)?.[1] ?? 0);
    assert.equal(branchHits, branchTotal, 'every book branch has a hit');
    assert.equal(functionHits, functionTotal, 'every instrumented book function has a hit');
    const results = resolve(testDir, 'results');
    mkdirSync(results, { recursive: true });
    writeFileSync(resolve(results, 'ccd015-book-runtime.lcov'), lcov);
    writeFileSync(resolve(results, 'ccd015-book-runtime.json'), JSON.stringify({
      sourceCommit: 'a9a6bd6', sourceSha256, status: 'passed',
      publicFunctions: publicNames.length, publicFunctionsHit: publicNames.length,
      lineHits, lineTotal, branchHits, branchTotal, functionHits, functionTotal,
      uncoveredBranches: [...lcov.matchAll(/^BRDA:(\d+),\d+,\d+,(?:0|-)$/gm)].map(match => Number(match[1])),
    }, null, 2) + '\n');
  });
} else {
  test.skip('set RUN_CCD015_BOOK=1 after building the source-pinned book manifest', () => {});
}
