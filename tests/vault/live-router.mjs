// Final vault -> deployed v5-5 router -> finite AMM fixture balances.
import {execFileSync} from 'node:child_process';
import {initSimnet} from '@stacks/clarinet-sdk';
import {Cl,cvToString} from '@stacks/transactions';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
execFileSync('python3',['tests/vault/build-live-router.py'],{stdio:'inherit'});
const sim=await initSimnet('tests/vault/.build-live-router/Clarinet.toml',true);
const a=sim.getAccounts(),admin=a.get('deployer'),user=a.get('wallet_1');
const V='ccd016-swap-vault-mia-v2',R='mock-router',B='ccd015-redemption-book-mia-stx';
const p=n=>Cl.contractPrincipal(admin,n),id=n=>`${admin}.${n}`,u=Cl.uint;
const update=Cl.buffer(new Uint8Array(72));
let checks=0;
function call(n,f,args=[],sender=admin){return sim.callPublicFn(n,f,args,sender);}
function read(n,f,args=[]){return sim.callReadOnlyFn(n,f,args,admin).result;}
function ok(r){checks++;assert.equal(r.result.type,'ok',cvToString(r.result));return r.result.value;}
function eq(x,y){checks++;assert.equal(x,y);}
function sats(n){return read('mock-ft','get-balance',[p(n)]).value.value;}
function stx(n){return sim.getAssetsMap().get('STX').get(id(n))||0n;}
ok(call('mock-base-dao','set-extension',[Cl.principal(admin),Cl.bool(true)]));
ok(call(V,'set-window-blocks',[u(0)]));ok(call(V,'set-router-cooldown',[u(0)]));
for(const n of ['dlmm','dlmm-2','dlmm-3','xyk','velar']){
 ok(sim.transferSTX(3200000000000n,id(n),admin));
 ok(call('mock-ft','mint',[u(1000000000),p(n)]));
 ok(call(n,'configure',[u(1000000000),u(3200000000000n),Cl.bool(false),u(0),u(0)]));
 ok(call(n,'configure-dlmm',[Cl.int(0),u(31250),u(15),u(100000000)]));
}
// Both smart and explicit-split paths execute the full v5-5 source.
for(const fn of ['router-swap','router-swap-split','router-swap-split-dia']){
 ok(call('mock-ft','mint',[u(100000),p('mock-treasury')]));ok(call(V,'fund-from-treasury',[],user));
 const before=stx(V),beforeSats=sats(V);
 const args=fn==='router-swap'?[update]:fn==='router-swap-split'?[u(100000),u(0),u(40000),u(30000),u(30000),update]:[u(100000),u(40000),u(30000),u(30000)];
 const r=ok(call(V,fn,args,fn==='router-swap'?user:admin));
 const sold=beforeSats-sats(V),out=stx(V)-before;
 checks++;assert.ok(sold>0n&&out>0n);
 // Smart routing permits its documented 8-sat sizing dust; manual splits do not.
 const tolerance=fn==='router-swap'?8n:0n;
 checks++;assert.ok(out>=(sold-tolerance)*31680000000000n/10000000000n);
 eq(sats(R),0n);eq(stx(R),0n);
 if(sats(V)>0n)ok(call(V,'dao-recall-sbtc'));
 const b=stx(B),v=stx(V);ok(call(V,'fuel-fair-book',[],user));eq(stx(B)-b,v);eq(stx(V),0n);
}
// Exercise the actual router's age-aware Jing capacity path, not only its AMM legs.
const bidder=a.get('wallet_2');
ok(call('v6-market','deposit-token-y',[u(500000000),u(32000000000000n),Cl.none(),p('mock-ft'),Cl.stringAscii('mock-ft')],bidder));
const cycle=read('v6-market','get-current-cycle');
const bidBefore=read('v6-market','get-token-y-deposit',[cycle,Cl.principal(bidder)]).value;
ok(call('mock-ft','mint',[u(100000),p('mock-treasury')]));ok(call(V,'fund-from-treasury',[],user));
ok(call(V,'router-swap',[update],user));
const bidAfter=read('v6-market','get-token-y-deposit',[cycle,Cl.principal(bidder)]).value;
checks++;assert.ok(bidAfter<bidBefore,'full v5-5 router must consume the real v6-4 book bid');
eq(sats(R),0n);eq(stx(R),0n);
const summary={status:'passed',checks,sourceHashes:JSON.parse(readFileSync('tests/vault/.build-live-router/source-hashes.json')),scope:'Full deployed v6-4/v5-5 code, local funded AMM/token/oracle fixtures; no router business-logic rewrites.'};
writeFileSync('tests/vault/results/live-router.json',JSON.stringify(summary,null,2)+'\n');
console.log('Deployed-router integration:',checks,'assertions passed');
