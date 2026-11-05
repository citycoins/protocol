// Updated for exact core-v6 / ladder-v1 / market-v6-3 / router-v5-3.
// Real signed update, unchanged freshness; synthetic burn blocks use one-second intervals.
import {freshProofAfter} from './_jing-v6-3.mjs';
// stxer-ccd016-v2-happy-path.js
// SELF-VERIFYING stxer mainnet-fork harness for ccd016-swap-vault-mia-v2
// Deploy the current Jing core-v6, ladder-v1, market-v6-3 and router-v5-3
// from JING_SRC under their production names, then the ccd015 book and vault.
// No dependency aliases or freshness patches.
//
// The DAO gate is simulated as in stxer-ccd015-oracle-coverage.js: base-dao
// is patched so is-extension is true for the vault (the treasury withdraw)
// and for a proxy contract that plays a passed proposal. DIA is impersonated
// from its real updater key with the Lazer prices, so Pyth and DIA agree.
//
// The HAPPY PATH, twice, on the source after the clock fix (start-clock gone,
// a window opens only when fund-from-treasury finds the vault empty or with
// no clock):
//   batch 1: fund (window opens) -> jing-place -> a taker bigger than the
//            batch buys the WHOLE batch at the mid in the patience phase
//            (a second maker behind the vault absorbs the remainder, as a
//            real book would; the v6 swap refuses a partial fill, u1017)
//            -> the vault is empty
//            of sBTC (STX home) -> fuel-fair-book sends the STX to the book
//            and clears the clock -> fund again: opens (fresh batch-start)
//   batch 2: jing-place -> nobody takes -> the window elapses (proposal +
//            block advance) -> jing-reclaim by anyone -> router-swap by
//            anyone sells the WHOLE batch at the floor (unsold 0) -> the
//            exit clears the clock -> fuel-fair-book -> fund a third time:
//            opens again
// A funding on a non-empty vault in between proves the clock does not move.
// Run: PYTH_API_KEY=<key> node simulations/stxer-ccd016-v2-coverage.js
import fs from "node:fs";
import {createHash} from "node:crypto";
import {fetchLazerUpdateAny} from "./_vault-lazer.mjs";
import {
  ClarityVersion, uintCV, boolCV, noneCV, listCV, tupleCV, stringAsciiCV, bufferCV, trueCV, falseCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString,
} from "@stacks/transactions";
import { SimulationBuilder, getSimulationResult } from "stxer";

const NODE = process.env.STACKS_API_URL || "http://77.42.3.101/stacks-api";
const JING_SRC = process.env.JING_SRC || `${process.env.HOME}/projects/jing-contracts-v3/contracts`;

const DEPLOYER = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22"; // chavita: the jing deployer, and the vault + book here
const SBTC_WHALE = "SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2";
const STX_WHALE = "SP9BP4PN74CNR5XT7CMAMBPA0GWC9HMB69HVVV51";
const STRANGER = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM";
const DIA_UPDATER = "SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0";
const DAO = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
const BASE_DAO = `${DAO}.base-dao`;
const REWARDS_TREASURY = `${DAO}.ccd002-treasury-mia-rewards-v3`;
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const WSTX = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2";
const DIA = `${DIA_UPDATER}.dia-oracle`;

const CORE = "jing-core-v6", LADDER = "jing-ladder-v1", MKT = "markets-sbtc-stx-jing-v6-3", ROUTER = "swap-router-sbtc-stx-jing-v5-3";
const BOOK = "ccd015-redemption-book-mia-stx", VAULT = "ccd016-swap-vault-mia-v2", PROXY = "sim-dao-proxy";
const CORE_ID = `${DEPLOYER}.${CORE}`, MKT_ID = `${DEPLOYER}.${MKT}`, BOOK_ID = `${DEPLOYER}.${BOOK}`, VAULT_ID = `${DEPLOYER}.${VAULT}`, PROXY_ID = `${DEPLOYER}.${PROXY}`;
const [sbtcAddr, sbtcName] = SBTC.split("."), [wstxAddr, wstxName] = WSTX.split("."), [trAddr, trName] = REWARDS_TREASURY.split(".");
const sbtcT = contractPrincipalCV(sbtcAddr, sbtcName), wstxT = contractPrincipalCV(wstxAddr, wstxName);
const PP = 100_000_000n, PPDF = PP * 100n, BPS = 10_000n, HUGE = 999_999_999_999_999n;
const FUND = 100_000n; // sats per batch: small enough for one taker and one router chunk to clear it whole
const TAKE_STX = 400_000_000n; // the taker's gross STX: worth more than the batch, so the vault sells out
// comment-only lines stripped: the jing v6 market is over the 100,000-byte
// deploy limit with its comments (the deploy form is stripped too)
// Canonical v6-3 dependency names are deployed fresh on the fork.
const ALIASES = {}; // Exact canonical dependency names; no source rebinding.
const src = f => {
 let original=f; for(const [a,b] of Object.entries(ALIASES)) original=original.replace(b,a);
 let text=fs.readFileSync(original,"utf8").split("\n").filter(l=>!/^\s*;;/.test(l)).join("\n");
 for(const [a,b] of Object.entries(ALIASES)) text=text.replaceAll(a,b);
 return text;
};
const sbtcBal = (a) => `(contract-call? '${SBTC} get-balance '${a})`;
const decodeTx = (s) => { const r = s?.Result?.Transaction; if (!r) return "<no tx>"; if ("Err" in r) return `ENGINE-ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; if (r.Ok?.vm_error) return `VM-ERR: ${r.Ok.vm_error}`; try { return cvToString(deserializeCV(r.Ok.result)); } catch (e) { return `decode-failed: ${e.message}`; } };
const decodeEval = (s) => { const r = s?.Result?.Eval; if (!r) return "<no eval>"; if (!("Ok" in r)) return `ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; try { return cvToString(deserializeCV(r.Ok)); } catch { return r.Ok; } };
const num = (s, key) => BigInt((String(s).match(new RegExp(`\\(${key} u(\\d+)\\)`)) || [])[1] ?? "-1");
const bare = (s) => BigInt((String(s).match(/u(\d+)/) || [])[1] ?? "-1");
const field = (s, k) => (String(s).match(new RegExp(`\\(${k} (u?\\d+|none|true|false|\\(some u\\d+\\))\\)`)) || [])[1];

async function fetchJson(path) { const r = await fetch(`${NODE}${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
async function fetchLazerUpdate() { return fetchLazerUpdateAny(); }
const diaPush = (stxUsd, btcUsd, tsMs) => listCV([
  tupleCV({ key: stringAsciiCV("STX/USD"), value: uintCV(stxUsd), timestamp: uintCV(tsMs) }),
  tupleCV({ key: stringAsciiCV("BTC/USD"), value: uintCV(btcUsd), timestamp: uintCV(tsMs) }),
]);

// the proxy = a passed proposal: an enabled extension that forwards the DAO-only calls
const PROXY_SRC = `
(define-public (is-dao-or-extension) (ok true))
(define-public (callback (sender principal) (memo (buff 34))) (ok true))
(define-public (allow-sbtc) (contract-call? '${REWARDS_TREASURY} set-allowed '${SBTC} true))
(define-public (refloor (update (buff 8192))) (contract-call? '${VAULT_ID} jing-refloor update))
(define-public (take (amount uint) (update (buff 8192))) (contract-call? '${VAULT_ID} jing-take amount update))
(define-public (set-window (blocks uint)) (contract-call? '${VAULT_ID} set-window-blocks blocks))
(define-public (recall) (contract-call? '${VAULT_ID} dao-recall-sbtc))
`;

let checks = 0, failures = 0;
function check(label, actual, want) {
  checks += 1;
  const ok = typeof want === "function" ? want(actual) : want instanceof RegExp ? want.test(String(actual)) : String(actual) === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual).slice(0, 170)}${ok ? "" : ` (want ${typeof want === "function" ? want.toString().slice(0, 90) : want})`}`);
}

async function main() {
  console.log("=== ccd016-swap-vault-mia-v2 HAPPY PATH: two batches, both emptied, both reopened (mainnet fork, Lazer) ===");
  // FORK_BLOCK pins a whole rerun set to one height (default: the node tip)
  const tip = process.env.FORK_BLOCK ? await fetchJson(`/extended/v1/block/by_height/${process.env.FORK_BLOCK}`) : (await fetchJson(`/extended/v1/block?limit=1`)).results[0];
  const lz = await freshProofAfter(Number(tip.block_time) + 12);
  const UPD = bufferCV(Buffer.from(lz.hex, "hex"));
  const MID = (lz.px * PP) / lz.py;
  const FRESH_MS = BigInt(tip.burn_block_time) * 1000n;
  console.log(`Lazer mid ${MID} (1 STX ~ ${(10n ** 16n) / MID} sats); DIA impersonated with the same prices; tip ${tip.height}`);

  // sources
  const coreSrc = src(`${JING_SRC}/${CORE}.clar`), ladderSrc = src(`${JING_SRC}/${LADDER}.clar`);
  let mktSrc = src(`${JING_SRC}/${MKT}.clar`);
  const routerSrc = src(`${JING_SRC}/${ROUTER}.clar`);
  const bookSrc = src(`./contracts/extensions/${BOOK}.clar`);
  const vaultSrc = src(`./contracts/extensions/${VAULT}.clar`);
  if (!vaultSrc.includes(`.${MKT})`) || !vaultSrc.includes(`.${ROUTER})`)) throw new Error("vault does not bind market v6 / router v5");
  const baseDaoSrc = (await fetchJson(`/extended/v1/contract/${BASE_DAO}`)).source_code;
  const needle = "(default-to false (map-get? Extensions extension))";
  if (!baseDaoSrc.includes(needle)) throw new Error("base-dao is-extension body changed; update the patch");
  const baseDaoPatched = baseDaoSrc.replace(needle, `(or (default-to false (map-get? Extensions extension)) (is-eq extension '${VAULT_ID}) (is-eq extension '${PROXY_ID}))`);

  // ---- expected numbers ----
  const LEEWAY = 500n, SLIPPAGE = 100n;
  const FLOOR = (MID * (BPS - LEEWAY)) / BPS;
  // market swap: net = floor(amount * BPS / (BPS + 20)) at a fresh print, rebate = amount - net
  const NET = (TAKE_STX * BPS) / (BPS + 20n), REB = TAKE_STX - NET;
  const XC = (NET * PPDF) / MID; // sats the taker buys at mid (y binding: the vault's 1M sats is far bigger)
  const STX_TO_VAULT = NET - NET / 1000n + REB; // net - 10 bps fee + the whole rebate rides (single x maker)
  if (XC <= FUND) throw new Error("sizing: 400 STX must be worth more than the batch");

  // ---- builder with a plan ----
  const plan = [];
  let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(tip.height);
  const deploy = (name, code, cv = ClarityVersion.Clarity6) => { b = b.withSender(DEPLOYER).addContractDeploy({ contract_name: name, source_code: code, clarity_version: cv }); plan.push({ kind: "deploy", label: `deploy ${name}` }); };
  const patch = (cid, code, label, cv) => { b = b.addSetContractCode({ contract_id: cid, source_code: code, clarity_version: cv }); plan.push({ kind: "patch", label }); };
  const tx = (label, sender, cid, fn, args, want) => { if (fn === "jing-reclaim" && args.length === 0) args = [noneCV()]; if (/^deposit-token-[xy]$/.test(fn) && args.length === 6) args = args.filter((_, i) => i !== 3); if (/^readmit-token-[xy]$/.test(fn)) args = args.slice(0, 1); b = b.withSender(sender).addContractCall({ contract_id: cid, function_name: fn, function_args: args }); const slot = { kind: "tx", label, want }; plan.push(slot); return slot; };
  const ev = (label, cid, code, want) => { b = b.addEvalCode(cid, code); const slot = { kind: "eval", label, want }; plan.push(slot); return slot; };
  const advance = (btc) => { b = b.addAdvanceBlocks({ bitcoin_blocks: btc, stacks_blocks_per_bitcoin: 1, bitcoin_interval_secs: 1 }); plan.push({ kind: "advance", label: `advance ${btc} bitcoin blocks` }); };
  const ok = (v) => String(v).startsWith("(ok");

  // ---- S0 the stack ----
  deploy(CORE, coreSrc); deploy(LADDER, ladderSrc); deploy(MKT, mktSrc);
  tx("core-v5 verifies market v6", DEPLOYER, CORE_ID, "set-verified-contract", [contractPrincipalCV(DEPLOYER, MKT)], "(ok true)");
  tx("market v6 initialize", DEPLOYER, MKT_ID, "initialize", [contractPrincipalCV(DEPLOYER, MKT), sbtcT, wstxT, uintCV(1000), uintCV(1_000_000), uintCV(1), uintCV(45)], "(ok true)");
  tx("sync current ladder seat reservation", DEPLOYER, MKT_ID, "sync-seat-count", [], "(ok u10)");
  deploy(ROUTER, routerSrc);
  deploy(BOOK, bookSrc);
  deploy(VAULT, vaultSrc);
  deploy(PROXY, PROXY_SRC);
  patch(BASE_DAO, baseDaoPatched, "patch base-dao: is-extension true for the vault + proxy", ClarityVersion.Clarity1);
  tx("DIA: push the Lazer prices, fresh", DIA_UPDATER, DIA, "set-multiple-values", [diaPush(lz.py, lz.px, FRESH_MS)], "(ok true)");
  tx("proxy allows sBTC on the treasury (idempotent)", DEPLOYER, PROXY_ID, "allow-sbtc", [], ok);
  ev("S0 empty, no clock", VAULT_ID, "(get-clock)", (v) => field(v, "batch-start") === "none");
  const status = (label, want) => ev(label, VAULT_ID, "(get-status)", want);
  const clock = (label, want) => ev(label, VAULT_ID, "(get-clock)", want);

  // ---- B1: batch 1, emptied by the book in the patience phase ----
  tx("B1 whale sends 100k sats to the treasury", SBTC_WHALE, SBTC, "transfer", [uintCV(FUND), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  tx("B1 fund-from-treasury: empty vault -> window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND})`) && v.includes("(opened true)"));
  const b1 = clock("B1 clock open", (v) => field(v, "window-open") === "true");
  tx("B1 stranger jing-place: the whole batch rests as a zero-spread peg", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("B1 100k resting, 0 home", (v) => field(v, "jing-resting") === `u${FUND}` && field(v, "sbtc-balance") === "u0" && field(v, "empty") === "false");
  tx("B1 another maker rests 1M sats at mid + 1% (a real book has depth behind the vault; a taker bigger than the batch needs it, else u1017)", SBTC_WHALE, MKT_ID, "deposit-token-x", [uintCV(1_000_000), uintCV((MID * 101n) / 100n), noneCV(), UPD, sbtcT, stringAsciiCV("sbtc-token")], "(ok u1000000)");
  tx("B1 a taker sells 400 STX: the vault's whole batch fills first (best ask, at the mid), the rest hits the other maker", STX_WHALE, MKT_ID, "swap", [uintCV(TAKE_STX), uintCV(HUGE), UPD, sbtcT, stringAsciiCV("sbtc-token"), wstxT, stringAsciiCV("wstx"), falseCV()], ok);
  ev("B1 settlement at the mid", MKT_ID, "(get price (unwrap-panic (get-settlement u0)))", `u${MID}`);
  status("B1 sold out: nothing resting, no sats home, STX home, EMPTY", (v) => field(v, "jing-resting") === "u0" && field(v, "sbtc-balance") === "u0" && bare(field(v, "stx-balance")) > 0n && field(v, "empty") === "true");
  clock("B1 the clock still shows (no exit call ran here)", (v) => field(v, "batch-start") !== "none");
  tx("B1 stranger close-batch: the vault is empty, the stale clock clears (the sold-out-by-the-book case)", STRANGER, VAULT_ID, "close-batch", [], (v) => ok(v) && v.includes("close-batch"));
  clock("B1 clock cleared by close-batch", (v) => field(v, "batch-start") === "none" && field(v, "window-open") === "false");
  tx("B1 close-batch again -> u16032 (no clock)", STRANGER, VAULT_ID, "close-batch", [], "(err u16032)");
  tx("B1 stranger fuel-fair-book: the STX goes to the book", STRANGER, VAULT_ID, "fuel-fair-book", [], (v) => ok(v) && v.includes(BOOK_ID));
  clock("B1 clock still clear after the flush", (v) => field(v, "batch-start") === "none" && field(v, "window-open") === "false");
  advance(3);

  // ---- B2: batch 2, emptied in the liquidation phase ----
  tx("B2 whale sends 100k sats to the treasury", SBTC_WHALE, SBTC, "transfer", [uintCV(FUND), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  tx("B2 fund-from-treasury: empty vault -> a SECOND window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND})`) && v.includes("(opened true)"));
  const b2 = clock("B2 clock open, fresh batch-start", (v) => field(v, "window-open") === "true");
  tx("B2 stranger jing-place", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("B2 100k resting", (v) => field(v, "jing-resting") === `u${FUND}`);
  tx("B2 1 sat to the treasury", SBTC_WHALE, SBTC, "transfer", [uintCV(1), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  tx("B2 fund-from-treasury while the batch rests -> joins, opens nothing", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes("(amount u1)") && v.includes("(opened false)"));
  tx("B2 proxy set-window-blocks 1", DEPLOYER, PROXY_ID, "set-window", [uintCV(1)], "(ok true)");
  advance(2);
  clock("B2 window elapsed: nobody took", (v) => field(v, "window-elapsed") === "true");
  tx("B2 stranger jing-reclaim: the batch comes home", STRANGER, VAULT_ID, "jing-reclaim", [], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("B2 100,001 home, nothing resting, not empty", (v) => field(v, "sbtc-balance") === `u${FUND + 1n}` && field(v, "jing-resting") === "u0" && field(v, "empty") === "false");
  // Nested Quinn L-1: the pools take what fits inside the 1% floor, the rest stays
  // home (before the fix a partial fill reverted u3002). A bid then rests on the
  // book and the next call sells the rest through the router's book leg.
  const b2a = tx("B2 stranger router-swap the whole 100,001 sats at the floor: sells what the pools take inside it", STRANGER, VAULT_ID, "router-swap", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND + 1n})`) && FUND + 1n - num(v, "unsold") > 8n && num(v, "out") >= ((FUND + 1n - num(v, "unsold") - 8n) * num(v, "limit-price")) / PPDF);
  status("B2 exactly the unsold rest stays home", (v) => bare(field(v, "sbtc-balance")) === num(b2a.raw, "unsold"));
  tx("B2 STX whale rests a 300 STX bid at the mid (book depth for the rest)", STX_WHALE, MKT_ID, "deposit-token-y", [uintCV(300_000_000), uintCV(HUGE), noneCV(), UPD, wstxT, stringAsciiCV("wstx")], "(ok u300000000)");
  advance(1);
  tx("B2 next burn block: router-swap sells the rest through the book leg (or, if the first call sold everything, the batch is closed: u16031)", STRANGER, VAULT_ID, "router-swap", [UPD], (v) => num(b2a.raw, "unsold") > 0n ? ok(v) && v.includes(`(amount u${num(b2a.raw, "unsold")})`) && num(v, "unsold") <= 2n : v === "(err u16031)");
  status("B2 sold: at most 2 dust sats home, nothing on the market, EMPTY", (v) => bare(field(v, "sbtc-balance")) <= 2n && field(v, "jing-resting") === "u0" && field(v, "jing-parked") === "u0" && field(v, "empty") === "true");
  clock("B2 the exit cleared the clock", (v) => field(v, "batch-start") === "none" && field(v, "window-elapsed") === "false");
  tx("B2 stranger fuel-fair-book", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  tx("B2 the bidder cancels what is left of its bid (so B3's place rests, not escrows)", STX_WHALE, MKT_ID, "cancel-token-y-deposit", [wstxT, stringAsciiCV("wstx")], ok);

  // ---- B3: a third window opens on the empty vault ----
  tx("B3 whale sends 100k sats to the treasury", SBTC_WHALE, SBTC, "transfer", [uintCV(FUND), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  tx("B3 fund-from-treasury: empty vault -> a THIRD window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes("(opened true)"));
  const b3 = clock("B3 clock open", (v) => field(v, "window-open") === "true");
  tx("B3 stranger jing-place", STRANGER, VAULT_ID, "jing-place", [UPD], ok);
  status("B3 resting: the batch plus B2's dust (at most 2 sats)", (v) => bare(field(v, "jing-resting")) >= FUND && bare(field(v, "jing-resting")) <= FUND + 2n && field(v, "jing-escrowed") === "u0");

  // ---- run ----
  const sid = await b.run();
  console.log(`View: https://stxer.xyz/simulations/mainnet/${sid}\n`);
  const res = await getSimulationResult(sid);
  const s = res.steps; let i = 0;
  for (const p of plan) {
    if (p.kind === "deploy" || p.kind === "patch" || p.kind === "advance") {
      const st = s[i++]; const r = st?.Result || {};
      const okStep = !("Err" in (r.SetContractCode || r.Transaction || r.AdvanceBlocks || {})) && !r.Transaction?.Ok?.vm_error;
      check(p.label, okStep ? "ok" : JSON.stringify(r).slice(0, 160), "ok");
      continue;
    }
    while (i < s.length && !s[i]?.Result?.Transaction && !s[i]?.Result?.Eval) i += 1;
    const raw = p.kind === "tx" ? decodeTx(s[i]) : decodeEval(s[i]); i += 1;
    p.raw = raw;
    if (typeof p.want === "function" && p.want.length === 0) { console.log(`  ..   ${p.label}: ${String(raw).slice(0, 120)}`); continue; }
    check(p.label, raw, p.want);
  }
  check("B2 batch-start moved on from B1", bare(field(b2.raw, "batch-start")), (v) => v > bare(field(b1.raw, "batch-start")));
  check("B3 batch-start moved on from B2", bare(field(b3.raw, "batch-start")), (v) => v > bare(field(b2.raw, "batch-start")));
  console.log(`\n${checks - failures}/${checks} checks green`);
  const RESULTS_DIR = process.env.SIM_RESULTS_DIR || "simulations/results/ccd016-v2";
  fs.mkdirSync(RESULTS_DIR,{recursive:true});
  fs.writeFileSync(`${RESULTS_DIR}/happy-path.json`, JSON.stringify({simulationId:sid, checks, failures, simulationRewrites:{dependencyAliases:ALIASES,commentsStripped:true,marketStalenessWidened:false}, sourceHash:createHash("sha256").update(fs.readFileSync("contracts/extensions/ccd016-swap-vault-mia-v2.clar")).digest("hex"), plan:plan.map(({want,...p})=>p), result:res},null,2)+"\n");
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
