// Updated for exact core-v6 / ladder-v1 / market-v6-3 / router-v5-3.
// Real signed update, unchanged freshness; synthetic burn blocks use one-second intervals.
import {freshProofAfter} from './_jing-v6-3.mjs';
// stxer-ccd016-v2-coverage.js
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
// Covers: fund-from-treasury opens the window; jing-place (whole balance) rests
// a zero-spread peg (order (some u0), floor = mid - leeway, price = mid);
// window gates (take / router-swap / reclaim refused, refloor DAO-only and
// working); a taker fills the vault at the mid (exact STX received); fuel-
// fair-book; window elapse by proposal + block advance; reclaim by anyone;
// router-swap by anyone at the floor (pools), then again with a bid resting
// so the router's BOOK leg fills at the mid and the market settles; DAO-only
// take against a resting bid;
// setters gated and range-checked; recall to the treasury; empty.
//
// Run: PYTH_API_KEY=<key> node simulations/stxer-ccd016-v2-coverage.js
import fs from "node:fs";
import {createHash} from "node:crypto";
import {fetchLazerUpdateAny} from "./_vault-lazer.mjs";
import {
  ClarityVersion, uintCV, boolCV, noneCV, listCV, tupleCV, stringAsciiCV, bufferCV, trueCV, falseCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString, someCV,
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
const FUND = 1_000_000n; // sats into the treasury, then the vault
const TAKE_STX = 100_000_000n; // the taker's gross STX
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
(define-public (set-cooldown (blocks uint)) (contract-call? '${VAULT_ID} set-router-cooldown blocks))
(define-public (set-leeway (bps uint)) (contract-call? '${VAULT_ID} set-leeway-bps bps))
(define-public (set-slippage (bps uint)) (contract-call? '${VAULT_ID} set-slippage-bps bps))
(define-public (set-chunk (sats uint)) (contract-call? '${VAULT_ID} set-max-chunk-sats sats))
(define-public (set-dia (bps uint)) (contract-call? '${VAULT_ID} set-dia-band-bps bps))
(define-public (split (amount uint) (jing uint) (dlmm uint) (xyk uint) (velar uint) (update (buff 8192))) (contract-call? '${VAULT_ID} router-swap-split amount jing dlmm xyk velar update))
(define-public (probe) (ok { clock: (contract-call? '${VAULT_ID} get-clock), config: (contract-call? '${VAULT_ID} get-config), status: (contract-call? '${VAULT_ID} get-status) }))
`;

let checks = 0, failures = 0;
function check(label, actual, want) {
  checks += 1;
  const ok = typeof want === "function" ? want(actual) : want instanceof RegExp ? want.test(String(actual)) : String(actual) === want;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual).slice(0, 170)}${ok ? "" : ` (want ${typeof want === "function" ? want.toString().slice(0, 90) : want})`}`);
}

async function main() {
  console.log("=== ccd016-swap-vault-mia-v2 on the next Jing stack (core-v5, market v6, router v5), mainnet fork ===");
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
  if (XC >= FUND) throw new Error("sizing: 100 STX must be worth under 1M sats");

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
  deploy(CORE, coreSrc); deploy(LADDER, ladderSrc); deploy(MKT, mktSrc); // v6 reads the ladder for the protected seats
  tx("core-v5 verifies market v6", DEPLOYER, CORE_ID, "set-verified-contract", [contractPrincipalCV(DEPLOYER, MKT)], "(ok true)");
  tx("market v6 initialize", DEPLOYER, MKT_ID, "initialize", [contractPrincipalCV(DEPLOYER, MKT), sbtcT, wstxT, uintCV(1000), uintCV(1_000_000), uintCV(1), uintCV(45)], "(ok true)");
  tx("sync current ladder seat reservation", DEPLOYER, MKT_ID, "sync-seat-count", [], "(ok u10)");
  deploy(ROUTER, routerSrc);
  deploy(BOOK, bookSrc);
  deploy(VAULT, vaultSrc);
  deploy(PROXY, PROXY_SRC);
  patch(BASE_DAO, baseDaoPatched, "patch base-dao: is-extension true for the vault + proxy", ClarityVersion.Clarity1);
  tx("DIA: push the Lazer prices, fresh", DIA_UPDATER, DIA, "set-multiple-values", [diaPush(lz.py, lz.px, FRESH_MS)], "(ok true)");
  ev("S0 config binds market v6 + router v5", VAULT_ID, "(get-config)", (v) => v.includes(MKT_ID) && v.includes(`${DEPLOYER}.${ROUTER}`) && v.includes(BOOK_ID));
  ev("S0 empty", VAULT_ID, "(is-empty)", "true");
  // trace coverage: a read-only called from a transaction leaves a stxer trace, an eval does not
  tx("S0 probe (traced): no clock -> batch-start none, window-ends none", DEPLOYER, PROXY_ID, "probe", [], (v) => ok(v) && v.includes("(batch-start none)") && v.includes("(window-ends none)"));
  tx("S0 jing-place with no clock -> u16030 (window-open reads no clock)", STRANGER, VAULT_ID, "jing-place", [UPD], "(err u16030)");
  tx("S0 close-batch with no clock -> u16032", STRANGER, VAULT_ID, "close-batch", [], "(err u16032)");
  tx("S0 callback -> ok", STRANGER, VAULT_ID, "callback", [standardPrincipalCV(STRANGER), bufferCV(Buffer.alloc(0))], "(ok true)");

  // ---- S1 funding from the treasury opens the window ----
  tx("S1 sBTC whale sends 1M sats to the rewards treasury", SBTC_WHALE, SBTC, "transfer", [uintCV(FUND), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  tx("S1 proxy allows sBTC on the treasury (idempotent)", DEPLOYER, PROXY_ID, "allow-sbtc", [], ok);
  tx("S1 stranger fund-from-treasury -> 1M sats into the vault, window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND})`));
  ev("S1 window open", VAULT_ID, "(window-open)", "true");
  tx("S1 probe (traced): the clock shows, window-ends some", DEPLOYER, PROXY_ID, "probe", [], (v) => ok(v) && v.includes("(window-open true)") && !v.includes("(window-ends none)"));
  tx("S1 close-batch while funded -> u16043", STRANGER, VAULT_ID, "close-batch", [], "(err u16043)");
  ev("S1 vault holds 1M sats", VAULT_ID, "(get-status)", (v) => field(v, "sbtc-balance") === `u${FUND}` && field(v, "empty") === "false");

  // ---- S2 the community places, in chunks ----
  tx("S2 stranger jing-place: the whole 1M", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND})`) && v.includes(`(floor u${FLOOR})`));
  tx("S2 jing-place again with 0 home -> u16006", STRANGER, VAULT_ID, "jing-place", [UPD], "(err u16006)");
  ev("S2 market order: zero-spread peg, floor = mid - 5%", MKT_ID, `(get-token-x-order '${VAULT_ID})`, (v) => field(v, "spread-bps") === "(some u0)" && field(v, "limit") === `u${FLOOR}`);
  ev("S2 the vault's price is the mid", MKT_ID, `(token-x-limit-at '${VAULT_ID} u${MID})`, `u${MID}`);
  ev("S2 status: 1M resting, 0 home", VAULT_ID, "(get-status)", (v) => field(v, "jing-resting") === `u${FUND}` && field(v, "sbtc-balance") === "u0");

  // ---- S3 gates while the window is open ----
  tx("S3 stranger jing-take -> u16000 (DAO only)", STRANGER, VAULT_ID, "jing-take", [uintCV(1000), UPD], "(err u16000)");
  tx("S3 proxy jing-take while open -> u16031", DEPLOYER, PROXY_ID, "take", [uintCV(1000), UPD], "(err u16031)");
  tx("S3 stranger router-swap while open -> u16031", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16031)");
  tx("S3 stranger jing-reclaim while open -> u16031", STRANGER, VAULT_ID, "jing-reclaim", [], "(err u16031)");
  tx("S3 stranger jing-refloor -> u16000 (DAO only)", STRANGER, VAULT_ID, "jing-refloor", [UPD], "(err u16000)");
  tx("S3 proxy jing-refloor -> ok (floor re-read from the mid)", DEPLOYER, PROXY_ID, "refloor", [UPD], (v) => ok(v) && v.includes(`(floor u${FLOOR})`));
  ev("S3 order still a zero-spread peg", MKT_ID, `(get-token-x-order '${VAULT_ID})`, (v) => field(v, "spread-bps") === "(some u0)");
  tx("S3 stranger set-window-blocks -> u16000", STRANGER, VAULT_ID, "set-window-blocks", [uintCV(1)], "(err u16000)");
  tx("S3 proxy set-window-blocks 2000 -> u16033 (cap 1008)", DEPLOYER, PROXY_ID, "set-window", [uintCV(2000)], "(err u16033)");
  tx("S3 proxy set-leeway-bps 1001 -> u16033 (cap 1000)", DEPLOYER, PROXY_ID, "set-leeway", [uintCV(1001)], "(err u16033)");
  tx("S3 proxy set-leeway-bps 500 -> ok (unchanged)", DEPLOYER, PROXY_ID, "set-leeway", [uintCV(500)], "(ok true)");
  tx("S3 proxy set-slippage-bps 1001 -> u16033 (cap 1000)", DEPLOYER, PROXY_ID, "set-slippage", [uintCV(1001)], "(err u16033)");
  tx("S3 proxy set-slippage-bps 100 -> ok (unchanged)", DEPLOYER, PROXY_ID, "set-slippage", [uintCV(100)], "(ok true)");
  tx("S3 proxy set-max-chunk-sats 0 -> u16033", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(0)], "(err u16033)");
  tx("S3 proxy set-max-chunk-sats 1 BTC + 1 -> u16033 (cap 1 BTC)", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(100_000_001)], "(err u16033)");
  tx("S3 proxy set-max-chunk-sats 0.01 BTC -> ok (unchanged default)", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(1_000_000)], "(ok true)");
  tx("S3 proxy set-dia-band-bps 5001 -> u16033 (cap 5000)", DEPLOYER, PROXY_ID, "set-dia", [uintCV(5001)], "(err u16033)");
  tx("S3 proxy set-router-cooldown 1 -> ok (unchanged)", DEPLOYER, PROXY_ID, "set-cooldown", [uintCV(1)], "(ok true)");
  tx("S3 stranger set-leeway-bps -> u16000", STRANGER, VAULT_ID, "set-leeway-bps", [uintCV(500)], "(err u16000)");

  // ---- S4 a taker buys the vault's sBTC at the mid ----
  tx(`S4 STX whale sells ${TAKE_STX / 1_000_000n} STX (taker): the vault fills at the mid`, STX_WHALE, MKT_ID, "swap", [uintCV(TAKE_STX), uintCV(HUGE), UPD, sbtcT, stringAsciiCV("sbtc-token"), wstxT, stringAsciiCV("wstx"), falseCV()], ok);
  ev("S4 settlement at the mid", MKT_ID, "(get price (unwrap-panic (get-settlement u0)))", `u${MID}`);
  ev(`S4 vault: ${FUND - XC} sats still resting, ${STX_TO_VAULT} uSTX home`, VAULT_ID, "(get-status)", (v) => field(v, "jing-resting") === `u${FUND - XC}` && field(v, "stx-balance") === `u${STX_TO_VAULT}`);
  ev("S4 the peg rolled into cycle u1 with its rule", MKT_ID, `(get-token-x-order '${VAULT_ID})`, (v) => field(v, "spread-bps") === "(some u0)");

  // ---- S5 STX only ever goes to the book ----
  ev("S5 book STX before", BOOK_ID, `(stx-get-balance '${BOOK_ID})`, () => true);
  const bookBefore = plan[plan.length - 1];
  tx("S5 stranger fuel-fair-book", STRANGER, VAULT_ID, "fuel-fair-book", [], (v) => ok(v) && v.includes(`(amount u${STX_TO_VAULT})`) && v.includes(BOOK_ID));
  ev("S5 book STX after", BOOK_ID, `(stx-get-balance '${BOOK_ID})`, () => true);
  const bookAfter = plan[plan.length - 1];
  ev("S5 vault STX 0", VAULT_ID, "(get-status)", (v) => field(v, "stx-balance") === "u0");
  tx("S5 fuel-fair-book with nothing -> u16006", STRANGER, VAULT_ID, "fuel-fair-book", [], "(err u16006)");

  // ---- S6 the window elapses: proposal shortens it, the chain moves on ----
  tx("S6 proxy set-window-blocks 1", DEPLOYER, PROXY_ID, "set-window", [uintCV(1)], "(ok true)");
  advance(2);
  ev("S6 window elapsed", VAULT_ID, "(window-elapsed)", "true");
  tx("S6 jing-place after the window -> u16030", STRANGER, VAULT_ID, "jing-place", [UPD], "(err u16030)");
  tx(`S6 proxy jing-refloor after the window -> floor = mid - 1% (slippage), not mid - 5% (leeway)`, DEPLOYER, PROXY_ID, "refloor", [UPD], (v) => ok(v) && v.includes(`(floor u${(MID * (BPS - 100n)) / BPS})`));

  // ---- S7 liquidation by anyone ----
  tx(`S7 stranger jing-reclaim -> ${FUND - XC} sats home`, STRANGER, VAULT_ID, "jing-reclaim", [], (v) => ok(v) && v.includes(`(amount u${FUND - XC})`));
  ev("S7 status: nothing resting, sats home", VAULT_ID, "(get-status)", (v) => field(v, "jing-resting") === "u0" && field(v, "sbtc-balance") === `u${FUND - XC}`);
  tx("S7 set 300k cap to preserve partial-swap coverage", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(300000)], "(ok true)");
  // router-swap takes no size (bounty muerdzoc805a745ecc99, finding 2): with more than the cap
  // at home a stranger sells exactly one full 300k chunk, never a sliver that burns the cooldown
  // Nested Quinn L-1: router-swap sells what the pools take inside the floor
  // and keeps the rest (sold = amount - unsold, sold > 8, out >= floor-out(sold - 8));
  // before the fix a partial fill reverted u3002
  const s7 = tx("S7 stranger router-swap: balance > cap -> the 300k cap is the amount; sells what fits inside the floor (book empty: pools)", STRANGER, VAULT_ID, "router-swap", [UPD], (v) => ok(v) && v.includes("(amount u300000)") && 300_000n - num(v, "unsold") > 8n && num(v, "out") >= ((300_000n - num(v, "unsold") - 8n) * num(v, "limit-price")) / PPDF);
  const s7sold = () => 300_000n - num(s7.raw, "unsold");
  ev(`S7 exactly the sold sats left the vault; the unsold rest stays home`, VAULT_ID, "(get-status)", (v) => bare(field(v, "sbtc-balance")) === FUND - XC - s7sold());
  ev("S7 vault got STX from the pools", VAULT_ID, "(get-status)", (v) => bare(field(v, "stx-balance")) > 0n);
  // the cooldown: one router sale per burn block (default), so chunks cannot be chained in one block
  tx("S7 router-swap again in the same burn block -> u16044 (cooldown)", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16044)");
  ev("S7 the refused call moved nothing", VAULT_ID, "(get-status)", (v) => bare(field(v, "sbtc-balance")) === FUND - XC - s7sold());
  ev("S7 config: cooldown 1 block, last sale stamped at this height", VAULT_ID, "(get-config)", (v) => field(v, "router-cooldown-blocks") === "u1" && bare(field(v, "last-router-swap")) > 0n);
  tx("S7 stranger set-router-cooldown -> u16000", STRANGER, VAULT_ID, "set-router-cooldown", [uintCV(0)], "(err u16000)");
  tx("S7 proxy set-router-cooldown 200 -> u16033 (cap 144)", DEPLOYER, PROXY_ID, "set-cooldown", [uintCV(200)], "(err u16033)");
  tx("S7 proxy set-max-chunk-sats 1000 (a small chunk; router-swap sells the cap)", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(1000)], "(ok true)");
  advance(1);
  // L-1: when the first sale left a rest, the pools sit at the floor and this
  // chunk sells 8 sats or less -> u16047 (no cooldown burned); with deeper pools it sells
  const s7c = tx("S7 next burn block: router-swap one 1000-sat chunk (checked against the probe below)", STRANGER, VAULT_ID, "router-swap", [UPD], () => true);
  // the same sale straight through the router from the same pool state (a failed vault call
  // moves nothing): what fits inside the vault's floor now, with min-out 0
  const LIMIT = (MID * (BPS - SLIPPAGE)) / BPS;
  const probe = tx("S7 probe: an sBTC holder routes 1000 sats at the vault's floor, min-out 0", SBTC_WHALE, `${DEPLOYER}.${ROUTER}`, "smart-swap-sbtc-for-stx", [uintCV(1000), uintCV(LIMIT), someCV(UPD), uintCV(MID), uintCV(0)], () => true);
  tx("S7 stranger fuel-fair-book again", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);

  // ---- S7b the router's BOOK leg: a bid rests at the mid, router-swap fills it there first ----
  const cyc0 = ev("S7b market cycle before", MKT_ID, "(get-current-cycle)", () => true);
  const whaleSats0 = ev("S7b the bidder's sats before", VAULT_ID, sbtcBal(STX_WHALE), () => true);
  tx("S7b STX whale rests a 200 STX bid at the mid", STX_WHALE, MKT_ID, "deposit-token-y", [uintCV(200_000_000), uintCV(HUGE), noneCV(), UPD, wstxT, stringAsciiCV("wstx")], "(ok u200000000)");
  const stxBefore7b = ev("S7b vault STX before", VAULT_ID, "(stx-get-balance '" + VAULT_ID + ")", () => true);
  tx("S7b proxy set-max-chunk-sats 100k", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(100_000)], "(ok true)");
  advance(1);
  // L-1: the book leg takes the bid at the mid, the pools what fits inside the floor; any rest stays
  const s7b = tx("S7b stranger router-swap 100k sats: the book leg takes the bid at the mid, the pools take what fits inside the floor, the rest stays", STRANGER, VAULT_ID, "router-swap", [UPD], (v) => ok(v) && v.includes("(amount u100000)") && 100_000n - num(v, "unsold") > 8n && num(v, "out") >= ((100_000n - num(v, "unsold") - 8n) * num(v, "limit-price")) / PPDF);
  const cyc1 = ev("S7b market cycle after: the book settled", MKT_ID, "(get-current-cycle)", () => true);
  const whaleSats1 = ev("S7b the bidder's sats after: it bought the vault's sBTC", VAULT_ID, sbtcBal(STX_WHALE), () => true);
  const stxAfter7b = ev("S7b vault STX after", VAULT_ID, "(stx-get-balance '" + VAULT_ID + ")", () => true);
  tx("S7b stranger fuel-fair-book", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);

  // ---- S8 DAO-only take against a resting bid ----
  tx("S8 STX whale rests a 200 STX bid at the mid", STX_WHALE, MKT_ID, "deposit-token-y", [uintCV(200_000_000), uintCV(HUGE), noneCV(), UPD, wstxT, stringAsciiCV("wstx")], "(ok u200000000)");
  tx("S8 stranger jing-take after the window -> still u16000", STRANGER, VAULT_ID, "jing-take", [uintCV(50_000), UPD], "(err u16000)");
  tx("S8 proxy set-dia-band-bps 0 -> ok (the ccip027 dial: DIA no longer consulted)", DEPLOYER, PROXY_ID, "set-dia", [uintCV(0)], "(ok true)");
  tx("S8 proxy jing-take 50k sats -> fills at the mid (FOK)", DEPLOYER, PROXY_ID, "take", [uintCV(50_000), UPD], (v) => ok(v) && bare((String(v).match(/\(out (u\d+)\)/) || [])[1]) > 0n);
  ev("S8 vault STX from the take", VAULT_ID, "(get-status)", (v) => bare(field(v, "stx-balance")) > 0n);

  // ---- S8b the DAO's explicit split (router-swap-split): mismatch refused, a DLMM-only split sells ----
  tx("S8b stranger router-swap-split -> u16000", STRANGER, VAULT_ID, "router-swap-split", [uintCV(2000), uintCV(0), uintCV(2000), uintCV(0), uintCV(0), UPD], "(err u16000)");
  tx("S8b proxy split 2000 = 0 + 1000 + 0 + 0 -> u16040 (mismatch)", DEPLOYER, PROXY_ID, "split", [uintCV(2000), uintCV(0), uintCV(1000), uintCV(0), uintCV(0), UPD], "(err u16040)");
  // the L-1 partial sales above can leave the DLMM at the 1% floor (a DLMM short fill is u2003):
  // the DAO lever set-slippage-bps widens the split's floor to 5% for this leg, then back
  tx("S8b proxy set-slippage-bps 500 (the DLMM may sit at the 1% floor after S7)", DEPLOYER, PROXY_ID, "set-slippage", [uintCV(500)], "(ok true)");
  advance(1);
  tx("S8b proxy split 2000 sats, all to the DLMM -> ok, unsold 0", DEPLOYER, PROXY_ID, "split", [uintCV(2000), uintCV(0), uintCV(2000), uintCV(0), uintCV(0), UPD], (v) => ok(v) && v.includes("(unsold u0)"));
  tx("S8b proxy split again in the same burn block -> u16044 (the cooldown is shared)", DEPLOYER, PROXY_ID, "split", [uintCV(1000), uintCV(0), uintCV(1000), uintCV(0), uintCV(0), UPD], "(err u16044)");
  tx("S8b proxy set-slippage-bps back to 100", DEPLOYER, PROXY_ID, "set-slippage", [uintCV(100)], "(ok true)");

  // ---- S9 recall: sBTC only ever goes back to the treasury ----
  ev("S9 treasury sats before recall", VAULT_ID, sbtcBal(REWARDS_TREASURY), () => true);
  const trBefore = plan[plan.length - 1];
  tx("S9 stranger dao-recall-sbtc -> u16000", STRANGER, VAULT_ID, "dao-recall-sbtc", [], "(err u16000)");
  tx("S9 proxy recall -> ok", DEPLOYER, PROXY_ID, "recall", [], ok);
  ev("S9 treasury sats after recall", VAULT_ID, sbtcBal(REWARDS_TREASURY), () => true);
  const trAfter = plan[plan.length - 1];
  ev("S9 vault sats 0", VAULT_ID, "(get-status)", (v) => field(v, "sbtc-balance") === "u0");
  tx("S9 stranger fuel-fair-book (the take's STX)", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  ev("S9 empty again", VAULT_ID, "(is-empty)", "true");

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
  check(`S5 the book received exactly ${STX_TO_VAULT} uSTX`, bare(bookAfter.raw) - bare(bookBefore.raw), (d) => d === STX_TO_VAULT);
  check("S9 the treasury received the recalled sats", bare(trAfter.raw) - bare(trBefore.raw), (d) => d > 0n);
  { // L-1: u16047 exactly when 8 sats or less fit inside the floor; never a sale under it
    const pSold = 1000n - num(probe.raw, "unsold"), pOut = num(probe.raw, "out");
    check("S7 the probe routed inside the floor (out >= floor-out(sold - 8))", `sold ${pSold}, out ${pOut}`, () => ok(probe.raw) && pOut >= ((pSold > 8n ? pSold - 8n : 0n) * LIMIT) / PPDF);
    check("S7 1000-sat chunk: u16047 iff 8 sats or less fit inside the floor, else it sells", `${s7c.raw} / probe sold ${pSold}`, () => s7c.raw === "(err u16047)" ? pSold <= 8n : ok(s7c.raw) && s7c.raw.includes("(amount u1000)") && 1000n - num(s7c.raw, "unsold") > 8n);
  }
  check("S7b the market settled one cycle through the router's book leg", bare(cyc1.raw) - bare(cyc0.raw), (d) => d === 1n);
  check("S7b the bidder received sBTC from the book leg", bare(whaleSats1.raw) - bare(whaleSats0.raw), (d) => d > 0n);
  check("S7b the vault received exactly the router-swap out in STX", bare(stxAfter7b.raw) - bare(stxBefore7b.raw), (d) => d > 0n && d === num(s7b.raw, "out"));
  console.log(`\n${checks - failures}/${checks} checks green`);
  const RESULTS_DIR = process.env.SIM_RESULTS_DIR || "simulations/results/ccd016-v2";
  fs.mkdirSync(RESULTS_DIR,{recursive:true});
  fs.writeFileSync(`${RESULTS_DIR}/coverage.json`, JSON.stringify({simulationId:sid, checks, failures, simulationRewrites:{dependencyAliases:ALIASES,commentsStripped:true,marketStalenessWidened:false}, sourceHash:createHash("sha256").update(fs.readFileSync("contracts/extensions/ccd016-swap-vault-mia-v2.clar")).digest("hex"), plan:plan.map(({want,...p})=>p), result:res},null,2)+"\n");
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
