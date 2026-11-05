// stxer-ccd016-v2-pyth-fee.js
// SELF-VERIFYING stxer mainnet-fork harness for the ccd016-swap-vault-mia-v2
// Pyth Lazer fee budget (pyth-fee-budget + set-pyth-fee-budget).
//
// The live SPMV5HDZ4EMB8XY7HAYT3XW0DF7DZ4E8XEG2J1T8.pyth-lazer-oracle charges
// `fee` uSTX from tx-sender on every verify-price-feeds; inside the vault's
// as-contract? tx-sender is the vault. Fork-only fixture: an Eval inside the
// oracle sets its fee var to u10 (governance's set-fee would do the same).
//
// Bounty mv7dfb (Super Orb): the vault pays both verifies. current-mid (the
// market's refresh-mid) runs through vault-mid in the vault's own as-contract?
// scope, and the market's swap verifies once more in the swap's scope. So
// router-swap and jing-take cost the vault 2 fees. Each scope's with-stx caps
// one verify, so the budget aborts below 1 x fee (in vault-mid, err u0).
// The caller pays nothing: a fresh 0-STX account runs router-swap.
//
// Covers:
//   setter: stranger u16000, max + 1 u16033, max ok, 0 ok, print, get-config
//   budget 0 + no vault STX: router-swap and jing-take abort with (err u1):
//     the vault cannot pay its refresh-mid fee
//   budget 0 + an STX float: both abort on vault-mid's STX allowance (err u0)
//   budget 9 = fee - 1: both abort on that allowance (err u0)
//   budget 20 = 2 x fee + float: router-swap fills through the book leg and
//     jing-take fills; each pays exactly two 10 uSTX fees from the vault
//   fuel-fair-book keeps the budget: with budget 20 a stranger's sweep
//     leaves exactly 20 uSTX (u16006 when nothing is above it), and both
//     sales above run right after such a sweep
//
// Same stack and DAO simulation as stxer-ccd016-v2-fixes.js: the current
// Jing core-v6, ladder-v1, market v6-3 and router v5-3 from JING_SRC under
// their production names, then the ccd015 book, the vault and a proxy that
// plays a passed proposal; base-dao is-extension patched for vault + proxy;
// DIA impersonated with the Lazer prices.
//
// Run: node simulations/stxer-ccd016-v2-pyth-fee.js (PYTH_API_KEY optional)
import {freshProofAfter} from './_jing-v6-3.mjs';
import fs from "node:fs";
import {createHash} from "node:crypto";
import {
  ClarityVersion, uintCV, listCV, tupleCV, stringAsciiCV, bufferCV, falseCV, noneCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString, someCV, getAddressFromPrivateKey,
} from "@stacks/transactions";
import { SimulationBuilder, getSimulationResult } from "stxer";

const NODE = process.env.STACKS_API_URL || "http://77.42.3.101/stacks-api";
const JING_SRC = process.env.JING_SRC || `${process.env.HOME}/projects/jing-contracts-v3/contracts`;
const RESULTS_DIR = process.env.SIM_RESULTS_DIR || "simulations/results/ccd016-v2";

const DEPLOYER = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
const SBTC_WHALE = "SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2";
const STX_WHALE = "SP9BP4PN74CNR5XT7CMAMBPA0GWC9HMB69HVVV51";
const STRANGER = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM";
// a fresh account that holds 0 STX (stxer charges no tx fee): it runs router-swap
const EMPTY = getAddressFromPrivateKey("5".repeat(64) + "01", "mainnet");
const DIA_UPDATER = "SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0";
const DAO = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
const BASE_DAO = `${DAO}.base-dao`;
const REWARDS_TREASURY = `${DAO}.ccd002-treasury-mia-rewards-v3`;
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const WSTX = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2";
const DIA = `${DIA_UPDATER}.dia-oracle`;
const ORACLE = "SPMV5HDZ4EMB8XY7HAYT3XW0DF7DZ4E8XEG2J1T8.pyth-lazer-oracle";

const CORE = "jing-core-v6", LADDER = "jing-ladder-v1", MKT = "markets-sbtc-stx-jing-v6-3", ROUTER = "swap-router-sbtc-stx-jing-v5-3";
const BOOK = "ccd015-redemption-book-mia-stx", VAULT = "ccd016-swap-vault-mia-v2", PROXY = "sim-dao-proxy";
const CORE_ID = `${DEPLOYER}.${CORE}`, MKT_ID = `${DEPLOYER}.${MKT}`, ROUTER_ID = `${DEPLOYER}.${ROUTER}`, VAULT_ID = `${DEPLOYER}.${VAULT}`, PROXY_ID = `${DEPLOYER}.${PROXY}`;
const [sbtcAddr, sbtcName] = SBTC.split("."), [wstxAddr, wstxName] = WSTX.split("."), [trAddr, trName] = REWARDS_TREASURY.split(".");
const sbtcT = contractPrincipalCV(sbtcAddr, sbtcName), wstxT = contractPrincipalCV(wstxAddr, wstxName);
const PP = 100_000_000n, HUGE = 999_999_999_999_999n;
const FEE = 10n, PER_FILL = 2n * FEE, MAX_BUDGET = 10_000_000n; // MAX_PYTH_FEE_BUDGET = 10 STX
const FUND = 100_000n;
const DUMP = 20_000_000n; // a whale's router sale down to mid - 1%: the AMMs take nothing inside the vault's floor
const SLIPPAGE = 50n; // vault floor mid - 0.5%: only the book leg can fill
const BID_STX = 600_000_000n; // resting bid at any price, covers both sales
const FLOAT = 1_000_000n; // 1 STX the DAO leaves in the vault for fees

const src = f => fs.readFileSync(f, "utf8").split("\n").filter(l => !/^\s*;;/.test(l)).join("\n");
const decodeTx = (s) => { const r = s?.Result?.Transaction; if (!r) return "<no tx>"; if ("Err" in r) return `ENGINE-ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; if (r.Ok?.vm_error) return `VM-ERR: ${r.Ok.vm_error}`; try { return cvToString(deserializeCV(r.Ok.result)); } catch (e) { return `decode-failed: ${e.message}`; } };
const decodeEval = (s) => { const r = s?.Result?.Eval; if (!r) return "<no eval>"; if (!("Ok" in r)) return `ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; try { return cvToString(deserializeCV(r.Ok)); } catch { return r.Ok; } };
const num = (s, key) => BigInt((String(s).match(new RegExp(`\\(${key} u(\\d+)\\)`)) || [])[1] ?? "-1");
const bare = (s) => BigInt((String(s).match(/u(\d+)/) || [])[1] ?? "-1");
const field = (s, k) => (String(s).match(new RegExp(`\\(${k} (u?\\d+|none|true|false|\\(some u\\d+\\))\\)`)) || [])[1];

async function fetchJson(path) { const r = await fetch(`${NODE}${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
const diaPush = (stxUsd, btcUsd, tsMs) => listCV([
  tupleCV({ key: stringAsciiCV("STX/USD"), value: uintCV(stxUsd), timestamp: uintCV(tsMs) }),
  tupleCV({ key: stringAsciiCV("BTC/USD"), value: uintCV(btcUsd), timestamp: uintCV(tsMs) }),
]);

const PROXY_SRC = `
(define-public (is-dao-or-extension) (ok true))
(define-public (callback (sender principal) (memo (buff 34))) (ok true))
(define-public (allow-sbtc) (contract-call? '${REWARDS_TREASURY} set-allowed '${SBTC} true))
(define-public (set-window (blocks uint)) (contract-call? '${VAULT_ID} set-window-blocks blocks))
(define-public (set-slippage (bps uint)) (contract-call? '${VAULT_ID} set-slippage-bps bps))
(define-public (set-budget (ustx uint)) (contract-call? '${VAULT_ID} set-pyth-fee-budget ustx))
(define-public (take (requested uint) (update (buff 8192))) (contract-call? '${VAULT_ID} jing-take requested update))
`;

const eventsOf = (step) => (step?.Result?.Transaction?.Ok?.events ?? []).map(e => typeof e === "string" ? JSON.parse(e) : e).filter(e => e.committed !== false);
const stxMoves = (evs) => evs.filter(e => e.type === "stx_transfer_event").map(e => ({ from: e.stx_transfer_event.sender, to: e.stx_transfer_event.recipient, amount: BigInt(e.stx_transfer_event.amount) }));
const printsOf = (evs, contract) => evs.filter(e => e.type === "contract_event" && e.contract_event?.topic === "print" && e.contract_event.contract_identifier === contract)
  .map(e => { try { return cvToString(deserializeCV(e.contract_event.raw_value)); } catch { return ""; } });

let checks = 0, failures = 0;
const results = [];
function check(label, actual, want) {
  checks += 1;
  const ok = typeof want === "function" ? want(actual) : want instanceof RegExp ? want.test(String(actual)) : String(actual) === want;
  if (!ok) failures += 1;
  results.push({ label, passed: ok, actual: String(actual).slice(0, 400) });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual).slice(0, 200)}${ok ? "" : ` (want ${typeof want === "function" ? want.toString().slice(0, 110) : want})`}`);
}

async function main() {
  console.log("=== ccd016-swap-vault-mia-v2 PYTH FEE BUDGET: oracle fee u10 vs pyth-fee-budget (mainnet fork, Lazer) ===");
  const tip = process.env.FORK_BLOCK ? await fetchJson(`/extended/v1/block/by_height/${process.env.FORK_BLOCK}`) : (await fetchJson(`/extended/v1/block?limit=1`)).results[0];
  const lz = await freshProofAfter(Number(tip.block_time) + 12);
  const UPD = bufferCV(Buffer.from(lz.hex, "hex"));
  const MID = (lz.px * PP) / lz.py;
  const FRESH_MS = BigInt(tip.burn_block_time) * 1000n;
  console.log(`Lazer mid ${MID}; tip ${tip.height}`);

  const coreSrc = src(`${JING_SRC}/${CORE}.clar`), ladderSrc = src(`${JING_SRC}/${LADDER}.clar`);
  const mktSrc = src(`${JING_SRC}/${MKT}.clar`), routerSrc = src(`${JING_SRC}/${ROUTER}.clar`);
  const bookSrc = src(`./contracts/extensions/${BOOK}.clar`), vaultSrc = src(`./contracts/extensions/${VAULT}.clar`);
  for (const needle of ["(define-constant MAX_PYTH_FEE_BUDGET u10000000)", "(define-data-var pyth-fee-budget uint u0)", "(define-public (set-pyth-fee-budget"])
    if (!vaultSrc.includes(needle)) throw new Error(`vault source lacks ${needle}`);
  const sourceHashes = Object.fromEntries([[CORE, `${JING_SRC}/${CORE}.clar`], [LADDER, `${JING_SRC}/${LADDER}.clar`], [MKT, `${JING_SRC}/${MKT}.clar`], [ROUTER, `${JING_SRC}/${ROUTER}.clar`], [BOOK, `contracts/extensions/${BOOK}.clar`], [VAULT, `contracts/extensions/${VAULT}.clar`]]
    .map(([n, p]) => [n, createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
  const baseDaoSrc = (await fetchJson(`/extended/v1/contract/${BASE_DAO}`)).source_code;
  const needle = "(default-to false (map-get? Extensions extension))";
  if (!baseDaoSrc.includes(needle)) throw new Error("base-dao is-extension body changed; update the patch");
  const baseDaoPatched = baseDaoSrc.replace(needle, `(or (default-to false (map-get? Extensions extension)) (is-eq extension '${VAULT_ID}) (is-eq extension '${PROXY_ID}))`);

  const plan = [];
  let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(tip.height);
  const deploy = (name, code, cv = ClarityVersion.Clarity6) => { b = b.withSender(DEPLOYER).addContractDeploy({ contract_name: name, source_code: code, clarity_version: cv }); plan.push({ kind: "deploy", label: `deploy ${name}` }); };
  const patch = (cid, code, label, cv) => { b = b.addSetContractCode({ contract_id: cid, source_code: code, clarity_version: cv }); plan.push({ kind: "patch", label }); };
  const tx = (label, sender, cid, fn, args, want) => { b = b.withSender(sender).addContractCall({ contract_id: cid, function_name: fn, function_args: args }); const slot = { kind: "tx", label, want }; plan.push(slot); return slot; };
  const stxTo = (label, sender, recipient, amount) => { b = b.withSender(sender).addSTXTransfer({ recipient, amount: Number(amount) }); const slot = { kind: "tx", label, want: (v) => v.startsWith("(ok") }; plan.push(slot); return slot; };
  const ev = (label, cid, code, want) => { b = b.addEvalCode(cid, code); const slot = { kind: "eval", label, want }; plan.push(slot); return slot; };
  const ok = (v) => String(v).startsWith("(ok");
  const any = () => true; any.observe = true;
  const status = (label, want = any) => ev(label, VAULT_ID, "(get-status)", want);
  const config = (label, want = any) => ev(label, VAULT_ID, "(get-config)", want);
  const stxBal = (label, who, want = any) => ev(label, VAULT_ID, `(stx-get-balance '${who})`, want);
  const toTreasury = (label, amount) => tx(label, SBTC_WHALE, SBTC, "transfer", [uintCV(amount), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  const budget = (ustx, want = "(ok true)") => tx(`proxy set-pyth-fee-budget ${ustx}`, DEPLOYER, PROXY_ID, "set-budget", [uintCV(ustx)], want);
  const routerSwap = (label, want, sender = STRANGER) => tx(label, sender, VAULT_ID, "router-swap", [UPD], want);
  const jingTake = (label, want) => tx(label, DEPLOYER, PROXY_ID, "take", [uintCV(FUND), UPD], want);
  const isErr = (v) => /^\(err u\d+\)$/.test(String(v));

  // ---- the stack ----
  deploy(CORE, coreSrc); deploy(LADDER, ladderSrc); deploy(MKT, mktSrc);
  tx("core verifies the market", DEPLOYER, CORE_ID, "set-verified-contract", [contractPrincipalCV(DEPLOYER, MKT)], "(ok true)");
  tx("market initialize", DEPLOYER, MKT_ID, "initialize", [contractPrincipalCV(DEPLOYER, MKT), sbtcT, wstxT, uintCV(1000), uintCV(1_000_000), uintCV(1), uintCV(45)], "(ok true)");
  tx("sync current ladder seat reservation", DEPLOYER, MKT_ID, "sync-seat-count", [], "(ok u10)");
  deploy(ROUTER, routerSrc); deploy(BOOK, bookSrc); deploy(VAULT, vaultSrc); deploy(PROXY, PROXY_SRC);
  patch(BASE_DAO, baseDaoPatched, "patch base-dao: is-extension true for the vault + proxy", ClarityVersion.Clarity1);
  tx("DIA: push the Lazer prices, fresh", DIA_UPDATER, DIA, "set-multiple-values", [diaPush(lz.py, lz.px, FRESH_MS)], "(ok true)");
  tx("proxy allows sBTC on the treasury", DEPLOYER, PROXY_ID, "allow-sbtc", [], ok);

  // ---- setter: auth, bound, ok, print, get-config ----
  config("S0 get-config: pyth-fee-budget defaults to u0", (v) => field(v, "pyth-fee-budget") === "u0");
  tx("S1 stranger set-pyth-fee-budget 10 -> u16000", STRANGER, VAULT_ID, "set-pyth-fee-budget", [uintCV(10)], "(err u16000)");
  budget(MAX_BUDGET + 1n, "(err u16033)");
  const setMax = budget(MAX_BUDGET);
  config("S2 get-config: pyth-fee-budget = 10 STX", (v) => field(v, "pyth-fee-budget") === `u${MAX_BUDGET}`);
  budget(0n);
  config("S3 get-config: pyth-fee-budget back to u0", (v) => field(v, "pyth-fee-budget") === "u0");

  // ---- fixture: the live oracle starts charging ----
  const fee0 = ev("F0 live oracle fee on the fork (before)", ORACLE, "(var-get fee)", any);
  ev("F1 fixture: Eval inside pyth-lazer-oracle sets fee u10", ORACLE, `(var-set fee u${FEE})`, any);
  ev("F2 oracle get-fee = u10", ORACLE, "(get-fee)", `u${FEE}`);
  const recipient = ev("F3 oracle fee recipient", ORACLE, "(get-fee-recipient)", any);

  // ---- a batch in liquidation, the AMMs below the floor, a bid on the book ----
  toTreasury(`whale sends ${FUND} sats to the treasury`, FUND);
  tx("proxy set-window-blocks 0: liquidation at once", DEPLOYER, PROXY_ID, "set-window", [uintCV(0)], "(ok true)");
  tx(`proxy set-slippage-bps ${SLIPPAGE}: floor mid - 0.5%`, DEPLOYER, PROXY_ID, "set-slippage", [uintCV(SLIPPAGE)], "(ok true)");
  tx("fund-from-treasury opens a batch", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND})`) && v.includes("(opened true)"));
  tx(`fixture: an sBTC whale routes up to ${DUMP} sats down to mid - 1% (min-out 0)`, SBTC_WHALE, ROUTER_ID, "smart-swap-sbtc-for-stx", [uintCV(DUMP), uintCV((MID * 9900n) / 10000n), someCV(UPD), uintCV(MID), uintCV(0)], ok);
  tx(`STX whale rests a ${BID_STX / 1_000_000n} STX bid at any price`, STX_WHALE, MKT_ID, "deposit-token-y", [uintCV(BID_STX), uintCV(HUGE), noneCV(), wstxT, stringAsciiCV("wstx")], `(ok u${BID_STX})`);
  stxBal("vault STX = 0", VAULT_ID, "u0");

  // ---- budget 0, no STX in the vault ----
  const r0 = routerSwap("A1 budget 0, vault STX 0: router-swap -> (err u1) (the vault cannot pay its refresh-mid fee)", "(err u1)");
  const t0 = jingTake("A2 budget 0, vault STX 0: jing-take aborts", isErr);
  status(`A3 vault still holds ${FUND} sats`, (v) => field(v, "sbtc-balance") === `u${FUND}`);

  // ---- budget 0 with a float: the allowance blocks the fee ----
  stxTo(`DAO float: ${FLOAT} uSTX into the vault`, STX_WHALE, VAULT_ID, FLOAT);
  const r1 = routerSwap("B1 budget 0, float: router-swap aborts on the as-contract? STX allowance", (v) => isErr(v) && v !== "(err u16047)");
  const t1 = jingTake("B2 budget 0, float: jing-take aborts on the as-contract? STX allowance", isErr);
  budget(FEE - 1n);
  const t2 = jingTake(`B3 budget ${FEE - 1n} = fee - 1: jing-take aborts on vault-mid's allowance`, isErr);
  const r2 = routerSwap(`B3b budget ${FEE - 1n} = fee - 1: router-swap aborts on vault-mid's allowance`, isErr);
  status(`B4 vault still holds ${FUND} sats`, (v) => field(v, "sbtc-balance") === `u${FUND}`);
  stxBal(`B5 vault STX still ${FLOAT}`, VAULT_ID, `u${FLOAT}`);

  // ---- budget >= fee: both paths work and pay exactly the fee ----
  budget(PER_FILL);
  const fuel1 = tx(`D1 budget ${PER_FILL}, float 1 STX: stranger fuel-fair-book sweeps all but the budget`, STRANGER, VAULT_ID, "fuel-fair-book", [], (v) => ok(v) && v.includes(`(amount u${FLOAT - PER_FILL})`));
  stxBal(`D2 vault keeps exactly the ${PER_FILL} uSTX budget`, VAULT_ID, `u${PER_FILL}`);
  tx("D3 balance = budget: fuel-fair-book -> u16006 (nothing above the reserve)", STRANGER, VAULT_ID, "fuel-fair-book", [], "(err u16006)");
  const sA = stxBal("C0 vault STX before router-swap", VAULT_ID);
  const eA = stxBal("E0 the fresh caller holds 0 STX", EMPTY, "u0");
  const rA = routerSwap(`C1 budget ${PER_FILL} = 2 x fee: a 0-STX caller runs router-swap, it fills through the book leg`, (v) => ok(v) && v.includes(`(amount u${FUND})`), EMPTY);
  const sB = stxBal("C2 vault STX after router-swap", VAULT_ID);
  stxBal("E1 the caller still holds 0 STX: the vault paid both verifies", EMPTY, "u0");
  status("C3 vault empty after the sale", (v) => field(v, "sbtc-balance") === "u0" && field(v, "empty") === "true");
  toTreasury(`whale sends ${FUND} more sats to the treasury`, FUND);
  tx("fund-from-treasury opens the next batch", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes("(opened true)"));
  tx("D4 stranger fuel-fair-book sweeps the router-swap proceeds, keeps the budget", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  stxBal(`D5 vault keeps exactly the ${PER_FILL} uSTX budget`, VAULT_ID, `u${PER_FILL}`);
  const sC = stxBal("C4 vault STX before jing-take", VAULT_ID);
  const tA = jingTake(`C5 budget ${PER_FILL} = 2 x fee: jing-take fills the bid`, (v) => ok(v) && v.includes(`(amount u${FUND})`));
  const sD = stxBal("C6 vault STX after jing-take", VAULT_ID);
  status("C7 vault sBTC 0 after the take", (v) => field(v, "sbtc-balance") === "u0");

  // ---- clean up ----
  ev("fixture: oracle fee back to its live value", ORACLE, "(var-set fee u0)", any);
  budget(0n);
  tx("fuel-fair-book sweeps the float and proceeds", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  stxBal("vault STX 0 after the sweep (the float goes with it)", VAULT_ID, "u0");

  // ---- run ----
  const sid = await b.run();
  console.log(`View: https://stxer.xyz/simulations/mainnet/${sid}\n`);
  const res = await getSimulationResult(sid);
  const s = res.steps; let i = 0;
  for (const p of plan) {
    if (p.kind === "deploy" || p.kind === "patch") {
      const st = s[i++]; const r = st?.Result || {};
      const okStep = !("Err" in (r.SetContractCode || r.Transaction || {})) && !r.Transaction?.Ok?.vm_error;
      check(p.label, okStep ? "ok" : JSON.stringify(r).slice(0, 160), "ok");
      continue;
    }
    while (i < s.length && !s[i]?.Result?.Transaction && !s[i]?.Result?.Eval) i += 1;
    p.step = s[i];
    p.raw = p.kind === "tx" ? decodeTx(s[i]) : decodeEval(s[i]); i += 1;
    if (p.want?.observe) { console.log(`  ..   ${p.label}: ${String(p.raw).slice(0, 200)}`); continue; }
    check(p.label, p.raw, p.want);
  }

  const R = String(recipient.raw);
  console.log(`  ..   live fee before the fixture: ${fee0.raw}; recipient ${R}`);
  const setPrints = printsOf(eventsOf(setMax.step), VAULT_ID);
  check("S2 set-pyth-fee-budget printed its notification and value", setPrints.join(" | "), () => setPrints.some(x => x.includes('"set-pyth-fee-budget"') && x.includes(`(value u${MAX_BUDGET})`)));
  // A1 and A2: (err u1) is stx-transfer?'s insufficient-balance code from the
  // oracle (the vault's refresh-mid fee); B: (err u0) is vault-mid's
  // as-contract? violation index of its only slot, with-stx
  console.log(`  ..   A2 jing-take ${t0.raw}; B1 router-swap ${r1.raw}; B2 jing-take ${t1.raw}; B3 ${t2.raw}; B3b ${r2.raw}`);
  check("B1..B3b abort with vault-mid's with-stx allowance index (err u0)", [r1, t1, t2, r2].map(x => x.raw).join(" "), () => [r1, t1, t2, r2].every(x => x.raw === "(err u0)"));
  // C: each success pays exactly two FEEs from the vault to the oracle's
  // recipient (refresh-mid, then the market swap), and the caller pays none
  for (const [lbl, step, caller] of [["C1 router-swap", rA, EMPTY], ["C5 jing-take", tA, DEPLOYER]]) {
    const moves = stxMoves(eventsOf(step.step));
    const fees = moves.filter(m => m.from === VAULT_ID);
    check(`${lbl}: the vault's only STX outflows are two ${FEE} uSTX fees to the oracle fee recipient`, JSON.stringify(fees.map(m => ({ ...m, amount: String(m.amount) }))), () => fees.length === 2 && fees.every(m => m.amount === FEE && m.to === R));
    check(`${lbl}: the caller sent no STX`, moves.filter(m => m.from === caller).length, (n) => n === 0);
  }
  const rPrint = printsOf(eventsOf(rA.step), ROUTER_ID).find(x => x.includes("smart-swap-sbtc-for-stx")) || "";
  check("C1 the router's book leg filled (jing-ok true, jing-in > 0)", rPrint.slice(0, 300), () => rPrint.includes("(jing-ok true)") && num(rPrint, "jing-in") > 0n);
  // the router measures `out` as the vault's STX delta over its own call: net of
  // the market's verify inside it, not of current-mid's refresh-mid before it
  check("C1 router out = jing-out - 1 x fee (the market verify inside the router)", `out ${num(rPrint, "out")}, jing-out ${num(rPrint, "jing-out")}`, () => num(rPrint, "out") === num(rPrint, "jing-out") - FEE);
  check("C1 vault STX rose by out - 1 x fee (refresh-mid, outside the router)", `${bare(sA.raw)} -> ${bare(sB.raw)}, out ${num(rA.raw, "out")}`, () => bare(sB.raw) - bare(sA.raw) === num(rA.raw, "out") - FEE);
  check("C5 vault STX rose by out - 2 x fee", `${bare(sC.raw)} -> ${bare(sD.raw)}, out ${num(tA.raw, "out")}`, () => bare(sD.raw) - bare(sC.raw) === num(tA.raw, "out") - PER_FILL);
  const fuelMoves = stxMoves(eventsOf(fuel1.step));
  check("D1 the sweep moved exactly balance - budget to the book", JSON.stringify(fuelMoves.map(m => ({ ...m, amount: String(m.amount) }))), () => fuelMoves.length === 1 && fuelMoves[0].amount === FLOAT - PER_FILL && fuelMoves[0].to === `${DEPLOYER}.${BOOK}`);
  check(`C0 router-swap started from exactly the ${PER_FILL} uSTX reserve`, sA.raw, `u${PER_FILL}`);
  check(`C4 jing-take started from exactly the ${PER_FILL} uSTX reserve`, sC.raw, `u${PER_FILL}`);
  check("A1 router-swap moved no STX from the vault", stxMoves(eventsOf(r0.step)).filter(m => m.from === VAULT_ID).length, (n) => n === 0);

  console.log(`\n${checks - failures}/${checks} checks green`);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${RESULTS_DIR}/pyth-fee.json`, JSON.stringify({ simulationId: sid, url: `https://stxer.xyz/simulations/mainnet/${sid}`, checks, failures, mid: String(MID), sourceHashes, results, plan: plan.map(({ want, step, ...p }) => p), result: res }, null, 2) + "\n");
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
