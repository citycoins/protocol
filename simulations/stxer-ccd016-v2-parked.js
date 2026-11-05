// Updated for exact core-v6 / ladder-v1 / market-v6-3 / router-v5-3.
// Real signed update, unchanged freshness; synthetic burn blocks use one-second intervals.
import {freshProofAfter} from './_jing-v6-3.mjs';
// stxer-ccd016-v2-parked.js
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
// The vault PARKED on the v6-3 book. A full-side entrant submits first;
// settlement parks a displaced incumbent or refunds a refused entrant. Since 2026-09-14 (jing d1b32bd) an in-range
// resident can only be parked by a bigger IN-RANGE newcomer when nobody on
// the side is out of range (the core's size rule among everyone); an
// out-of-range newcomer fights inside the out-of-range region only. So the
// book here is all in range: the open region is 40 makers (50 slots minus
// the 10 seats the market reserves for band rungs), 39 fillers rest
// 2,000-sat zero-spread pegs, the vault rests 1,000 (the market minimum),
// a 5,000-sat in-range newcomer arrives: the vault, smallest, is parked.
//   P1 status shows jing-parked 1000, jing-resting 0, not empty
//   P2 the DAO reclaims mid-window: the parked amount comes home
//   P3 jing-place again on the full in-range side with the smallest size:
//      settlement refunds (queue-full), the sats come home; a filler leaves,
//      jing-place lands; a fresh in-range 5,000 parks the vault again
//   P4 Sonic Mast's case: a stranger readmits the vault's parked sats
//      through the market's readmit-token-x once there is room: back on
//      the book at the mid, harmless
//   P5 another fresh in-range maker parks it once more, the window
//      elapses, jing-reclaim by anyone brings the PARKED amount home,
//      router-swap sells it, empty, clock cleared
// Run: PYTH_API_KEY=<key> node simulations/stxer-ccd016-v2-coverage.js
import fs from "node:fs";
import {createHash} from "node:crypto";
import {fetchLazerUpdateAny} from "./_vault-lazer.mjs";
import {
  ClarityVersion, uintCV, boolCV, noneCV, someCV, listCV, tupleCV, stringAsciiCV, bufferCV, trueCV, falseCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString, getAddressFromPrivateKey,
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
const FILLERS = Array.from({ length: 41 }, (_, i) => getAddressFromPrivateKey((i + 300).toString(16).padStart(64, "0") + "01", "mainnet"));
const FILL = 2_000n;
const FUND = 1_000n; // the market minimum: the vault is the SMALLEST maker on the side, the one the size rule parks
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
(define-public (reclaim) (contract-call? '${VAULT_ID} dao-reclaim none))
`;

let checks = 0, failures = 0;
function check(label, actual, want) {
  checks += 1;
  const ok = typeof want === "function" ? want(actual) : want instanceof RegExp ? want.test(String(actual)) : String(actual) === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual).slice(0, 170)}${ok ? "" : ` (want ${typeof want === "function" ? want.toString().slice(0, 90) : want})`}`);
}

async function main() {
  console.log("=== ccd016-swap-vault-mia-v2 PARKED on the v6 book: reclaim, re-place, readmit (mainnet fork, Lazer) ===");
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

  // ---- builder with a plan ----
  const plan = [];
  let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(tip.height);
  const deploy = (name, code, cv = ClarityVersion.Clarity6) => { b = b.withSender(DEPLOYER).addContractDeploy({ contract_name: name, source_code: code, clarity_version: cv }); plan.push({ kind: "deploy", label: `deploy ${name}` }); };
  const patch = (cid, code, label, cv) => { b = b.addSetContractCode({ contract_id: cid, source_code: code, clarity_version: cv }); plan.push({ kind: "patch", label }); };
  const tx = (label, sender, cid, fn, args, want) => { if (fn === "jing-reclaim" && args.length === 0) args = [noneCV()]; if (/^deposit-token-[xy]$/.test(fn) && args.length === 6) args = args.filter((_, i) => i !== 3); if (/^readmit-token-[xy]$/.test(fn)) args = args.slice(0, 1); b = b.withSender(sender).addContractCall({ contract_id: cid, function_name: fn, function_args: args }); plan.push({ kind: "tx", label, want }); };
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
  const status = (label, want) => ev(label, VAULT_ID, "(get-status)", want);
  const clock = (label, want) => ev(label, VAULT_ID, "(get-clock)", want);
  const FLOOR9 = (MID * 90n) / 100n; // every filler and newcomer is a zero-spread peg (some u0), floor 10% under: in range at the mid
  const PEG = (sats) => [uintCV(sats), uintCV(FLOOR9), someCV(uintCV(0)), UPD, sbtcT, stringAsciiCV("sbtc-token")];
  const sbtcXfer = (label, to, sats) => tx(label, SBTC_WHALE, SBTC, "transfer", [uintCV(sats), standardPrincipalCV(SBTC_WHALE), to, noneCV()], "(ok true)");

  // ---- P0 the vault rests 1,000 sats, 49 fillers 2,000 each: the side is full ----
  sbtcXfer("P0 whale sends 1,000 sats to the treasury", contractPrincipalCV(trAddr, trName), FUND);
  tx("P0 fund-from-treasury -> window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes("(opened true)"));
  tx("P0 stranger jing-place: 1,000 sats rest as the peg", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  for (const [i, f] of FILLERS.slice(0, 39).entries()) {
    sbtcXfer(`P0 fund filler ${i + 1}`, standardPrincipalCV(f), FILL);
    tx(`P0 filler ${i + 1} rests a 2,000-sat peg at the mid`, f, MKT_ID, "deposit-token-x", PEG(FILL), `(ok u${FILL})`);
  }
  ev("P0 x side full: 40 makers (50 minus 10 reserved seats)", MKT_ID, "(len (get-token-x-depositors u0))", "u40");
  status("P0 vault: 1,000 resting", (v) => field(v, "jing-resting") === `u${FUND}` && field(v, "jing-parked") === "u0");

  // ---- P1 a bigger in-range newcomer, nobody out of range: the core's size rule parks the smallest, the vault ----
  tx("P1 newcomer (whale) rests a 5,000-sat peg at the mid on the full side", SBTC_WHALE, MKT_ID, "deposit-token-x", PEG(5_000n), "(ok u5000)");
  tx("settle full-side entrant before checking parking", STRANGER, MKT_ID, "settle-token-x-deposit", [standardPrincipalCV(SBTC_WHALE), UPD, sbtcT, stringAsciiCV("sbtc-token")], "(ok u5000)");
  ev("P1 the vault is parked with its 1,000 sats", MKT_ID, `(get-token-x-parked '${VAULT_ID})`, `u${FUND}`);
  ev("P1 nothing of the vault rests", MKT_ID, `(get-token-x-deposit u0 '${VAULT_ID})`, "u0");
  status("P1 status: parked 1,000, resting 0, not empty", (v) => field(v, "jing-parked") === `u${FUND}` && field(v, "jing-resting") === "u0" && field(v, "sbtc-balance") === "u0" && field(v, "empty") === "false");
  ev("P1 x side still 40", MKT_ID, "(len (get-token-x-depositors u0))", "u40");

  // ---- P2 the DAO reclaims a PARKED position mid-window ----
  tx("P2 stranger jing-reclaim while open -> u16031", STRANGER, VAULT_ID, "jing-reclaim", [], "(err u16031)");
  tx("P2 proxy dao-reclaim: the parked amount comes home", DEPLOYER, PROXY_ID, "reclaim", [], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("P2 1,000 home, parked 0", (v) => field(v, "sbtc-balance") === `u${FUND}` && field(v, "jing-parked") === "u0" && field(v, "jing-resting") === "u0");

  // ---- P3 re-place on the full in-range side ----
  tx("P3 jing-place again: the smallest size on a full in-range side -> submit first, then queue-full refund", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v));
  tx("P3 settle too-small entrant refunds escrow", STRANGER, MKT_ID, "settle-token-x-deposit", [contractPrincipalCV(DEPLOYER, VAULT), UPD, sbtcT, stringAsciiCV("sbtc-token")], `(ok u${FUND})`);
  status("P3 1,000 still home", (v) => field(v, "sbtc-balance") === `u${FUND}` && field(v, "jing-resting") === "u0");
  tx("P3 filler 3 cancels: room", FILLERS[2], MKT_ID, "cancel-token-x-deposit", [sbtcT, stringAsciiCV("sbtc-token")], (v) => ok(v));
  tx("P3 jing-place lands", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("P3 1,000 resting again", (v) => field(v, "jing-resting") === `u${FUND}` && field(v, "sbtc-balance") === "u0");
  ev("P3 x side 40 again", MKT_ID, "(len (get-token-x-depositors u0))", "u40");
  const NEW1 = FILLERS[39], NEW2 = FILLERS[40];
  sbtcXfer("P3 fund a fresh maker", standardPrincipalCV(NEW1), 5_000n);
  tx("P3 a fresh 5,000-sat peg at the mid: in range, nobody out of range, the size rule parks the smallest: the vault", NEW1, MKT_ID, "deposit-token-x", PEG(5_000n), "(ok u5000)");
  tx("settle full-side entrant before checking parking", STRANGER, MKT_ID, "settle-token-x-deposit", [standardPrincipalCV(NEW1), UPD, sbtcT, stringAsciiCV("sbtc-token")], "(ok u5000)");
  status("P3 parked 1,000 once more", (v) => field(v, "jing-parked") === `u${FUND}` && field(v, "jing-resting") === "u0");

  // ---- P4 Sonic Mast: a stranger readmits the vault's parked sats ----
  tx("P4 stranger readmit-token-x(vault) on a full side submits", STRANGER, MKT_ID, "readmit-token-x", [contractPrincipalCV(DEPLOYER, VAULT), UPD], `(ok u${FUND})`);
  tx("P4 settle full-side readmit refuses without moving parked funds", STRANGER, MKT_ID, "settle-token-x-readmit", [contractPrincipalCV(DEPLOYER, VAULT), UPD], "(ok u0)");
  tx("P4 filler 1 cancels: room", FILLERS[0], MKT_ID, "cancel-token-x-deposit", [sbtcT, stringAsciiCV("sbtc-token")], (v) => ok(v));
  tx("P4 stranger readmit-token-x(vault): back on the book, nobody asked the vault", STRANGER, MKT_ID, "readmit-token-x", [contractPrincipalCV(DEPLOYER, VAULT), UPD], (v) => ok(v));
  tx("P4 settle readmit into the free seat", STRANGER, MKT_ID, "settle-token-x-readmit", [contractPrincipalCV(DEPLOYER, VAULT), UPD], `(ok u${FUND})`);
  status("P4 resting 1,000 again, parked 0 (harmless: the peg rests at the mid)", (v) => field(v, "jing-resting") === `u${FUND}` && field(v, "jing-parked") === "u0");
  ev("P4 still a zero-spread peg", MKT_ID, `(get-token-x-order '${VAULT_ID})`, (v) => field(v, "spread-bps") === "(some u0)");

  // ---- P5 elapse, park again, permissionless reclaim of a PARKED amount ----
  sbtcXfer("P5 fund another fresh maker", standardPrincipalCV(NEW2), 5_000n);
  tx("P5 another fresh 5,000-sat peg at the mid: the vault is parked a third time", NEW2, MKT_ID, "deposit-token-x", PEG(5_000n), "(ok u5000)");
  tx("settle full-side entrant before checking parking", STRANGER, MKT_ID, "settle-token-x-deposit", [standardPrincipalCV(NEW2), UPD, sbtcT, stringAsciiCV("sbtc-token")], "(ok u5000)");
  status("P5 parked 1,000", (v) => field(v, "jing-parked") === `u${FUND}`);
  tx("P5 proxy set-window-blocks 1", DEPLOYER, PROXY_ID, "set-window", [uintCV(1)], "(ok true)");
  advance(2);
  clock("P5 window elapsed", (v) => field(v, "window-elapsed") === "true");
  tx("P5 stranger jing-reclaim: the PARKED amount comes home", STRANGER, VAULT_ID, "jing-reclaim", [], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  status("P5 1,000 home, nothing parked, nothing resting, not empty", (v) => field(v, "sbtc-balance") === `u${FUND}` && field(v, "jing-parked") === "u0" && field(v, "jing-resting") === "u0" && field(v, "empty") === "false");
  tx("P5 jing-reclaim again -> nothing remains, amount zero", STRANGER, VAULT_ID, "jing-reclaim", [], (v) => String(v).startsWith("(ok") && String(v).includes("(amount u0)"));
  tx("P5 stranger router-swap the 1,000 sats at the floor -> unsold 0, empty, clock cleared", STRANGER, VAULT_ID, "router-swap", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`) && v.includes("(unsold u0)"));
  status("P5 empty", (v) => field(v, "empty") === "true");
  clock("P5 clock cleared", (v) => field(v, "batch-start") === "none");

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
  console.log(`\n${checks - failures}/${checks} checks green`);
  fs.mkdirSync("simulations/results/ccd016-v2",{recursive:true});
  fs.writeFileSync("simulations/results/ccd016-v2/parked.json", JSON.stringify({simulationId:sid, checks, failures, simulationRewrites:{dependencyAliases:ALIASES,commentsStripped:true,marketStalenessWidened:false}, sourceHash:createHash("sha256").update(fs.readFileSync("contracts/extensions/ccd016-swap-vault-mia-v2.clar")).digest("hex"), plan:plan.map(({want,...p})=>p), result:res},null,2)+"\n");
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
