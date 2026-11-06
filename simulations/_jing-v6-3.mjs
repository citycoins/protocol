// Current Jing dependencies, fork only. Shared setup for the three vault repos.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
export const JING_SRC=process.env.JING_SRC||resolve(homedir(),'projects/jing-contracts-v3/contracts');
const require=createRequire(resolve(JING_SRC,'../package.json'));
export const stacks=require('@stacks/transactions'),stxer=require('stxer');
export const DEP='SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22';
export const MARKET=DEP+'.markets-sbtc-stx-jing-v6-3',CORE=DEP+'.jing-core-v6',LADDER=DEP+'.jing-ladder-v1',ROUTER=DEP+'.swap-router-sbtc-stx-jing-v5-3';
export const SBTC='SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',WSTX='SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2';
export const {fetchLazerUpdateAny,lazerFeedTimes}=await import(resolve(JING_SRC,'../simulations/_lazer.js'));
// FORK_BLOCK pins a whole rerun set to one height (default: the builder's tip).
export const FORK_BLOCK=process.env.FORK_BLOCK?Number(process.env.FORK_BLOCK):undefined;
export function appendJingStack(builder,plan,sourceHashes={}) {
 if(FORK_BLOCK!==undefined)builder.useBlockHeight(FORK_BLOCK);
 const {Cl,ClarityVersion}=stacks,cp=id=>Cl.contractPrincipal(...id.split('.'));
 for(const name of ['jing-core-v6','jing-ladder-v1','markets-sbtc-stx-jing-v6-3','swap-router-sbtc-stx-jing-v5-3']) {
  const source=readFileSync(resolve(JING_SRC,name+'.clar'),'utf8');
  sourceHashes[name]=createHash('sha256').update(source).digest('hex');
  builder.withSender(DEP).addContractDeploy({contract_name:name,source_code:source,clarity_version:ClarityVersion.Clarity5});
  plan.push({label:'deploy exact '+name,kind:'deploy',want:s=>s.startsWith('(ok')});
 }
 for(const [id,fn,args,want] of [
  [MARKET,'sync-seat-count',[],'(ok u10)'],
  [CORE,'set-verified-contract',[cp(MARKET)],'(ok true)'],
  [MARKET,'initialize',[cp(MARKET),cp(SBTC),cp(WSTX),Cl.uint(1000),Cl.uint(1000000),Cl.uint(1),Cl.uint(45)],'(ok true)'],
 ]) {
  builder.addContractCall({contract_id:id,function_name:fn,function_args:args,sender:DEP});
  plan.push({label:'Jing '+fn,kind:'tx',want});
 }
}

export async function freshProofAfter(stamp) {
 if(!Number.isFinite(stamp))throw new Error('Fork block timestamp missing');
 for(let i=0;i<30;i++) {
  const p=await fetchLazerUpdateAny();
  if((await lazerFeedTimes(p.hex)).at>stamp)return p;
  await new Promise(r=>setTimeout(r,2000));
 }
 throw new Error('No signed price newer than '+stamp);
}
