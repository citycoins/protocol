import {initSimnet,tx} from '@stacks/clarinet-sdk';
import {Cl,cvToString} from '@stacks/transactions';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const sim=await initSimnet(dir+'.build/Clarinet.toml',true,{trackCoverage:true});
const accounts=sim.getAccounts(),admin=accounts.get('deployer'),alice=accounts.get('wallet_1'),bob=accounts.get('wallet_2');
const V='ccd016-swap-vault-mia-v2',B='ccd015-redemption-book-mia-stx',u=Cl.uint,update=Cl.buffer(new Uint8Array()),p=n=>`${admin}.${n}`,cp=n=>Cl.contractPrincipal(admin,n);
let checks=0;const call=(n,f,a=[],sender=alice)=>sim.callPublicFn(n,f,a,sender);
const read=(n,f,a=[])=>sim.callReadOnlyFn(n,f,a,admin).result;
const ok=r=>{checks++;assert.equal(r.result.type,'ok',cvToString(r.result));return r.result.value};
const err=(r,c)=>{checks++;assert.equal(cvToString(r.result),`(err u${c})`)};
const eq=(a,b)=>{checks++;assert.equal(a,b)};
const ft=w=>read('mock-ft','get-balance',[Cl.principal(w)]).value.value;
const stx=w=>sim.getAssetsMap().get('STX').get(w)||0n;
const config=()=>cvToString(read(V,'get-config'));
const clock=()=>read(V,'get-clock').value;
const quote=()=>read(V,'get-no-pyth-price');
const vault=(f,a=[],sender=alice)=>call(V,f,a,sender);
const gov=(f,a=[])=>vault(f,a,admin);
const fund=amount=>{ok(call('mock-ft','mint',[u(amount),cp('mock-treasury')]));return ok(vault('fund-from-treasury'))};
const resetWorld=()=>{for(const f of ['set-stale','set-failed','set-zero-stx'])ok(call('mock-dia',f,[Cl.bool(false)]));ok(call('mock-dia','set-age',[u(0)]));ok(call('mock-dia','set-skew',[u(10000)]));ok(call('mock-dia','set-stx-usd',[u(100000000)]));ok(call('mock-native','set-failed',[Cl.bool(false)]));ok(call('mock-native','set-mid',[u(32000000000000)]));ok(call('mock-lazer-oracle','set-mid',[u(32000000000000)]));};
const drain=()=>{if(ft(p(V))>0n)ok(gov('dao-recall-sbtc'));if(stx(p(V))>0n)ok(vault('fuel-fair-book'));};
const flushTreasury=()=>{if(ft(p('mock-treasury'))>0n){ok(vault('fund-from-treasury'));ok(vault('router-swap',[update]));}};
// Original DAO gate retained: strangers fail, the precise extension principal succeeds.
err(vault('is-dao-or-extension'),16000);
ok(call('mock-base-dao','set-extension',[Cl.principal(admin),Cl.bool(true)],admin));
eq(ok(gov('is-dao-or-extension')).type,'true');
ok(vault('callback',[Cl.principal(alice),update]));
for(const [f,max,value,positive] of [['set-window-blocks',1008,288,false],['set-leeway-bps',1000,500,false],['set-slippage-bps',1000,100,false],['set-dia-band-bps',5000,1000,false],['set-max-chunk-sats',100000000,1000000,true],['set-router-cooldown',144,1,false],['set-no-pyth-slippage-bps',5000,1000,false],['set-pyth-fee-budget',10000000,0,false],['set-maker-spread-bps',50,1,false]]){
 err(vault(f,[u(value)]),16000);err(gov(f,[u(max+1)]),16033);
 if(positive)err(gov(f,[u(0)]),16033);else ok(gov(f,[u(0)]));
 ok(gov(f,[u(max)]));ok(gov(f,[u(value)]));
}
eq(clock()['window-open'].type,'false');eq(clock()['window-elapsed'].type,'false');eq(clock()['window-ends'].type,'none');
err(vault('close-batch'),16032);err(vault('fund-from-treasury'),16010);err(vault('fuel-fair-book'),16006);err(gov('dao-recall-sbtc'),16006);
err(vault('jing-place',[update]),16030);err(vault('jing-reclaim',[Cl.some(update)]),16031);err(gov('jing-take',[u(1),update]),16031);
err(vault('jing-refloor',[update]),16000);err(gov('jing-refloor',[update]),16034);err(vault('jing-take',[u(1),update]),16000);
err(vault('router-swap-split',[u(1),u(0),u(1),u(0),u(0),update]),16000);
err(vault('router-swap-split-dia',[u(1),u(1),u(0),u(0)]),16000);
resetWorld();ok(sim.transferSTX(100000000000n,p('mock-router'),admin));
// Direct donations do not start the clock; first treasury funding does.
ok(call('mock-ft','mint',[u(1000),cp(V)]));eq(clock()['batch-start'].type,'none');fund(100000);
eq(clock()['window-open'].type,'true');eq(clock()['window-ends'].type,'some');const initialStart=clock()['batch-start'].value.value;
fund(1000);eq(clock()['batch-start'].value.value,initialStart);
err(vault('close-batch'),16043);err(vault('router-swap',[update]),16031);err(gov('router-swap-split',[u(1),u(0),u(1),u(0),u(0),update]),16031);err(gov('router-swap-split-dia',[u(1),u(1),u(0),u(0)]),16031);
ok(vault('jing-place',[update]));err(vault('jing-place',[update]),16006);
err(vault('jing-reclaim',[Cl.some(update)]),16031);ok(gov('jing-refloor',[update]));
const order=read('v6-market','get-token-x-order',[cp(V)]).value;eq(order['spread-bps'].value.value,1n);
// The ask rests at mid + maker-spread-bps (default 1 bp, never spread 0); refloor applies the current value.
const spread=()=>read('v6-market','get-token-x-order',[cp(V)]).value['spread-bps'].value.value;
ok(gov('set-maker-spread-bps',[u(7)]));ok(gov('jing-refloor',[update]));eq(spread(),7n);eq(config().includes('(maker-spread-bps u7)'),true);
ok(gov('set-maker-spread-bps',[u(1)]));ok(gov('jing-refloor',[update]));eq(spread(),1n);
// DAO can change the window during a batch: zero immediately elapses it.
ok(gov('set-window-blocks',[u(0)]));eq(clock()['window-elapsed'].type,'true');ok(gov('jing-refloor',[update]));
ok(vault('jing-reclaim',[Cl.some(update)]));ok(vault('jing-reclaim',[Cl.some(update)]));ok(gov('dao-reclaim',[Cl.none()]));
err(gov('router-swap-split',[u(2),u(0),u(1),u(0),u(0),update]),16040);
err(gov('router-swap-split',[u(1000001),u(0),u(1000001),u(0),u(0),update]),16039);
err(gov('router-swap-split',[u(0),u(0),u(0),u(0),u(0),update]),16006);
// DIA cross-check accepts endpoints, rejects divergence and stale feeds.
for(const [skew,want] of [[13000,16037],[8000,16037]]){ok(call('mock-dia','set-skew',[u(skew)]));err(vault('router-swap',[update]),want);}
ok(call('mock-dia','set-skew',[u(10000)]));ok(call('mock-dia','set-stale',[Cl.bool(true)]));err(vault('router-swap',[update]),16036);
ok(gov('set-dia-band-bps',[u(0)]));ok(vault('router-swap',[update]));ok(gov('set-dia-band-bps',[u(1000)]));resetWorld();
ok(call('v6-market','test-zero-price',[Cl.bool(true)]));err(vault('router-swap',[update]),16013);ok(call('v6-market','test-zero-price',[Cl.bool(false)]));
// Cooldown is shared between required-Pyth and emergency paths in one burn block.
ok(call('mock-ft','mint',[u(1000),cp('mock-treasury')]));fund(1000);
sim.mineEmptyBurnBlock();
const batch=sim.mineBlock([tx.callPublicFn(V,'router-swap-split',[u(1000),u(0),u(400),u(300),u(300),update],admin),tx.callPublicFn(V,'router-swap-split-dia',[u(1000),u(1000),u(0),u(0)],admin)]);
ok(batch[0]);err(batch[1],16044);sim.mineEmptyBurnBlock();ok(gov('set-router-cooldown',[u(0)]));
// Quote/floor calculations, exact two-hour boundary and all response fallbacks.
eq(quote().value.value.limit.value,28800000000000n);
ok(call('mock-dia','set-age',[u(7200)]));eq(quote().value.value.source.value,'dia');
ok(call('mock-dia','set-age',[u(7201)]));eq(quote().value.value.source.value,'native');eq(quote().value.value['dia-error'].value.value,16036n);eq(quote().value.value.limit.value,16000000000000n);
ok(call('mock-dia','set-age',[u(0)]));ok(call('mock-dia','set-zero-stx',[Cl.bool(true)]));eq(quote().value.value['dia-error'].value.value,16013n);
ok(call('mock-native','set-failed',[Cl.bool(true)]));err({result:quote()},900);
ok(call('mock-native','set-failed',[Cl.bool(false)]));ok(call('mock-native','set-mid',[u(0)]));err({result:quote()},16013);
ok(call('mock-native','set-mid',[u(1)]));err({result:quote()},16013);
resetWorld();ok(call('mock-dia','set-failed',[Cl.bool(true)]));eq(quote().value.value['dia-error'].value.value,16035n);
let before=ft(p(V)),beforeSTX=stx(p(V));const native=ok(gov('router-swap-split-dia',[u(1000),u(400),u(300),u(300)]));
eq(native.value.payload.value['price-source'].value,'native');eq(ft(p(V)),before-1000n);eq(stx(p(V)),beforeSTX+3200000n);
resetWorld();
// A valid but tiny cross ratio, then a nonzero mid whose tolerance floor rounds to zero.
ok(call('mock-lazer-oracle','set-mid',[u(1)]));ok(call('mock-dia','set-stx-usd',[u(100000000000000000n)]));err({result:read(V,'get-dia-price')},16013);
ok(call('mock-dia','set-stx-usd',[u(100000000)]));err({result:quote()},16013);resetWorld();
ok(call('mock-ft','mint',[u(1),cp('mock-treasury')]));fund(1);
for(const [a,c] of [[[u(2),u(1),u(0),u(0)],16040],[[u(1000001),u(1000001),u(0),u(0)],16039],[[u(0),u(0),u(0),u(0)],16006],[[u(999999),u(999999),u(0),u(0)],16006]])err(gov('router-swap-split-dia',a),c);
// Price, min-out and transfer failures revert balances, clock and cooldown atomically.
ok(call('mock-ft','mint',[u(1000),cp('mock-treasury')]));fund(1000);
before=ft(p(V));beforeSTX=stx(p(V));const beforeConfig=config(),beforeClock=cvToString(read(V,'get-clock'));
ok(call('mock-dia','set-skew',[u(13000)]));err(gov('router-swap-split-dia',[u(1000),u(1000),u(0),u(0)]),3002);
eq(ft(p(V)),before);eq(stx(p(V)),beforeSTX);eq(config(),beforeConfig);eq(cvToString(read(V,'get-clock')),beforeClock);resetWorld();
ok(call('mock-ft','set-blocked-recipient',[Cl.some(cp('mock-router'))]));err(gov('router-swap-split-dia',[u(1000),u(1000),u(0),u(0)]),402);eq(ft(p(V)),before);eq(config(),beforeConfig);ok(call('mock-ft','set-blocked-recipient',[Cl.none()]));
ok(call('mock-dia','set-failed',[Cl.bool(true)]));ok(call('mock-native','set-failed',[Cl.bool(true)]));err(gov('router-swap-split-dia',[u(1000),u(1000),u(0),u(0)]),900);eq(config(),beforeConfig);resetWorld();
ok(gov('router-swap-split-dia',[u(before),u(before),u(0),u(0)]));eq(read(V,'is-empty').type,'true');eq(clock()['batch-start'].type,'none');
const bookBefore=stx(p(B)),proceeds=stx(p(V));ok(vault('fuel-fair-book'));eq(stx(p(B)),bookBefore+proceeds);eq(stx(p(V)),0n);
// DAO recall / reclaim in the patience phase, parked funds and a remaining live STX balance.
ok(gov('set-window-blocks',[u(288)]));fund(10000);ok(vault('jing-place',[update]));ok(gov('dao-reclaim',[Cl.none()]));err(vault('dao-reclaim',[Cl.none()]),16000);
err(vault('dao-recall-sbtc'),16000);ok(sim.transferSTX(1000000n,p(V),admin));ok(gov('dao-recall-sbtc'));eq(clock()['batch-start'].type,'none');ok(vault('fuel-fair-book'));
fund(10000);const parkedAmount=ft(p(V));ok(vault('jing-place',[update]));ok(call('v6-market','test-park',[cp(V)]));eq(read(V,'get-status').value['jing-parked'].value,parkedAmount);ok(gov('dao-reclaim',[Cl.none()]));drain();
// Maker sells out the batch externally: the public close-batch clears the leftover clock.
fund(10000);ok(vault('jing-place',[update]));ok(call('v6-market','set-min-token-y-deposit',[u(1000000)],admin));ok(call('mock-ft','mint',[u(1000000),Cl.principal(alice)]));ok(call('v6-market','deposit-token-x',[u(1000000),u(32320000000000),Cl.none(),cp('mock-ft'),Cl.stringAscii('mock-ft')],alice));ok(call('v6-market','swap',[u(100000000),u(999999999999999n),update,cp('mock-ft'),Cl.stringAscii('mock-ft'),cp('mock-ft'),Cl.stringAscii('mock-ft'),Cl.bool(false)],bob));
eq(read(V,'is-empty').type,'true');ok(vault('close-batch'));drain();
// Owner take from a resting maker bid, with zero patience.
ok(gov('set-window-blocks',[u(0)]));fund(1000);const takeAmount=ft(p(V));
ok(call('v6-market','deposit-token-y',[u(500000000),u(32000000000000),Cl.none(),update,cp('mock-ft'),Cl.stringAscii('mock-ft')],bob));
ok(gov('jing-take',[u(takeAmount),update]));eq(ft(p(V)),0n);eq(clock()['batch-start'].type,'none');drain();
// Funding an empty vault with a clock reopens it; exact patience boundary is inclusive.
ok(gov('set-window-blocks',[u(2)]));fund(1000);sim.mineEmptyBurnBlocks(2);eq(clock()['window-elapsed'].type,'true');drain();
// A sub-dust Jing order is canceled home and lets anyone clear the stale clock.
ok(call('v6-market','cancel-token-y-deposit',[cp('mock-ft'),Cl.stringAscii('mock-ft')],bob));ok(gov('set-window-blocks',[u(0)]));flushTreasury();
ok(call('v6-market','set-min-token-x-deposit',[u(1)],admin));ok(gov('set-window-blocks',[u(2)]));fund(1);
ok(vault('jing-place',[update]));eq(read('v6-market','get-token-x-deposit',[read('v6-market','get-current-cycle'),Cl.principal(p(V))]).value,1n);
ok(vault('close-batch'));eq(read(V,'is-empty').type,'true');eq(clock()['batch-start'].type,'none');
// A fresh treasury pull must not restart an elapsed batch with more than router dust resting.
fund(10);ok(vault('jing-place',[update]));const dustBatchStart=clock()['batch-start'].value.value;
sim.mineEmptyBurnBlocks(2);eq(clock()['window-elapsed'].type,'true');fund(1);
eq(clock()['batch-start'].value.value,dustBatchStart);eq(clock()['window-elapsed'].type,'true');
ok(gov('dao-reclaim',[Cl.none()]));ok(gov('dao-recall-sbtc'));eq(clock()['batch-start'].type,'none');
// When the vault is above max-chunk, jing-take honors the requested slice.
ok(gov('set-max-chunk-sats',[u(1000000)]));ok(gov('set-window-blocks',[u(0)]));flushTreasury();fund(1000001);
ok(call('v6-market','deposit-token-y',[u(500000000),u(32000000000000),Cl.none(),update,cp('mock-ft'),Cl.stringAscii('mock-ft')],bob));
ok(gov('jing-take',[u(10000),update]));eq(ft(p(V)),990001n);ok(call('v6-market','cancel-token-y-deposit',[cp('mock-ft'),Cl.stringAscii('mock-ft')],bob));ok(gov('dao-recall-sbtc'));flushTreasury();
// Permissionless routing uses one full chunk; the fixture router deliberately has too little STX
// to fill this 1-BTC slice, so the vault rejects the unsold result below its floor.
ok(gov('set-max-chunk-sats',[u(100000000)]));fund(100000001);err(vault('router-swap',[update]),16047);
ok(gov('dao-recall-sbtc'));ok(gov('set-max-chunk-sats',[u(1000000)]));
const output=dir+'results/';mkdirSync(output,{recursive:true});const report=sim.collectReport(false,'');
const record=report.coverage.split('end_of_record').find(r=>r.includes('/'+V+'.clar'));assert.ok(record);
const lcov=record.replace(/^SF:.*$/m,'SF:contracts/extensions/'+V+'.clar')+'end_of_record\n';writeFileSync(output+'runtime.lcov',lcov);
const branches=[...lcov.matchAll(/^BRDA:(\d+),(\d+),(\d+),([^\n]+)$/gm)].map(m=>({line:+m[1],block:+m[2],arm:+m[3],hits:m[4]}));
const lines=[...lcov.matchAll(/^DA:(\d+),(\d+)$/gm)].map(m=>({line:+m[1],hits:+m[2]}));
const sourceHashes=JSON.parse(readFileSync(dir+'.build/source-hashes.json'));
assert.ok(lcov.match(/^BRF:(\d+)$/m)&&lcov.match(/^BRH:(\d+)$/m),'vault branch coverage counters missing');
const summary={sourceHashes,checks,status:'passed',branchTotal:+lcov.match(/^BRF:(\d+)$/m)[1],branchHits:+lcov.match(/^BRH:(\d+)$/m)[1],uncoveredBranches:branches.filter(b=>b.hits==='-'||b.hits==='0'),lineTotal:lines.length,lineHits:lines.filter(l=>l.hits>0).length,zeroHitLines:lines.filter(l=>!l.hits).map(l=>l.line),scope:'Current full vault/book source; dependency addresses and asset names rebound to declared fixtures. DAO equality and extension gates retained.'};
writeFileSync(output+'runtime.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
