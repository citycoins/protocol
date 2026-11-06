// stxer-ccd016-v2-maker-spread.js
// stxer MAINNET-FORK proof (nothing is broadcast) for ccd016-swap-vault-mia-v2
// maker-spread-bps (0462e6a, default u1, max u50) on the LIVE Jing stack:
// markets-sbtc-stx-jing-v6-4 + swap-router-sbtc-stx-jing-v5-5 + the seated
// jing-{buy,sell}-stx-* rungs, at their real principals and live state. The
// older v2 harnesses deploy a fresh v6-3 stack and cannot run against v6-4.
//
// Claims (bounty mv8wal, Cunning Nexus #2 ported to the MIA vault):
//   A. On the live book (jing-buy-stx-0 rests an sBTC ask pegged at the mid,
//      spread (some u0)), a stranger's jing-place goes pending and the keeper's
//      settle-token-x-deposit RESTS it at mid + 1 bp: deposit-x, no refund.
//   B. Gist condition: a taker eats buy-0 (and part of the vault at mid+1bp),
//      then a real STX holder rests a bid AT the mid on Y. A refloor at the
//      var (u1) settles; with the var set to u0 the same refloor is refused
//      "crossing" and the order stays at (some u1). A top-up jing-place at u1
//      under that bid also rests (not refunded "crossing").
//   C. set-maker-spread-bps: stranger and the deployer refused u16000; the DAO
//      path (an enabled extension) sets u50, refuses u51 with u16033;
//      get-config shows the value.
//
// FIXTURES (disclosed):
//   - base-dao is patched (SetContractCode) so is-extension is true for the
//     vault (treasury withdraw-ft) and for sim-dao-proxy, which plays a passed
//     proposal forwarding the DAO-only calls (same as the other v2 harnesses).
//   - DIA is pushed from its real updater key with the Lazer prices.
//   - The reward is a real sBTC transfer from a holder into the MIA rewards
//     treasury; fund-from-treasury runs its real code.
// Prices are real signed Pyth Lazer updates (fetchLazerUpdateAny), each newer
// than the fork clock. Senders: DEP as the keeper that settles on mainnet.
// Run from the repo root: node simulations/stxer-ccd016-v2-maker-spread.js
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  ClarityVersion, uintCV, noneCV, someCV, listCV, tupleCV, stringAsciiCV, bufferCV, falseCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString,
} from "@stacks/transactions";
import { SimulationBuilder, getSimulationResult, getSimulationTip, submitSimulationSteps, callContract } from "stxer";

const JING_SIM = process.env.JING_SIM || `${process.env.HOME}/projects/jing-contracts-v3/simulations`;
const { fetchLazerUpdateAny, lazerFeedTimes } = await import(`${JING_SIM}/_lazer.js`);
const NODE = process.env.STACKS_API_URL || "http://77.42.3.101/stacks-api";
process.env.STACKS_API_URL ||= NODE;

const DEP = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
const KEEPER = DEP;
const SBTC_WHALE = "SP2C7BCAP2NH3EYWCCVHJ6K0DMZBXDFKQ56KR7QN2";
const STX_WHALE = "SP9BP4PN74CNR5XT7CMAMBPA0GWC9HMB69HVVV51";
const STRANGER = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM";
const DIA_UPDATER = "SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0";
const DAO = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
const BASE_DAO = `${DAO}.base-dao`;
const TREASURY = `${DAO}.ccd002-treasury-mia-rewards-v3`;
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const WSTX = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2";
const DIA = `${DIA_UPDATER}.dia-oracle`;
const MK = `${DEP}.markets-sbtc-stx-jing-v6-4`, ROUTER = `${DEP}.swap-router-sbtc-stx-jing-v5-5`;
const B0 = `${DEP}.jing-buy-stx-0`;
const BOOK = "ccd015-redemption-book-mia-stx", VAULT = "ccd016-swap-vault-mia-v2", PROXY = "sim-dao-proxy";
const V = `${DEP}.${VAULT}`, PX = `${DEP}.${PROXY}`;
const P = (s) => (s.includes(".") ? contractPrincipalCV(...s.split(".")) : standardPrincipalCV(s));
const sbtcT = P(SBTC), wstxT = P(WSTX);
const FUND = 100_000n, TOPUP = 10_000n, HUGE = 999_999_999_999_999n;

// ---- sources: repo bytes, comment-only lines stripped (deploy form) ----
const strip = (f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*;;/.test(l)).join("\n");
const vaultFile = `contracts/extensions/${VAULT}.clar`;
const vaultSrc = strip(vaultFile), bookSrc = strip(`contracts/extensions/${BOOK}.clar`);
if (!vaultSrc.includes(`'${MK})`) || !vaultSrc.includes(`'${ROUTER})`)) throw new Error("vault does not bind live market v6-4 / router v5-5");
if (!/\(define-data-var maker-spread-bps uint u1\)/.test(vaultSrc)) throw new Error("vault has no maker-spread-bps var at u1");
const vaultSha = createHash("sha256").update(fs.readFileSync(vaultFile)).digest("hex");
const PROXY_SRC = `
(define-public (is-dao-or-extension) (ok true))
(define-public (callback (sender principal) (memo (buff 34))) (ok true))
(define-public (allow-sbtc) (contract-call? '${TREASURY} set-allowed '${SBTC} true))
(define-public (refloor (update (buff 8192))) (contract-call? '${V} jing-refloor update))
(define-public (set-spread (bps uint)) (contract-call? '${V} set-maker-spread-bps bps))
`;
const fetchJson = async (p) => { const r = await fetch(`${NODE}${p}`); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const baseDaoSrc = (await fetchJson(`/extended/v1/contract/${BASE_DAO}`)).source_code;
const needle = "(default-to false (map-get? Extensions extension))";
if (!baseDaoSrc.includes(needle)) throw new Error("base-dao is-extension body changed; update the patch");
const baseDaoPatched = baseDaoSrc.replace(needle, `(or (default-to false (map-get? Extensions extension)) (is-eq extension '${V}) (is-eq extension '${PX}))`);

// ---- helpers (C4 pattern) ----
const cv = (hex) => cvToString(deserializeCV(hex));
const decode = (step) => {
  const r = step?.Result ?? step;
  if (r?.Eval) return "Ok" in r.Eval ? cv(r.Eval.Ok) : `EVAL-ERR ${JSON.stringify(r.Eval.Err).slice(0, 300)}`;
  if (r?.Transaction?.Ok) { const t = r.Transaction.Ok; if (t.vm_error || t.post_condition_aborted) return `ENGINE-ERR ${JSON.stringify(t).slice(0, 300)}`; return cv(t.result); }
  if (r?.SetContractCode) return "Err" in r.SetContractCode ? `ENGINE-ERR ${JSON.stringify(r.SetContractCode)}` : "ok";
  return `ENGINE-ERR ${JSON.stringify(r).slice(0, 300)}`;
};
let sid, n = 0, passed = 0;
const fails = [], log = [];
function check(id, label, actual, want, wantDesc) {
  n++;
  const good = typeof want === "function" ? !!want(actual) : actual === want;
  if (good) passed++; else fails.push(`${id} ${label}`);
  const exp = wantDesc ?? (typeof want === "function" ? "predicate" : want);
  log.push({ id, label, passed: good, expected: String(exp), actual: String(actual) });
  console.log(`[${good ? "PASS" : "FAIL"}] ${id} ${label}\n         expected: ${exp}\n         actual:   ${String(actual).slice(0, 500)}`);
  return good;
}
async function ev(id, label, cid, code, want, wantDesc) {
  const out = await submitSimulationSteps(sid, { steps: [{ Eval: [DEP, "", cid, code] }] });
  const v = decode(out.steps[0]);
  if (want !== undefined) check(id, label, v, want, wantDesc);
  return v;
}
const prints = (r) => (r.receipt?.events ?? []).map((e) => (typeof e === "string" ? JSON.parse(e) : e))
  .filter((e) => e.contract_event?.raw_value).map((e) => `${e.contract_event.contract_identifier}: ${cv(e.contract_event.raw_value)}`).join(" | ");
async function tx(id, label, sender, contract, fn, args, want, wantDesc) {
  const r = await callContract(sid, { sender, contract, functionName: fn, functionArgs: args, fee: 0 });
  const v = r.vmError || r.pcAborted ? `ENGINE-ERR ${JSON.stringify({ vm: r.vmError, pc: r.pcAborted }).slice(0, 300)}` : r.result;
  check(id, label, v, want, wantDesc);
  r.v = v;
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function freshUpdate(notBefore, label) {
  for (let i = 0; i < 400; i++) {
    const now = Date.now() / 1000;
    if (now < notBefore + 2) { await sleep(Math.min(15_000, (notBefore + 3 - now) * 1000)); continue; }
    const u = await fetchLazerUpdateAny();
    const at = (await lazerFeedTimes(u.hex)).at;
    if (at > notBefore) {
      const mid = (u.px * 100_000_000n) / u.py;
      console.log(`lazer ${label}: feeds at ${at} (fork clock ${notBefore}), mid ${mid}`);
      return { cv: bufferCV(Buffer.from(u.hex.replace(/^0x/, ""), "hex")), at, mid, px: u.px, py: u.py };
    }
    await sleep(2000);
  }
  throw new Error("no Lazer update newer than the fork clock");
}
const has = (...ss) => (v) => ss.every((s) => v.includes(s));
const U = (v) => BigInt(String(v).match(/u(\d+)/)?.[1] ?? "-1");
const cyc = "(get-current-cycle)";
const xdep = (p) => `(get-token-x-deposit ${cyc} '${p})`;
const ok = (v) => String(v).startsWith("(ok");

// ---- SETUP: one session at the live tip ----
const tipBlock = (await fetchJson("/extended/v1/block?limit=1")).results[0];
let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(tipBlock.height).withSender(DEP);
const plan = [];
const add = (id, label, f, want) => { b = f(b); plan.push({ id, label, want }); };
const deploy = (name, src) => (bb) => bb.withSender(DEP).addContractDeploy({ contract_name: name, source_code: src, clarity_version: ClarityVersion.Clarity6 });
add("S1", `deploy ${BOOK} (repo, comments stripped)`, deploy(BOOK, bookSrc), (v) => !v.includes("ERR"));
add("S2", `deploy ${VAULT} (repo 3b04ed5, comments stripped)`, deploy(VAULT, vaultSrc), (v) => !v.includes("ERR"));
add("S3", `deploy ${PROXY} (passed-proposal stand-in)`, deploy(PROXY, PROXY_SRC), (v) => !v.includes("ERR"));
add("S4", "FIXTURE patch base-dao: is-extension true for the vault + proxy", (bb) => bb.addSetContractCode({ contract_id: BASE_DAO, source_code: baseDaoPatched, clarity_version: ClarityVersion.Clarity1 }), "ok");
sid = await b.run();
console.log(`stxer: https://stxer.xyz/simulations/mainnet/${sid}`);
const setup = (await getSimulationResult(sid)).steps.filter((s) => s.Result?.Transaction || s.Result?.Eval || s.Result?.SetContractCode);
plan.forEach((s, i) => check(s.id, s.label, decode(setup[i]), s.want, typeof s.want === "string" ? s.want : "deployed"));
if (fails.length) { console.log("\nRESULT: FAIL (setup)"); process.exit(1); }

const tip0 = await getSimulationTip(sid);
console.log(`fork: stacks ${tip0.stacks_height} burn ${tip0.burn_height} time ${tip0.block_time}`);
const u1 = await freshUpdate(Number(tip0.block_time), "update 1");
const mid = u1.mid, ask = (mid * 10001n) / 10000n;
const diaPush = listCV([
  tupleCV({ key: stringAsciiCV("STX/USD"), value: uintCV(u1.py), timestamp: uintCV(BigInt(tip0.block_time) * 1000n) }),
  tupleCV({ key: stringAsciiCV("BTC/USD"), value: uintCV(u1.px), timestamp: uintCV(BigInt(tip0.block_time) * 1000n) }),
]);
await tx("S5", "FIXTURE DIA: real updater pushes the Lazer prices", DIA_UPDATER, DIA, "set-multiple-values", [diaPush], "(ok true)");
await tx("S6", "proxy allows sBTC on the treasury (idempotent)", DEP, PX, "allow-sbtc", [], ok, "(ok ...)");

// ---- L: the live book on the fork ----
await ev("L1", "live: jing-buy-stx-0 rests sBTC on X", MK, xdep(B0), (v) => /^u[1-9]/.test(v), "u > 0");
await ev("L2", "live: its order is a peg at spread (some u0)", MK, `(get-token-x-order '${B0})`, has("(spread-bps (some u0))"));
await ev("L3", "live: its ask at the update mid = the mid", MK, `(token-x-limit-at '${B0} u${mid})`, `u${mid}`);
await ev("L4", "live: the Y list is non-empty (X deposits go pending)", MK, `(> (len (get-token-y-depositors ${cyc})) u0)`, "true");
await ev("L5", "baseline: no live Y bid at the mid (would-take-as-x mid, mid)", MK, `(would-take-as-x u${mid} u${mid})`, "false");
await ev("L6", "baseline: buy-0's ask at the mid makes would-take-as-y(mid, mid) true", MK, `(would-take-as-y u${mid} u${mid})`, "true");

// ---- C: setter auth + bounds + config ----
await ev("C0", "get-config: maker-spread-bps u1 (default), live market + router", V, "(get-config)", has("(maker-spread-bps u1)", `(jing-market ${MK})`, `(jing-router ${ROUTER})`));
await tx("C1", "stranger set-maker-spread-bps direct: u16000", STRANGER, V, "set-maker-spread-bps", [uintCV(0)], "(err u16000)");
await tx("C2", "deployer set-maker-spread-bps direct (not the DAO): u16000", DEP, V, "set-maker-spread-bps", [uintCV(0)], "(err u16000)");
await tx("C3", "DAO path (extension) u51 > MAX u50: u16033", DEP, PX, "set-spread", [uintCV(51)], "(err u16033)");
await tx("C4", "DAO path u50 (the max)", DEP, PX, "set-spread", [uintCV(50)], "(ok true)");
await ev("C5", "get-config shows u50", V, "(get maker-spread-bps (get-config))", "u50");
await tx("C6", "DAO path back to u1", DEP, PX, "set-spread", [uintCV(1)], "(ok true)");
await ev("C7", "get-config shows u1", V, "(get maker-spread-bps (get-config))", "u1");

// ---- A: place next to the live spread-0 ask ----
const toTreasury = (amt) => [uintCV(amt), P(SBTC_WHALE), P(TREASURY), noneCV()];
await tx("A1", `real sBTC holder sends ${FUND} sats to the MIA rewards treasury`, SBTC_WHALE, SBTC, "transfer", toTreasury(FUND), "(ok true)");
await tx("A2", "stranger fund-from-treasury: empty vault, window opens", STRANGER, V, "fund-from-treasury", [], has("(ok", `(amount u${FUND})`, "(opened true)"));
await tx("A3", "stranger jing-place(update)", STRANGER, V, "jing-place", [u1.cv], has("(ok", `(amount u${FUND})`));
await ev("A4", "pending escrow carries spread-bps (some u1)", MK, `(get-token-x-pending-deposit '${V})`, has("(some", "(spread-bps (some u1))", `(amount u${FUND})`));
let r = await tx("A5", "keeper settle-token-x-deposit(vault, update)", KEEPER, MK, "settle-token-x-deposit", [P(V), u1.cv, sbtcT, stringAsciiCV("sbtc-token")], `(ok u${FUND})`);
check("A6", "settle placed it: deposit-x event, no pending-refund", prints(r), (v) => v.includes('"deposit-x"') && !v.includes("pending-refund"), "deposit-x, no pending-refund-x");
await ev("A7", "vault rests on X at spread (some u1)", MK, `{ dep: ${xdep(V)}, order: (get-token-x-order '${V}) }`, has(`(dep u${FUND})`, "(spread-bps (some u1))"));
await ev("A8", "its ask at the mid = mid + 1 bp", MK, `(token-x-limit-at '${V} u${mid})`, `u${ask}`);
await ev("A9", "buy-0 still at the mid, next to it", MK, `(token-x-limit-at '${B0} u${mid})`, `u${mid}`);
await ev("A10", "get-status: resting, nothing escrowed", V, "(get-status)", has(`(jing-resting u${FUND})`, "(jing-escrowed u0)"));

// ---- B: the gist condition (a Y bid AT the mid) ----
const d0 = U(await ev("B0", "buy-0 sats before the taker", MK, xdep(B0), (v) => /^u[1-9]/.test(v), "u > 0"));
// net = amount * 1e4 / (1e4 + 20); sats bought at price p = net * 1e10 / p.
// Size: all of buy-0 at the mid plus ~20k sats of the vault at mid+1bp.
const WANT_V = 20_000n;
const net = ((d0 * mid) + (WANT_V * ask)) / 10_000_000_000n + 2n;
const amount = (net * 10_020n) / 10_000n + 1n;
r = await tx("B1", `real STX holder swaps ${amount} uSTX for sBTC, limit mid + 1 bp (eats buy-0, then the vault)`, STX_WHALE, MK, "swap",
  [uintCV(amount), uintCV(ask), u1.cv, sbtcT, stringAsciiCV("sbtc-token"), wstxT, stringAsciiCV("wstx"), falseCV()], ok, "(ok ...)");
const matches = prints(r).split(" | ").filter((e) => e.includes('"match"'));
console.log(`         match events: ${matches.map((e) => e.slice(0, 260)).join("\n                       ")}`);
check("B2", "the walk matched the vault at mid + 1 bp", matches.find((e) => e.includes(V)) ?? "", has(`(price u${ask})`), `match with maker ${V} at u${ask}`);
await ev("B3", "buy-0 emptied (no X ask at or below the mid)", MK, `(would-take-as-y u${mid} u${mid})`, "false");
const rest = U(await ev("B4", "vault still rests part of the batch", MK, xdep(V), (v) => U(v) > 0n && U(v) < FUND, `0 < u < ${FUND}`));
r = await tx("B5", "real STX holder bids 300 STX pegged AT the mid (spread (some u0)) on Y", STX_WHALE, MK, "deposit-token-y", [uintCV(300_000_000), uintCV(HUGE), someCV(uintCV(0)), wstxT, stringAsciiCV("wstx")], (v) => ok(v), "(ok ...)");
if (r.v.startsWith("(ok") && (await ev("B5a", "is the bid pending (X list non-empty)?", MK, `(is-some (get-token-y-pending-deposit '${STX_WHALE}))`)) === "true") {
  r = await tx("B6", "keeper settle-token-y-deposit(bidder, update)", KEEPER, MK, "settle-token-y-deposit", [P(STX_WHALE), u1.cv, wstxT, stringAsciiCV("wstx")], ok, "(ok ...)");
  check("B7", "the at-mid bid rested (vault ask at mid+1bp does not cross it)", prints(r), (v) => v.includes('"deposit-y"') && !v.includes("pending-refund"), "deposit-y, no pending-refund-y");
}
await ev("B8", "gist condition live: a Y bid at the mid (would-take-as-x mid, mid)", MK, `(would-take-as-x u${mid} u${mid})`, "true");
await ev("B9", "an ask 1 bp above the mid would not take", MK, `(would-take-as-x u${mid} u${ask})`, "false");
// refloor at the var (u1)
r = await tx("B10", "DAO refloor at the var (u1) -> goes pending", DEP, PX, "refloor", [u1.cv], has("(ok", `(resting u${rest})`));
r = await tx("B11", "keeper settle-token-x-limit(vault): settles", KEEPER, MK, "settle-token-x-limit", [P(V), u1.cv], "(ok true)");
// control: var at u0
await tx("B12", "CONTROL DAO set-maker-spread-bps u0", DEP, PX, "set-spread", [uintCV(0)], "(ok true)");
r = await tx("B13", "CONTROL DAO refloor at u0 -> goes pending", DEP, PX, "refloor", [u1.cv], ok, "(ok ...)");
await ev("B14", "CONTROL pending limit carries spread (some u0): the refloor reads the var", MK, `(get-token-x-pending-limit '${V})`, has("(some", "(spread-bps (some u0))"));
r = await tx("B15", "CONTROL keeper settle-token-x-limit", KEEPER, MK, "settle-token-x-limit", [P(V), u1.cv], "(ok false)");
check("B16", 'CONTROL u0 refloor is refused "crossing"', prints(r), has('(reason "crossing")'), 'reason "crossing"');
await ev("B17", "CONTROL vault order unchanged at (some u1), still resting", MK, `{ dep: ${xdep(V)}, order: (get-token-x-order '${V}) }`, has(`(dep u${rest})`, "(spread-bps (some u1))"));
await tx("B18", "DAO set-maker-spread-bps back to u1", DEP, PX, "set-spread", [uintCV(1)], "(ok true)");
// top-up placement at u1 under the at-mid bid
await tx("B19", `real sBTC holder sends ${TOPUP} sats to the treasury`, SBTC_WHALE, SBTC, "transfer", toTreasury(TOPUP), "(ok true)");
await tx("B20", "fund-from-treasury while resting: joins, opens nothing", STRANGER, V, "fund-from-treasury", [], has("(ok", `(amount u${TOPUP})`, "(opened false)"));
await tx("B21", "stranger jing-place the top-up under the at-mid bid", STRANGER, V, "jing-place", [u1.cv], has("(ok", `(amount u${TOPUP})`));
r = await tx("B22", "keeper settle-token-x-deposit(vault)", KEEPER, MK, "settle-token-x-deposit", [P(V), u1.cv, sbtcT, stringAsciiCV("sbtc-token")], `(ok u${TOPUP})`);
check("B23", 'top-up rested: deposit-x, not refunded "crossing"', prints(r), (v) => v.includes('"deposit-x"') && !v.includes("pending-refund"), "deposit-x, no pending-refund-x");
await ev("B24", "vault rests rest + top-up at mid + 1 bp", MK, `{ dep: ${xdep(V)}, px: (token-x-limit-at '${V} u${mid}) }`, has(`(dep u${rest + TOPUP})`, `(px u${ask})`));

console.log(`\n${passed}/${n} checks passed${fails.length ? `; FAILED: ${fails.join("; ")}` : ""}`);
console.log(`RESULT: ${fails.length ? "FAIL" : "PASS"}`);
console.log(`https://stxer.xyz/simulations/mainnet/${sid}`);
const RESULTS_DIR = process.env.SIM_RESULTS_DIR || "simulations/results/ccd016-v2";
fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.writeFileSync(`${RESULTS_DIR}/maker-spread.json`, JSON.stringify({ simulationId: sid, url: `https://stxer.xyz/simulations/mainnet/${sid}`, fork: tip0, mid: String(mid), vaultSourceSha256: vaultSha, checks: n, passed, fails, log }, null, 2) + "\n");
process.exit(fails.length ? 1 : 0);
