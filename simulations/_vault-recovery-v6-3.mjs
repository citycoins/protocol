// Recovery matrix against exact current source. No market/vault code patches.
// PoX earned-reward records and elapsed vault clocks are explicit fork fixtures.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {stacks,stxer,appendJingStack,fetchLazerUpdateAny,lazerFeedTimes,DEP,MARKET,CORE,LADDER,SBTC,WSTX,FORK_BLOCK} from './_jing-v6-3.mjs';
const {Cl,ClarityVersion,cvToString,deserializeCV,makeUnsignedContractDeploy,PostConditionMode,getAddressFromPrivateKey}=stacks;
const {SimulationBuilder,getSimulationResult,submitSimulationSteps,callContract,getNonce,setSender}=stxer;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const NODE=process.env.STACKS_API_URL||'http://77.42.3.101/stacks-api';
const POX='SP000000000000000000002Q6VF78.pox-5',DAO='SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH';
const TREASURY=DAO+'.ccd002-treasury-mia-rewards-v3',PROXY=DEP+'.sim-recovery-proposal';
const WHALE='SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2',STX_WHALE='SP9BP4PN74CNR5XT7CMAMBPA0GWC9HMB69HVVV51';
const stranger=getAddressFromPrivateKey('6'.repeat(64)+'01','mainnet'),cp=id=>Cl.principal(id),u=Cl.uint;
const ok=s=>s.startsWith('(ok'),uint=s=>BigInt(s.slice(1)),FUND=100000n;
const decode=r=>r.Eval?.Ok?cvToString(deserializeCV(r.Eval.Ok)):r.Transaction?.Ok&&!r.Transaction.Ok.vm_error&&!r.Transaction.Ok.post_condition_aborted?cvToString(deserializeCV(r.Transaction.Ok.result)):`ENGINE ${JSON.stringify(r)}`;
export async function runRecoveryMatrix(kind) {
 const city=kind==='citycoins',juice=kind==='juice';
 const name=city?'ccd016-swap-vault-mia-v2':juice?'juice-pool-swap-vault':'fastpool-swap-vault';
 const vault=DEP+'.'+name,pool=city?TREASURY:DEP+'.'+(juice?'juice-pool-stx-signer-stx-rewards':'signer-manager-vault-stx-rewards');
 const vaultPath=resolve(root,city?'contracts/extensions/'+name+'.clar':juice?'contracts/pox-5/'+name+'.clar':'contracts/'+name+'.clar');
 const poolPath=city?null:resolve(root,juice?'contracts/pox-5/juice-pool-stx-signer-stx-rewards.clar':'contracts/signer-manager-vault-stx-rewards.clar');
 const reports=[],checks=[];let sid,caseName,step=0,sourceHashes={};
 const resultDir=resolve(root,'simulations/results/v6-3-recovery');mkdirSync(resultDir,{recursive:true});
 function save(){writeFileSync(resolve(resultDir,kind+'.json'),JSON.stringify({kind,forkBlock:FORK_BLOCK??null,reports,checks,passed:checks.filter(c=>c.passed).length,total:checks.length,fixtures:['PoX earned reward/share fixtures backed by real fork token transfers; lock admission not exercised','Vault batch-start and fastpool settlement deadline aged by explicit Eval to keep native and Lazer pricing on real fork data','CityCoins DAO Extensions map grants only the actual vault and a sender-guarded test proposal extension','Public ladder reservation set to 49 to reach parking with one incumbent; public replacement, no market map writes'],sourceHashes},null,2)+'\n');}
 function check(label,actual,want){const passed=typeof want==='function'?want(actual):actual===want;checks.push({label:caseName+': '+label,actual:String(actual),expected:typeof want==='function'?String(want):String(want),passed,sid,step});console.log(`${passed?'ok':'FAIL'} ${checks.length}. ${caseName}: ${label}: ${String(actual).slice(0,360)}`);if(!passed){save();console.log(`${checks.filter(c=>c.passed).length}/${checks.length} checks green`);throw Error(`STOP ${label}: ${actual}; expected ${want}; https://stxer.xyz/simulations/mainnet/${sid}`);} }
 async function ev(label,id,code,want){const r=await submitSimulationSteps(sid,{steps:[{Eval:[DEP,'',id,code]}]});step++;const s=decode(r.steps[0]);if(want!==undefined)check(label,s,want);else if(s.startsWith('ENGINE'))check(label,s,()=>false);return s;}
 async function tx(label,id,fn,args=[],want=ok,sender=DEP){const r=await callContract(sid,{sender,contract:id,functionName:fn,functionArgs:args,fee:0});step++;check(label,r.vmError||r.result,want);return r;}
 async function deploy(n,path,code){const src=code??readFileSync(path,'utf8');sourceHashes[n]=createHash('sha256').update(src).digest('hex');const raw=await makeUnsignedContractDeploy({contractName:n,codeBody:src,clarityVersion:ClarityVersion.Clarity6,nonce:await getNonce(sid,DEP),network:'mainnet',publicKey:'',fee:0,postConditionMode:PostConditionMode.Allow});setSender(raw,DEP);const r=await submitSimulationSteps(sid,{steps:[{Transaction:raw.serialize()}]});step++;check('deploy '+n,decode(r.steps[0]),ok);}
 const balance=who=>`(unwrap-panic (contract-call? '${SBTC} get-balance '${who}))`;
 const live=`(get-token-x-deposit (get-current-cycle) '${vault})`,parked=`(get-token-x-parked '${vault})`,pending=`(get-token-x-pending-deposit '${vault})`;
 async function fresh(){const stamp=Number(uint(await ev('',MARKET,'stacks-block-time')));for(let i=0;i<30;i++){const p=await fetchLazerUpdateAny();if((await lazerFeedTimes(p.hex)).at>stamp)return p;await new Promise(r=>setTimeout(r,2000));}throw Error('No fresh signed print');}
 for(const shape of (process.env.SHAPE?[process.env.SHAPE]:['pending','resting','parked','pending+resting','none']))
 for(const route of (city?['public','dao']:['pool'])) {
  caseName=`${kind}/${shape}/${route}`;step=0;const beforeChecks=checks.length;
  const b=SimulationBuilder.new({stacksNodeAPI:NODE}),plan=[];appendJingStack(b,plan,sourceHashes);sid=await b.run();console.log('View: https://stxer.xyz/simulations/mainnet/'+sid);
  const first=await getSimulationResult(sid);for(let i=0;i<plan.length;i++){step++;check(plan[i].label,decode(first.steps[i].Result),plan[i].want??ok);}
  // The shared Juice vault trait is already deployed on mainnet; impl-trait
  // and the pool's real dynamic call verify its zero-argument recovery ABI.
  if(city)await deploy('ccd015-redemption-book-mia-stx',resolve(root,'contracts/extensions/ccd015-redemption-book-mia-stx.clar'));
  await deploy(name,vaultPath);
  if(!city)await deploy(pool.split('.')[1],poolPath);
  else {
   await deploy(PROXY.split('.')[1],null,`(define-private (admin) (ok (asserts! (is-eq tx-sender '${DEP}) (err u16000))))
    (define-public (reclaim) (begin (try! (admin)) (contract-call? '${vault} dao-reclaim none)))
    (define-public (recall) (begin (try! (admin)) (contract-call? '${vault} dao-recall-sbtc)))
    (define-public (allow) (begin (try! (admin)) (contract-call? '${TREASURY} set-allowed '${SBTC} true)))`);
   await ev('fork grants enabled extension identities',DAO+'.base-dao',`(begin (map-set Extensions '${vault} true) (map-set Extensions '${PROXY} true) true)`,'true');
   await tx('extension allows treasury sBTC',PROXY,'allow',[],'(ok true)');
  }
  for(const mode of ['normal','no-update','market-paused','core-paused']) {
   caseName=`${kind}/${shape}/${route}/${mode}`;
   // Start every inventory fixture before pausing. Every recovery call itself
   // takes no signed update; the one signed print is only for jing-place/setup.
   const p=await fresh(),update=Cl.buffer(Buffer.from(p.hex.replace(/^0x/,''),'hex')),mid=p.px*100000000n/p.py;
   const cycle=Number(uint(await ev('',POX,'(current-pox-reward-cycle)')))-1-['normal','no-update','market-paused','core-paused'].indexOf(mode);
   await tx('real sBTC backs rewards',SBTC,'transfer',[u(FUND),cp(WHALE),cp(city?TREASURY:POX),Cl.none()],'(ok true)',WHALE);
   let amount=FUND;
   if(city){amount=uint(await ev('',MARKET,balance(TREASURY)));await tx('treasury funds vault',vault,'fund-from-treasury',[],ok,stranger);}
   else {
    const key=`{reward-cycle:u${cycle},bond-index:none,signer:'${pool}}`;
    await ev('earned rewards + mirrored shares fixture',POX,`(begin
      (map-set signer-shares-staked-for-cycle ${key} u1)
      (map-set signer-pending-staked-ustx-per-cycle {signer:'${pool},cycle:u${cycle}} u1)
      (map-set signer-rewards-per-token-settled-for-cycle ${key} (get-rewards-per-token-for-cycle u${cycle} none))
      (map-set signer-unclaimed-rewards-for-cycle ${key} u${FUND})
      (map-set staker-shares-staked-for-cycle {reward-cycle:u${cycle},bond-index:none,signer:'${pool},staker:'${stranger}} u1)
      (var-set last-accounted-rewards-only (+ (var-get last-accounted-rewards-only) u${FUND}))
      (try! (contract-call? '${pool} validate-stake! '${stranger} u${cycle} u1 u1 u0 false none)) (ok true))`,'(ok true)');
    if(juice)await tx('pool claims into vault',pool,'pox-claim-rewards',[Cl.list([]),u(cycle),cp(vault)],ok);
    else {await tx('pool claims rewards',pool,'claim-rewards',[u(cycle)],`(ok u${FUND})`);await tx('pool funds vault through trait',pool,'fund-swap-vault',[u(cycle),cp(vault)],`(ok u${FUND})`);}
   }
   await ev('exact funded vault balance',MARKET,balance(vault),`u${amount}`);
   async function oppositeBook(){
    await tx('noncrossing opposite book',MARKET,'deposit-token-y',[u(6000000),u(mid/2n),Cl.none(),cp(WSTX),Cl.stringAscii('wstx')],'(ok u6000000)',STX_WHALE);
    const pendingY=await ev('',MARKET,`(get-token-y-pending-deposit '${STX_WHALE})`);
    if(pendingY!=='none')await tx('settle opposite seed',MARKET,'settle-token-y-deposit',[cp(STX_WHALE),update,cp(WSTX),Cl.stringAscii('wstx')],'(ok u6000000)',stranger);
   }
   if(shape==='pending')await oppositeBook();
   if(shape!=='none')await tx('jing-place creates requested inventory',vault,'jing-place',[update],ok,stranger);
   if(shape==='parked'){
    await tx('reserve 49 seats using public ladder setter',LADDER,'set-max-band-per-side',[u(49)],'(ok true)');await tx('sync reservation',MARKET,'sync-seat-count',[],'(ok u49)');
    await tx('larger entrant submits for occupied seat',MARKET,'deposit-token-x',[u(amount*2n),u(mid/2n),Cl.none(),cp(SBTC),Cl.stringAscii('sbtc-token')],`(ok u${amount*2n})`,WHALE);
    await tx('settle entrant and park incumbent',MARKET,'settle-token-x-deposit',[cp(WHALE),update,cp(SBTC),Cl.stringAscii('sbtc-token')],`(ok u${amount*2n})`,stranger);
    await ev('vault is really parked',MARKET,parked,`u${amount}`);
   }
   if(shape==='pending+resting'){
    await oppositeBook();await tx('second funded portion',SBTC,'transfer',[u(FUND),cp(WHALE),cp(vault),Cl.none()],'(ok true)',WHALE);
    await tx('jing-place submits top-up',vault,'jing-place',[update],ok,stranger);amount+=FUND;
   }
   const pendingAmount=(shape==='pending'?amount:shape==='pending+resting'?FUND:0n),liveAmount=shape==='resting'?amount:shape==='pending+resting'?amount-FUND:0n;
   await ev('pending amount exact',MARKET,`(default-to u0 (get amount ${pending}))`,`u${pendingAmount}`);
   await ev('live amount exact',MARKET,live,`u${liveAmount}`);
   await ev('parked amount exact',MARKET,parked,`u${shape==='parked'?amount:0n}`);
   await ev('vault counts pending as nonempty',vault,'(is-empty)','false');
   if(city){await tx('outsider cannot DAO-reclaim',vault,'dao-reclaim',[Cl.none()],'(err u16000)',stranger);await tx('public reclaim refused before window',vault,'jing-reclaim',[Cl.none()],'(err u16031)',stranger);}
   else await tx('outsider cannot call emergency-recover directly',vault,'emergency-recover',[],'(err u16000)',stranger);
   await ev('fixture ages vault recovery clock',vault,`(begin (var-set batch-start (some (- burn-block-height u${city?288:433}))) true)`,'true');
   if(!city&&!juice)await ev('fixture ages pool recovery deadline',pool,`(map-set cycle-settlement u${cycle} (merge (get-settlement u${cycle}) {deadline:(- burn-block-height u1)}))`,'true');
   if(mode==='market-paused')await tx('pause market',MARKET,'set-paused',[Cl.bool(true)],'(ok true)');
   if(mode==='core-paused')await tx('pause core-v6',CORE,'pause',[],'(ok true)');
   // No oracle update is fetched or supplied during recovery.
   const before=uint(await ev('',MARKET,balance(pool)));
   const out=city?await tx('reclaim with none',route==='dao'?PROXY:vault,route==='dao'?'reclaim':'jing-reclaim',route==='dao'?[]:[Cl.none()],ok,route==='dao'?DEP:stranger):await tx('pool invokes zero-argument vault emergency-recover',pool,juice?'emergency-recover':'recover-swap-vault',[cp(vault)],ok);
   if(city){await ev('all market sBTC returned to vault',MARKET,balance(vault),`u${amount}`);await tx('authorized extension recalls to treasury',PROXY,'recall',[],ok);}
   else check('recovery response amount exact',BigInt(deserializeCV(out.resultHex).value.value.sbtc.value),amount);
   await ev('pool or treasury receives exact total',MARKET,`(- ${balance(pool)} u${before})`,`u${amount}`);
   await ev('pending cleared',MARKET,pending,'none');await ev('live cleared',MARKET,live,'u0');await ev('parked cleared',MARKET,parked,'u0');await ev('vault balance zero',MARKET,balance(vault),'u0');await ev('vault fully empty',vault,'(is-empty)','true');
   await tx('settle after cancellation finds nothing',MARKET,'settle-token-x-deposit',[cp(vault),Cl.buffer(Buffer.alloc(0)),cp(SBTC),Cl.stringAscii('sbtc-token')],'(err u1030)',stranger);
   if(pendingAmount>0n){const prints=out.receipt.events.map(e=>typeof e==='string'?JSON.parse(e):e).filter(e=>e.committed&&e.contract_event?.contract_identifier===CORE).map(e=>cvToString(deserializeCV(e.contract_event.raw_value)));
    check('cancel reason and exact pending refund event',prints.join(' | '),s=>s.includes('(event "pending-refund-x")')&&s.includes('(reason "cancel")')&&s.includes(`(amount u${pendingAmount})`));}
   if(mode==='core-paused')await ev('recovery leaves core paused',CORE,'(var-get paused)','true');
   else {
    if(mode==='market-paused'){await ev('recovery leaves market paused',MARKET,'(var-get paused)','true');await tx('unpause for next setup',MARKET,'set-paused',[Cl.bool(false)],'(ok true)');}
    if(shape==='pending'||shape==='pending+resting')await tx('remove opposite seed',MARKET,'cancel-token-y-deposit',[cp(WSTX),Cl.stringAscii('wstx')],ok,STX_WHALE);
    if(shape==='parked'){await tx('remove larger entrant',MARKET,'cancel-token-x-deposit',[cp(SBTC),Cl.stringAscii('sbtc-token')],ok,WHALE);await tx('restore reservation',LADDER,'set-max-band-per-side',[u(10)],'(ok true)');await tx('sync restored reservation',MARKET,'sync-seat-count',[],'(ok u10)');}
   }
  }
  reports.push({shape,route,sid,url:'https://stxer.xyz/simulations/mainnet/'+sid,checks:checks.length-beforeChecks});save();
 }
 console.log(`${checks.length}/${checks.length} checks green`);for(const r of reports)console.log(`${r.shape}/${r.route}: ${r.url}`);save();return {checks,reports};
}
