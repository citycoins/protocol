// stxer-ccd016-v2-fixes.js
// SELF-VERIFYING stxer mainnet-fork harness for the ccd016-swap-vault-mia-v2
// fixes from the v6-3 submit + settle audit bounty (jing-contracts-v3
// README-audit-bounty-v6-3-submit-settle.md):
//   Nested Quinn L-1  router-swap sells what fits inside the floor, keeps the
//                     rest, and reverts u16047 when 8 sats or less sold
//   Void Kael #7      close-batch cancels market dust (wallet + market <= 2)
//                     home first, so a sold-out batch closes at once
//   Void Kael #8      router-swap allowance = amount + min-x + 70 bps
//                     (measured on a book-leg sale; the band case itself is
//                     not built, see the README)
//   L-2 does not apply to ccd016 (no timed recovery, keeps 1008): checked.
//
// Same stack and DAO simulation as stxer-ccd016-v2-coverage.js: the current
// Jing core-v6, ladder-v1, market v6-3 and router v5-3 from JING_SRC under
// their production names, then the ccd015 book, the vault and a proxy that
// plays a passed proposal; base-dao is-extension patched for vault + proxy;
// DIA impersonated with the Lazer prices.
//
// Run: PYTH_API_KEY=<key> node simulations/stxer-ccd016-v2-fixes.js
import {freshProofAfter} from './_jing-v6-3.mjs';
import fs from "node:fs";
import {createHash} from "node:crypto";
import {
  ClarityVersion, uintCV, listCV, tupleCV, stringAsciiCV, bufferCV, falseCV, noneCV,
  contractPrincipalCV, standardPrincipalCV, deserializeCV, cvToString, someCV,
} from "@stacks/transactions";
import { SimulationBuilder, getSimulationResult } from "stxer";

const NODE = process.env.STACKS_API_URL || "http://77.42.3.101/stacks-api";
const JING_SRC = process.env.JING_SRC || `${process.env.HOME}/projects/jing-contracts-v3/contracts`;
const RESULTS_DIR = process.env.SIM_RESULTS_DIR || "simulations/results/ccd016-v2";

const DEPLOYER = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
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
const CORE_ID = `${DEPLOYER}.${CORE}`, MKT_ID = `${DEPLOYER}.${MKT}`, ROUTER_ID = `${DEPLOYER}.${ROUTER}`, BOOK_ID = `${DEPLOYER}.${BOOK}`, VAULT_ID = `${DEPLOYER}.${VAULT}`, PROXY_ID = `${DEPLOYER}.${PROXY}`;
const [sbtcAddr, sbtcName] = SBTC.split("."), [wstxAddr, wstxName] = WSTX.split("."), [trAddr, trName] = REWARDS_TREASURY.split(".");
const sbtcT = contractPrincipalCV(sbtcAddr, sbtcName), wstxT = contractPrincipalCV(wstxAddr, wstxName);
const PP = 100_000_000n, PPDF = PP * 100n, BPS = 10_000n, HUGE = 999_999_999_999_999n;
const MIN_X = 1000n, SLACK = 8n, REBATE_DUST = 51n, MAX_REBATE_BPS = 70n; // JING_REBATE_DUST_SATS, MAX_TAKER_REBATE_BPS
const FUND_A = 100_000n, FUND_B = 100_000n, FUND_C = 10_000_000n; // C: 0.1 BTC, more than the pools hold between mid - 0.5% and the 1% floor
const DUMP = 20_000_000n; // a whale's router sale down to mid - 0.5% before C
const LOW_BID_STX = 10_000_000n; // a resting bid at mid - 10%: puts the vault's places into pending escrow, never fills at the mid
const BID_STX = 300_000_000n; // the book bid that lets the next router-swap sell more

const src = f => fs.readFileSync(f, "utf8").split("\n").filter(l => !/^\s*;;/.test(l)).join("\n");
const decodeTx = (s) => { const r = s?.Result?.Transaction; if (!r) return "<no tx>"; if ("Err" in r) return `ENGINE-ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; if (r.Ok?.vm_error) return `VM-ERR: ${r.Ok.vm_error}`; try { return cvToString(deserializeCV(r.Ok.result)); } catch (e) { return `decode-failed: ${e.message}`; } };
const decodeEval = (s) => { const r = s?.Result?.Eval; if (!r) return "<no eval>"; if (!("Ok" in r)) return `ERR: ${JSON.stringify(r.Err).slice(0, 200)}`; try { return cvToString(deserializeCV(r.Ok)); } catch { return r.Ok; } };
const num = (s, key) => BigInt((String(s).match(new RegExp(`\\(${key} u(\\d+)\\)`)) || [])[1] ?? "-1");
const bare = (s) => BigInt((String(s).match(/u(\d+)/) || [])[1] ?? "-1");
const field = (s, k) => (String(s).match(new RegExp(`\\(${k} (u?\\d+|none|true|false|\\(some u\\d+\\))\\)`)) || [])[1];
const floorOut = (sats, limit) => (sats * limit) / PPDF;

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
(define-public (recall) (contract-call? '${VAULT_ID} dao-recall-sbtc))
(define-public (set-chunk (sats uint)) (contract-call? '${VAULT_ID} set-max-chunk-sats sats))
`;

// events of one transaction step
const eventsOf = (step) => (step?.Result?.Transaction?.Ok?.events ?? []).map(e => typeof e === "string" ? JSON.parse(e) : e).filter(e => e.committed !== false);
const sbtcMoves = (evs) => evs.filter(e => e.type === "ft_transfer_event" && String(e.ft_transfer_event.asset_identifier).startsWith(SBTC))
  .map(e => ({ from: e.ft_transfer_event.sender, to: e.ft_transfer_event.recipient, amount: BigInt(e.ft_transfer_event.amount) }));
const stxMoves = (evs) => evs.filter(e => e.type === "stx_transfer_event").map(e => ({ from: e.stx_transfer_event.sender, to: e.stx_transfer_event.recipient, amount: BigInt(e.stx_transfer_event.amount) }));
const printsOf = (evs, contract) => evs.filter(e => e.type === "contract_event" && e.contract_event?.topic === "print" && e.contract_event.contract_identifier === contract)
  .map(e => { try { return cvToString(deserializeCV(e.contract_event.raw_value)); } catch { return ""; } });
const sum = (xs) => xs.reduce((a, m) => a + m.amount, 0n);

let checks = 0, failures = 0;
const results = [];
function check(label, actual, want) {
  checks += 1;
  const ok = typeof want === "function" ? want(actual) : want instanceof RegExp ? want.test(String(actual)) : String(actual) === want;
  if (!ok) failures += 1;
  results.push({ label, passed: ok, actual: String(actual).slice(0, 400) });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual).slice(0, 200)}${ok ? "" : ` (want ${typeof want === "function" ? want.toString().slice(0, 110) : want})`}`);
}

// the uSTX a Y taker must send so the vault's X ask keeps exactly `rest` sats
function takeFor(mid, target) {
  const guess = (target * mid * (BPS + 20n)) / PPDF / BPS; // gross: net = floor(t * BPS / (BPS + 20)) at a fresh print
  for (let t = guess - 5000n; t < guess + 5000n; t++) {
    const net = (t * BPS) / (BPS + 20n);
    if ((net * PPDF) / mid === target) return t;
  }
  throw new Error(`no taker size buys exactly ${target} sats at ${mid}`);
}

async function main() {
  console.log("=== ccd016-swap-vault-mia-v2 FIXES: L-1 partial router-swap / u16047, #7 market dust, #8 allowance (mainnet fork, Lazer) ===");
  // FORK_BLOCK pins a whole rerun set to one height (default: the node tip)
  const tip = process.env.FORK_BLOCK ? await fetchJson(`/extended/v1/block/by_height/${process.env.FORK_BLOCK}`) : (await fetchJson(`/extended/v1/block?limit=1`)).results[0];
  const lz = await freshProofAfter(Number(tip.block_time) + 12);
  const UPD = bufferCV(Buffer.from(lz.hex, "hex"));
  const MID = (lz.px * PP) / lz.py;
  const FRESH_MS = BigInt(tip.burn_block_time) * 1000n;
  console.log(`Lazer mid ${MID}; tip ${tip.height}`);

  const coreSrc = src(`${JING_SRC}/${CORE}.clar`), ladderSrc = src(`${JING_SRC}/${LADDER}.clar`);
  const mktSrc = src(`${JING_SRC}/${MKT}.clar`), routerSrc = src(`${JING_SRC}/${ROUTER}.clar`);
  const bookSrc = src(`./contracts/extensions/${BOOK}.clar`), vaultSrc = src(`./contracts/extensions/${VAULT}.clar`);
  for (const needle of ["ROUTER_SLACK_SATS u8", "JING_REBATE_DUST_SATS u51", "MAX_TAKER_REBATE_BPS u70", "(define-private (market-total)", "MAX_WINDOW_BLOCKS u1008"])
    if (!vaultSrc.includes(needle)) throw new Error(`vault source lacks ${needle}`);
  const sourceHashes = Object.fromEntries([[CORE, `${JING_SRC}/${CORE}.clar`], [LADDER, `${JING_SRC}/${LADDER}.clar`], [MKT, `${JING_SRC}/${MKT}.clar`], [ROUTER, `${JING_SRC}/${ROUTER}.clar`], [BOOK, `contracts/extensions/${BOOK}.clar`], [VAULT, `contracts/extensions/${VAULT}.clar`]]
    .map(([n, p]) => [n, createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
  const baseDaoSrc = (await fetchJson(`/extended/v1/contract/${BASE_DAO}`)).source_code;
  const needle = "(default-to false (map-get? Extensions extension))";
  if (!baseDaoSrc.includes(needle)) throw new Error("base-dao is-extension body changed; update the patch");
  const baseDaoPatched = baseDaoSrc.replace(needle, `(or (default-to false (map-get? Extensions extension)) (is-eq extension '${VAULT_ID}) (is-eq extension '${PROXY_ID}))`);

  const TAKE_A = takeFor(MID, FUND_A);                 // buys the whole live ask
  const TAKE_B = takeFor(MID, FUND_B + 1n);            // batch B holds 100,001 live

  const plan = [];
  let b = SimulationBuilder.new({ stacksNodeAPI: NODE }).useBlockHeight(tip.height);
  const deploy = (name, code, cv = ClarityVersion.Clarity6) => { b = b.withSender(DEPLOYER).addContractDeploy({ contract_name: name, source_code: code, clarity_version: cv }); plan.push({ kind: "deploy", label: `deploy ${name}` }); };
  const patch = (cid, code, label, cv) => { b = b.addSetContractCode({ contract_id: cid, source_code: code, clarity_version: cv }); plan.push({ kind: "patch", label }); };
  const tx = (label, sender, cid, fn, args, want) => { if (fn === "jing-reclaim" && args.length === 0) args = [noneCV()]; b = b.withSender(sender).addContractCall({ contract_id: cid, function_name: fn, function_args: args }); const slot = { kind: "tx", label, want }; plan.push(slot); return slot; };
  const ev = (label, cid, code, want) => { b = b.addEvalCode(cid, code); const slot = { kind: "eval", label, want }; plan.push(slot); return slot; };
  const advance = (btc) => { b = b.addAdvanceBlocks({ bitcoin_blocks: btc, stacks_blocks_per_bitcoin: 1, bitcoin_interval_secs: 1 }); plan.push({ kind: "advance", label: `advance ${btc} bitcoin blocks` }); };
  const ok = (v) => String(v).startsWith("(ok");
  const any = () => true; any.observe = true;
  const status = (label, want) => ev(label, VAULT_ID, "(get-status)", want);
  const clock = (label, want) => ev(label, VAULT_ID, "(get-clock)", want);
  const config = (label, want = any) => ev(label, VAULT_ID, "(get-config)", want);
  const market = (label, want) => ev(label, VAULT_ID, `(let ((c (contract-call? '${MKT_ID} get-current-cycle))) { live: (contract-call? '${MKT_ID} get-token-x-deposit c current-contract), parked: (contract-call? '${MKT_ID} get-token-x-parked current-contract), pending: (default-to u0 (get amount (contract-call? '${MKT_ID} get-token-x-pending-deposit current-contract))) })`, want);
  const stxBal = (label, who, want = any) => ev(label, VAULT_ID, `(stx-get-balance '${who})`, want);
  const toTreasury = (label, amount) => tx(label, SBTC_WHALE, SBTC, "transfer", [uintCV(amount), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(trAddr, trName), noneCV()], "(ok true)");
  const donate = (label, amount) => tx(label, SBTC_WHALE, SBTC, "transfer", [uintCV(amount), standardPrincipalCV(SBTC_WHALE), contractPrincipalCV(DEPLOYER, VAULT), noneCV()], "(ok true)");
  const taker = (label, ustx) => tx(label, STX_WHALE, MKT_ID, "swap", [uintCV(ustx), uintCV(HUGE), UPD, sbtcT, stringAsciiCV("sbtc-token"), wstxT, stringAsciiCV("wstx"), falseCV()], ok);

  // ---- the stack ----
  deploy(CORE, coreSrc); deploy(LADDER, ladderSrc); deploy(MKT, mktSrc);
  tx("core verifies the market", DEPLOYER, CORE_ID, "set-verified-contract", [contractPrincipalCV(DEPLOYER, MKT)], "(ok true)");
  tx("market initialize", DEPLOYER, MKT_ID, "initialize", [contractPrincipalCV(DEPLOYER, MKT), sbtcT, wstxT, uintCV(1000), uintCV(1_000_000), uintCV(1), uintCV(45)], "(ok true)");
  tx("sync current ladder seat reservation", DEPLOYER, MKT_ID, "sync-seat-count", [], "(ok u10)");
  deploy(ROUTER, routerSrc); deploy(BOOK, bookSrc); deploy(VAULT, vaultSrc); deploy(PROXY, PROXY_SRC);
  patch(BASE_DAO, baseDaoPatched, "patch base-dao: is-extension true for the vault + proxy", ClarityVersion.Clarity1);
  tx("DIA: push the Lazer prices, fresh", DIA_UPDATER, DIA, "set-multiple-values", [diaPush(lz.py, lz.px, FRESH_MS)], "(ok true)");
  tx("proxy allows sBTC on the treasury", DEPLOYER, PROXY_ID, "allow-sbtc", [], ok);

  // ---- L-2 does not apply: ccd016 keeps the 1008 cap ----
  tx("L-2 n/a: set-window-blocks 1009 -> u16033 (ccd016 cap stays 1008)", DEPLOYER, PROXY_ID, "set-window", [uintCV(1009)], "(err u16033)");
  tx("L-2 n/a: set-window-blocks 1008 -> ok", DEPLOYER, PROXY_ID, "set-window", [uintCV(1008)], "(ok true)");
  tx("set-window-blocks back to the 288 default", DEPLOYER, PROXY_ID, "set-window", [uintCV(288)], "(ok true)");

  // ---- #7 A: the market's minimum is on the whole position, so a 1-sat place
  // only lands while the ask still rests; with a bid on the book it goes to
  // pending escrow, and the sell-out of the ask then leaves exactly that 1 sat
  // on the market (wallet 0): market dust that holds the batch open ----
  const LOW = (MID * 90n) / 100n;
  const lowBid = () => tx(`STRANGER rests a ${LOW_BID_STX / 1_000_000n} STX bid at mid - 10% (never fills at the mid)`, STRANGER, MKT_ID, "deposit-token-y", [uintCV(LOW_BID_STX), uintCV(LOW), noneCV(), wstxT, stringAsciiCV("wstx")], `(ok u${LOW_BID_STX})`);
  const settleVault = (label) => tx(label, STRANGER, MKT_ID, "settle-token-x-deposit", [contractPrincipalCV(DEPLOYER, VAULT), UPD, sbtcT, stringAsciiCV("sbtc-token")], ok);
  lowBid();
  toTreasury(`#7A whale sends ${FUND_A} sats to the treasury`, FUND_A);
  tx("#7A fund-from-treasury opens a window", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND_A})`) && v.includes("(opened true)"));
  tx("#7A stranger jing-place: the whole batch (escrowed: a bid rests)", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND_A})`));
  settleVault("#7A anyone settles the vault's escrow: the ask rests (no cross at mid - 10%)");
  market(`#7A ${FUND_A} live, nothing pending`, (v) => field(v, "live") === `u${FUND_A}` && field(v, "pending") === "u0");
  donate("#7A griefer donates 1 sat to the vault", 1n);
  const aPlace = tx("#7A griefer jing-place: 1 sat, accepted as a top-up (whole position >= min), escrowed", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes("(amount u1)"));
  market("#7A 1 sat pending next to the live ask", (v) => field(v, "live") === `u${FUND_A}` && field(v, "pending") === "u1");
  const aStx0 = stxBal("#7A vault STX before the fill", VAULT_ID);
  const aTake = taker(`#7A taker sends ${TAKE_A} uSTX: buys exactly the ${FUND_A} live sats at the mid`, TAKE_A);
  market("#7A sold out: live 0, the 1 sat still pending on the market", (v) => field(v, "live") === "u0" && field(v, "parked") === "u0" && field(v, "pending") === "u1");
  status("#7A wallet 0, NOT empty (market dust)", (v) => field(v, "sbtc-balance") === "u0" && field(v, "jing-escrowed") === "u1" && field(v, "empty") === "false");
  clock("#7A window still open", (v) => field(v, "window-open") === "true");
  const aClose = tx("#7A stranger close-batch: wallet + market = 1 <= 2, cancels the dust home and closes at once", STRANGER, VAULT_ID, "close-batch", [], (v) => ok(v) && v.includes("close-batch"));
  market("#7A market position 0 after close-batch", (v) => field(v, "live") === "u0" && field(v, "parked") === "u0" && field(v, "pending") === "u0");
  status("#7A wallet holds the 1 dust sat, empty", (v) => field(v, "sbtc-balance") === "u1" && field(v, "empty") === "true");
  clock("#7A clock cleared although the window had not ended", (v) => field(v, "batch-start") === "none" && field(v, "window-open") === "false");
  tx("#7A close-batch again -> u16032 (no clock)", STRANGER, VAULT_ID, "close-batch", [], "(err u16032)");
  const aStx1 = stxBal("#7A vault STX after the fill", VAULT_ID);
  const bookA0 = stxBal("#7A book STX before the flush", BOOK_ID);
  tx("#7A fuel-fair-book: the sell-out STX goes to the book", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  const bookA1 = stxBal("#7A book STX after the flush", BOOK_ID);

  // ---- #7 B: a real position (3 sats) is never cancelled by close-batch ----
  toTreasury(`#7B whale sends ${FUND_B} sats to the treasury`, FUND_B);
  tx("#7B fund-from-treasury: empty (1 dust) -> a new window opens", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND_B})`) && v.includes("(opened true)"));
  tx(`#7B jing-place: ${FUND_B + 1n} (the batch plus the dust), escrowed`, STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND_B + 1n})`));
  settleVault("#7B settle the escrow: the ask rests");
  donate("#7B 3 sats donated", 3n);
  tx("#7B jing-place: 3 sats escrowed", STRANGER, VAULT_ID, "jing-place", [UPD], (v) => ok(v) && v.includes("(amount u3)"));
  taker(`#7B taker sends ${TAKE_B} uSTX: buys exactly the ${FUND_B + 1n} live sats`, TAKE_B);
  market("#7B sold out, 3 sats pending", (v) => field(v, "live") === "u0" && field(v, "pending") === "u3");
  tx("#7B close-batch: wallet 0 + market 3 > 2 -> u16043, nothing cancelled", STRANGER, VAULT_ID, "close-batch", [], "(err u16043)");
  market("#7B the 3-sat escrow is untouched", (v) => field(v, "pending") === "u3");
  tx("#7B proxy set-window-blocks 1", DEPLOYER, PROXY_ID, "set-window", [uintCV(1)], "(ok true)");
  advance(2);
  tx("#7B jing-reclaim after the window: the 3 sats come home", STRANGER, VAULT_ID, "jing-reclaim", [], (v) => ok(v) && v.includes("(amount u3)"));
  status("#7B wallet 3, not empty", (v) => field(v, "sbtc-balance") === "u3" && field(v, "empty") === "false");
  tx("#7B fuel-fair-book", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  tx("STRANGER cancels the low bid (clean book for the router cases)", STRANGER, MKT_ID, "cancel-token-y-deposit", [wstxT, stringAsciiCV("wstx")], ok);

  // ---- L-1 small: a sale of 8 sats or less reverts u16047 and burns no cooldown ----
  const cfg0 = config("L-1 config before the small sales (last-router-swap)");
  tx("L-1 router-swap of the 3-sat wallet -> u16047 (sold <= 8)", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16047)");
  status("L-1 the 3 sats stay", (v) => field(v, "sbtc-balance") === "u3");
  toTreasury(`L-1 whale sends ${FUND_C} sats to the treasury`, FUND_C);
  // 8adfa68 (bounty mv7dfb, Calm Forge): the 3 sats left are unsellable dust (wallet + market
  // <= ROUTER_SLACK_SATS 8) on an elapsed window, so the new rewards open a FRESH window and
  // rest first; they no longer join the elapsed batch and get router-swapped at the floor at once
  tx("L-1 fund-from-treasury: elapsed window on 3 dust sats -> a fresh window opens (8adfa68)", STRANGER, VAULT_ID, "fund-from-treasury", [], (v) => ok(v) && v.includes(`(amount u${FUND_C})`) && v.includes("(opened true)"));
  clock("L-1 the fresh window is open", (v) => field(v, "window-open") === "true");
  tx("L-1 router-swap inside the fresh window -> u16031 (the rewards rest first)", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16031)");
  advance(2);
  clock("L-1 after 2 burn blocks the 1-block window elapsed", (v) => field(v, "window-open") === "false");
  tx("L-1 proxy set-max-chunk-sats 8", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(8)], "(ok true)");
  tx("L-1 router-swap of one 8-sat chunk -> u16047 (8 sats sold at most)", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16047)");
  const cfg1 = config("L-1 config after both refusals: last-router-swap unchanged");
  status(`L-1 wallet still ${FUND_C + 3n}`, (v) => field(v, "sbtc-balance") === `u${FUND_C + 3n}`);
  tx("L-1 proxy set-max-chunk-sats 1 BTC: the next sale is the whole balance", DEPLOYER, PROXY_ID, "set-chunk", [uintCV(100_000_000)], "(ok true)");

  // ---- L-1 partial: the pools take only part within the floor, the rest stays ----
  // the pools' depth inside the floor moves by the hour (52k sats to over 3M on one afternoon):
  // a whale first routes sBTC down to mid - 0.5%, so only the band from 0.5% to the vault's
  // 1% floor is left for the vault (a no-op when the pools already sit lower)
  tx(`L-1 fixture: an sBTC whale routes up to ${DUMP} sats down to mid - 0.5% (min-out 0)`, SBTC_WHALE, ROUTER_ID, "smart-swap-sbtc-for-stx", [uintCV(DUMP), uintCV((MID * 9950n) / 10000n), someCV(UPD), uintCV(MID), uintCV(0)], ok);
  const c0 = status("L-1 status before the partial sale", any);
  const cStx0 = stxBal("L-1 vault STX before the partial sale", VAULT_ID);
  const p1 = tx(`L-1 router-swap (same burn block; the refusals burned no cooldown): sells what the pools take inside the floor`, STRANGER, VAULT_ID, "router-swap", [UPD], (v) => ok(v) && v.includes(`(amount u${FUND_C + 3n})`));
  const c1 = status("L-1 status after the partial sale", any);
  const cStx1 = stxBal("L-1 vault STX after the partial sale", VAULT_ID);
  tx("L-1 router-swap again in the same burn block -> u16044", STRANGER, VAULT_ID, "router-swap", [UPD], "(err u16044)");
  advance(1);
  const p2 = tx("L-1 next burn block, book empty: the pools are at the floor (observed; u16047 when <= 8 sats fit)", STRANGER, VAULT_ID, "router-swap", [UPD], any);
  const c2 = status("L-1 status after the exhausted call", any);
  const LIMIT = (MID * (BPS - 100n)) / BPS;
  const probe = tx("L-1 probe: an sBTC holder routes 1000 sats at the vault's floor, min-out 0 (same pool state)", SBTC_WHALE, ROUTER_ID, "smart-swap-sbtc-for-stx", [uintCV(1000), uintCV(LIMIT), someCV(UPD), uintCV(MID), uintCV(0)], any);
  tx(`L-1 STX whale rests a ${BID_STX / 1_000_000n} STX bid at the mid`, STX_WHALE, MKT_ID, "deposit-token-y", [uintCV(BID_STX), uintCV(HUGE), noneCV(), wstxT, stringAsciiCV("wstx")], `(ok u${BID_STX})`);
  const cStx2 = stxBal("L-1 vault STX before the book-leg sale", VAULT_ID);
  const p3 = tx("L-1 the next call sells more: the router's book leg takes the bid", STRANGER, VAULT_ID, "router-swap", [UPD], ok);
  const c3 = status("L-1 status after the book-leg sale", any);
  const cStx3 = stxBal("L-1 vault STX after the book-leg sale", VAULT_ID);

  // ---- clean up: recall the rest to the treasury, flush the STX ----
  tx("proxy recall the unsold rest to the treasury", DEPLOYER, PROXY_ID, "recall", [], ok);
  tx("fuel-fair-book", STRANGER, VAULT_ID, "fuel-fair-book", [], ok);
  status("empty again", (v) => field(v, "sbtc-balance") === "u0" && field(v, "stx-balance") === "u0" && field(v, "empty") === "true");

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
    p.step = s[i];
    p.raw = p.kind === "tx" ? decodeTx(s[i]) : decodeEval(s[i]); i += 1;
    if (p.want?.observe) { console.log(`  ..   ${p.label}: ${String(p.raw).slice(0, 200)}`); continue; }
    check(p.label, p.raw, p.want);
  }

  // #7 A: exact balances and events
  const fillSbtc = sbtcMoves(eventsOf(aTake.step));
  check(`#7A the taker received ${FUND_A} sats less the 10 bps fee from the market`, sum(fillSbtc.filter(m => m.to === STX_WHALE)), (d) => d === FUND_A - FUND_A / 1000n);
  const closeEv = eventsOf(aClose.step), closeSbtc = sbtcMoves(closeEv);
  check("#7A close-batch moved exactly 1 sat market -> vault and nothing else", JSON.stringify(closeSbtc.map(m => ({ ...m, amount: String(m.amount) }))), () => closeSbtc.length === 1 && closeSbtc[0].from === MKT_ID && closeSbtc[0].to === VAULT_ID && closeSbtc[0].amount === 1n);
  const closePrints = printsOf(closeEv, VAULT_ID);
  check("#7A close-batch printed jing-reclaim (amount u1) then close-batch", closePrints.join(" | "), () => closePrints.length === 2 && closePrints[0].includes('"jing-reclaim"') && closePrints[0].includes("(amount u1)") && closePrints[1].includes('"close-batch"'));
  const corePrints = printsOf(closeEv, CORE_ID);
  check("#7A core logged the pending refund (reason cancel, 1 sat)", corePrints.join(" | ").slice(0, 400), () => corePrints.some(p => p.includes("cancel") && p.includes("u1")));
  check("#7A close-batch moved no STX", stxMoves(closeEv).length, (n) => n === 0);
  const aProceeds = bare(aStx1.raw) - bare(aStx0.raw);
  check("#7A the vault's STX = the fill proceeds (> 0)", aProceeds, (d) => d > 0n);
  check("#7A the book received exactly the vault's STX", bare(bookA1.raw) - bare(bookA0.raw), (d) => d === bare(aStx1.raw));

  // L-1 small: no cooldown burned
  check("L-1 u16047 refusals left last-router-swap unchanged", `${field(cfg0.raw, "last-router-swap")} -> ${field(cfg1.raw, "last-router-swap")}`, () => field(cfg0.raw, "last-router-swap") === field(cfg1.raw, "last-router-swap"));

  // L-1 partial: exact deltas
  const amount1 = num(p1.raw, "amount"), unsold1 = num(p1.raw, "unsold"), out1 = num(p1.raw, "out"), limit1 = num(p1.raw, "limit-price"), sold1 = amount1 - unsold1;
  check("L-1 partial: the pools sold more than 8 sats and left a rest (unsold > 0)", `sold ${sold1}, unsold ${unsold1}`, () => sold1 > SLACK && unsold1 > 0n);
  check("L-1 partial: out >= floor-out(sold - 8) at the limit", `out ${out1}, floor ${floorOut(sold1 - SLACK, limit1)}`, () => out1 >= floorOut(sold1 - SLACK, limit1));
  check("L-1 partial: wallet dropped by exactly the sold sats; the rest stayed", `${field(c0.raw, "sbtc-balance")} -> ${field(c1.raw, "sbtc-balance")}`, () => bare(field(c0.raw, "sbtc-balance")) - bare(field(c1.raw, "sbtc-balance")) === sold1 && bare(field(c1.raw, "sbtc-balance")) === unsold1);
  check("L-1 partial: vault STX rose by exactly out", bare(cStx1.raw) - bare(cStx0.raw), (d) => d === out1);
  const p1Ev = eventsOf(p1.step), p1Sbtc = sbtcMoves(p1Ev);
  check("L-1 partial: net sBTC out of the vault in events = sold", sum(p1Sbtc.filter(m => m.from === VAULT_ID)) - sum(p1Sbtc.filter(m => m.to === VAULT_ID)), (d) => d === sold1);
  const r1 = printsOf(p1Ev, ROUTER_ID).find(x => x.includes("smart-swap-sbtc-for-stx")) || "";
  check("L-1 partial: router print agrees (jing-in 0, unsold, out)", r1.slice(0, 300), () => num(r1, "jing-in") === 0n && num(r1, "unsold") === unsold1 && num(r1, "out") === out1);
  check("L-1 partial: the vault is not empty (the rest is held)", field(c1.raw, "empty"), "false");
  // the exhausted call
  const pSold = 1000n - num(probe.raw, "unsold"), pOut = num(probe.raw, "out");
  check("L-1 probe routed inside the floor (out >= floor-out(sold - 8))", `sold ${pSold}, out ${pOut}`, () => ok(probe.raw) && pOut >= ((pSold > SLACK ? pSold - SLACK : 0n) * LIMIT) / PPDF);
  check("L-1 exhausted pools: the next call is u16047 exactly when 8 sats or less fit (probe), and moves nothing", `${p2.raw} / probe sold ${pSold}`, () => p2.raw === "(err u16047)" && pSold <= SLACK && field(c2.raw, "sbtc-balance") === field(c1.raw, "sbtc-balance"));
  // the next call sells more through the book
  const amount3 = num(p3.raw, "amount"), unsold3 = num(p3.raw, "unsold"), out3 = num(p3.raw, "out"), limit3 = num(p3.raw, "limit-price"), sold3 = amount3 - unsold3;
  check("L-1 next call: sells the whole wallet as amount", amount3, (a) => a === bare(field(c2.raw, "sbtc-balance")));
  check("L-1 next call: sold > 8, out >= floor-out(sold - 8)", `sold ${sold3}, out ${out3}, floor ${floorOut(sold3 - SLACK, limit3)}`, () => sold3 > SLACK && out3 >= floorOut(sold3 - SLACK, limit3));
  check("L-1 next call: wallet dropped by exactly sold, rest = unsold", `${field(c2.raw, "sbtc-balance")} -> ${field(c3.raw, "sbtc-balance")}`, () => bare(field(c3.raw, "sbtc-balance")) === unsold3);
  check("L-1 next call: vault STX rose by exactly out", bare(cStx3.raw) - bare(cStx2.raw), (d) => d === out3);
  const p3Ev = eventsOf(p3.step), p3Sbtc = sbtcMoves(p3Ev);
  const r3 = printsOf(p3Ev, ROUTER_ID).find(x => x.includes("smart-swap-sbtc-for-stx")) || "";
  check("L-1 next call: the router's book leg filled (jing-ok true, jing-in > 0)", r3.slice(0, 400), () => r3.includes("(jing-ok true)") && num(r3, "jing-in") > 0n);
  const gross3 = sum(p3Sbtc.filter(m => m.from === VAULT_ID)), back3 = sum(p3Sbtc.filter(m => m.to === VAULT_ID));
  check("L-1 next call: net sBTC out of the vault in events = sold", gross3 - back3, (d) => d === sold3);
  // #8: the allowance on a book-leg sale
  const allowNew = amount3 + MIN_X + REBATE_DUST + (MIN_X * MAX_REBATE_BPS + BPS - 1n) / BPS, allowOld = amount3 + MIN_X;
  check(`#8 book-leg sale: gross sBTC outflow within the allowance amount + min-x + 51 + ceil(min-x * 70 bps) (measured; old allowance ${allowOld})`, `gross ${gross3}, refunded ${back3}, allowance ${allowNew}`, () => gross3 <= allowNew);
  console.log(`  ..   #8 gross ${gross3} vs old allowance ${allowOld}: ${gross3 > allowOld ? "ABOVE the old allowance (the band)" : "under the old allowance (band not reached)"}`);

  console.log(`\n${checks - failures}/${checks} checks green`);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(`${RESULTS_DIR}/fixes.json`, JSON.stringify({ simulationId: sid, url: `https://stxer.xyz/simulations/mainnet/${sid}`, checks, failures, mid: String(MID), takers: { TAKE_A: String(TAKE_A), TAKE_B: String(TAKE_B) }, sourceHashes, results, plan: plan.map(({ want, step, ...p }) => p), result: res }, null, 2) + "\n");
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
