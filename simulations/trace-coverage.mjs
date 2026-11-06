// trace-coverage.mjs
// REAL expression / line / branch coverage of a Clarity contract from stxer
// simulations: every simulated tx has a debug trace (GET
// /devtools/v2/simulations/{sim}/inspect/{txid}, zstd + the "stxer0" wire
// format, decoder after github.com/stxer's gist) listing every expression
// evaluated, by AST id. The same source parsed by POST /contracts:parse
// gives every expression id with its source span. Executed ids over all ids
// = coverage; an `if` / `match` / `asserts!` whose taken arm never appears
// = an uncovered branch.
//
// Copied from jing-contracts-v3; CityCoins use: --source contracts/<dir>/<name>.clar --contract <name> --clarity 6 --by-source --sims id,...
//   node simulations/trace-coverage.mjs [--contract markets-sbtc-stx-jing-v6]
//        [--table "Full rerun 2026-09-14"] [--md] [--sims id,id,...]
// Traces are cached in $SCRATCH/traces (or ./.traces) so reruns are cheap.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getSimulationResult, parseContract } from "stxer";
import { deserializeCV, cvToString } from "@stacks/transactions";
import { classify, sha256 } from "./_sim-source.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const md = process.argv.includes("--md");
const NAME = arg("--contract", "markets-sbtc-stx-jing-v6");
// every instance of the SAME source deployed under another name (a MAX_DEPOSITORS u3 copy, a
// real-staleness copy, "markets-b") counts for the contract: same expression ids
const ALIAS = new RegExp(arg("--alias", "^markets-"));
// --by-source: ignore --alias; per sim, count only deployments whose code is
// byte-identical (sha256) to the measured source (see _sim-source.mjs)
const BY_SOURCE = process.argv.includes("--by-source");
let SIM_SET = null; // the current sim's matching instance names (by-source mode)
const TABLE = arg("--table", "Full rerun 2026-09-14");
const API = "https://api.stxer.xyz";
const CACHE = process.env.TRACE_CACHE || path.join(process.env.TMPDIR || "/tmp", "stxer-traces");
fs.mkdirSync(CACHE, { recursive: true });

// ---- sims from the README table (or --sims) ----
let sims;
if (arg("--sims")) sims = arg("--sims").split(",");
else {
  const readme = fs.readFileSync(arg("--readme", "contracts/README-markets-v6-pegged.md"), "utf8");
  const start = readme.indexOf(`## ${TABLE}`); if (start < 0) throw new Error(`table "${TABLE}" not found`);
  const end = readme.indexOf("\n## ", start + 4);
  sims = [...readme.slice(start, end < 0 ? undefined : end).matchAll(/`([0-9a-f]{32})`/g)].map((m) => m[1]);
}
// --skip id,id : sims that ran on another source version (their ids do not line up with --rev)
const SKIP = new Set((arg("--skip", "") || "").split(",").filter(Boolean));
sims = sims.filter((s) => ![...SKIP].some((k) => s.startsWith(k)));

// ---- the AST of the canonical source: id -> span, plus the branch nodes ----
// the sims ran on COMMITTED source: read it at --rev (default HEAD), never the working tree,
// or an uncommitted edit shifts every expression id and the traces no longer line up
const REV = arg("--rev", "HEAD");
// --source <file>: a contract that lives in another repo (the CityCoins ccd016 vault); read as is
const SRC = arg("--source");
const source = SRC ? fs.readFileSync(SRC, "utf8") : REV === "worktree" ? fs.readFileSync(`contracts/${NAME}.clar`, "utf8") : execFileSync("git", ["show", `${REV}:contracts/${NAME}.clar`], { encoding: "utf8", maxBuffer: 1 << 26 });
const SRC_LABEL = SRC ? `${SRC} at ${execFileSync("git", ["-C", path.dirname(SRC), "log", "-1", "--format=%h", "--", path.basename(SRC)], { encoding: "utf8" }).trim() || "the working tree"}` : REV === "worktree" ? "the working tree" : execFileSync("git", ["rev-parse", "--short", REV], { encoding: "utf8" }).trim();
const ast = await parseContract({ sourceCode: source, contractId: `SP000000000000000000002Q6VF78.${NAME}`, clarityVersion: arg("--clarity", "5") });
const exprs = ast.expressions ?? ast.ast ?? ast;
const nodes = new Map(); // id -> { line, list, fn }
const listOf = (e) => e?.expr?.List ?? e?.expr?.list ?? e?.list ?? null;
const atomOf = (e) => e?.expr?.Atom ?? e?.expr?.atom ?? null;
const lineOf = (span) => { if (typeof span === "string") return Number(span.split(":")[0]); return span?.start_line ?? span?.startLine ?? null; };
// a function's signature `(name (arg type) ...)` never executes: its lines are not code to cover
const sigLines = new Set();
function markSig(e) { if (!e || typeof e !== "object") return; if (e.span) sigLines.add(lineOf(e.span)); const l = listOf(e); if (l) for (const c of l) markSig(c); }
function walk(e, fn, inSig = false, parent = null) {
  if (!e || typeof e !== "object") return;
  if (e.id != null && e.span && !inSig) nodes.set(String(e.id), { line: lineOf(e.span), list: listOf(e), fn, parent });
  const l = listOf(e);
  if (l) {
    const head = atomOf(l[0]);
    const isDefFn = typeof head === "string" && /^define-(public|private|read-only)$/.test(head);
    // constants, maps, vars and traits are top-level definitions (deploy-time only), not functions
    const f = isDefFn ? atomOf(listOf(l[1])?.[0]) ?? atomOf(l[1]) ?? fn : fn;
    if (isDefFn) markSig(l[1]);
    l.forEach((c, k) => walk(c, f, inSig || (isDefFn && k === 1), e.id != null ? String(e.id) : parent));
  }
}
for (const e of exprs) walk(e, "(top)");
// Syntactic lists are not evaluated as calls, so the tracer never records them:
// tuple key/value pairs, let binding lists and their pairs, and the allowance
// list of as-contract? (with-ft / with-stx ...). They are transparent: they and
// their atoms count as run when the enclosing call ran, and they are not in the
// expression total.
const transparent = new Set();
for (const [, n] of nodes) {
  const l = n.list; if (!l) continue;
  const head = atomOf(l[0]);
  const mark = (c) => { if (c?.id != null && listOf(c)) transparent.add(String(c.id)); };
  if (head === "tuple") l.slice(1).forEach(mark);
  if (head === "let") { mark(l[1]); (listOf(l[1]) || []).forEach(mark); }
  if (head === "as-contract?") { mark(l[1]); (listOf(l[1]) || []).forEach(mark); }
}
// coverage is counted over CALL expressions (list nodes); atoms ride with their call
const callIds = new Set([...nodes].filter(([id, n]) => n.list && !transparent.has(id)).map(([id]) => id));
const total = callIds.size;

// ---- trace decoding (port of stxer's debug-data-parser.ts) ----
const td = new TextDecoder();
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b, o) => { let v = 0n; for (let i = 0; i < 8; i++) v = (v << 8n) + BigInt(b[o + i]); return v; };
function decodeNode(b, o, out, contract) {
  const codeLen = u32(b, o); o += 4;
  const code = td.decode(b.subarray(o, o + codeLen)); o += codeLen;
  const id = u64(b, o); o += 8;
  o += 80; // two cost snapshots
  const funcLen = u32(b, o); o += 4;
  const func = td.decode(b.subarray(o, o + funcLen)); o += funcLen;
  const argsLen = u32(b, o); o += 4;
  for (let i = 0; i < argsLen; i++) { const ok = b[o] === 0; o += 1; const len = u32(b, o); o += 4; o += len; }
  const resOk = b[o] === 0; o += 1;
  const rlen = u32(b, o); o += 4;
  const resultErr = resOk ? null : td.decode(b.subarray(o, o + rlen)); o += rlen;
  const m = code.match(/^(S[PMTN][0-9A-Z]+\.[0-9a-zA-Z_-]+):/);
  if (m) { contract = m[1].split(".")[1]; if (BY_SOURCE) contract = SIM_SET.has(contract) ? NAME : `~${contract}`; else if (contract !== NAME && ALIAS.test(contract)) contract = NAME; }
  if (contract) { const set = out.get(contract) || out.set(contract, new Set()).get(contract); set.add(String(id)); const cm = out.counts || (out.counts = new Map()); const key = `${contract}:${id}`; cm.set(key, (cm.get(key) || 0) + 1); if (resultErr) (out.errs ||= []).push({ contract, id: String(id), func, err: resultErr.slice(0, 80) }); }
  const n = u32(b, o); o += 4;
  for (let i = 0; i < n; i++) o = decodeNode(b, o, out, contract);
  return o;
}
function decodeTrace(buf, out) {
  const raw = execFileSync("zstd", ["-d", "-c"], { input: buf, maxBuffer: 1 << 28 });
  if (td.decode(raw.subarray(0, 6)) !== "stxer0") throw new Error(`unexpected trace: ${td.decode(raw.subarray(0, 40))}`);
  decodeNode(raw, 6 + 64, out, null);
}
async function fetchTrace(sim, txid) {
  const f = path.join(CACHE, `${sim}-${txid}.bin`);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  // a tx stxer returned no trace for (deploys, transfers) is remembered, so
  // reruns over the same sims do not retry it
  if (fs.existsSync(`${f}.none`)) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${API}/devtools/v2/simulations/${sim}/inspect/${txid}`);
    if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, b); return b; }
    if (r.status === 404 && attempt === 3) fs.writeFileSync(`${f}.none`, '');
    await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
  }
  return null;
}

// ---- walk every sim, every tx ----
const executed = new Map(); // contract name -> Set(ids)
const perSim = {};
let txs = 0, missing = 0;
const SRC_HASH = sha256(source);
const diag = { noTrace: 0, decodeErr: 0, marketCalls: 0, marketNoTrace: 0, marketDecodeErr: 0, excluded: new Map(), instances: new Map() };
for (const sim of sims) {
  const res = await getSimulationResult(sim);
  const info = BY_SOURCE ? classify(res, SRC_HASH) : null;
  if (BY_SOURCE) { SIM_SET = info.match; diag.instances.set(sim, [...info.match]); for (const o of info.others) diag.excluded.set(`${o.name}@${o.hash.slice(0, 12)}`, (diag.excluded.get(`${o.name}@${o.hash.slice(0, 12)}`) || 0) + 1); }
  const ids = res.steps.map((s) => s.TxId).filter(Boolean);
  perSim[sim] = { txs: ids.length, before: (executed.get(NAME) || new Set()).size };
  const batches = []; for (let i = 0; i < ids.length; i += 8) batches.push(ids.slice(i, i + 8));
  for (const batch of batches) {
    const bufs = await Promise.all(batch.map((t) => fetchTrace(sim, t)));
    bufs.forEach((buf, k) => {
      txs += 1;
      const isMarket = BY_SOURCE && info.match.has(info.target.get(batch[k]));
      if (isMarket) diag.marketCalls += 1;
      if (!buf) { missing += 1; diag.noTrace += 1; if (isMarket) diag.marketNoTrace += 1; return; }
      try { decodeTrace(buf, executed); } catch (e) { missing += 1; diag.decodeErr += 1; if (isMarket) diag.marketDecodeErr += 1; console.error(`decode error ${sim.slice(0, 8)} ${batch[k]}: ${String(e.message).slice(0, 80)}`); }
    });
  }
  perSim[sim].after = (executed.get(NAME) || new Set()).size;
  console.error(`${sim.slice(0, 8)}: ${ids.length} txs, ${NAME} ids ${perSim[sim].before} -> ${perSim[sim].after}${BY_SOURCE ? `, instances: ${[...info.match].join(" ") || "NONE"}` : ""}`);
}
const hitAll = executed.get(NAME) || new Set();
const hit = new Set([...hitAll].filter((id) => callIds.has(id)));

// ---- line coverage ----
const lines = source.split("\n");
const lineTouched = new Map(); // line -> executed?
const codeLine = (i) => { const raw = lines[i - 1]; if (raw == null || sigLines.has(i)) return false; const t = raw.trim(); return t !== "" && !t.startsWith(";;") && t !== ")" && t !== "(" && !/^\)+$/.test(t); };
// an atom (a bare argument on its own line) is not traced: it counts as run when its parent call ran
const ran = (id, n) => (n.list && !transparent.has(id) ? hit.has(id) : n.parent != null && nodes.has(n.parent) && ran(n.parent, nodes.get(n.parent)));
for (const [id, n] of nodes) {
  const l0 = n.line;
  if (l0 == null) continue;
  const on = ran(id, n);
  // an executed node marks its start line; a multi-line node only marks its first line (inner nodes mark theirs)
  if (on) lineTouched.set(l0, true); else if (!lineTouched.has(l0)) lineTouched.set(l0, false);
}
// a code line holds at least one expression (list or atom) of the AST
const codeLines = lines.map((_, i) => i + 1).filter((i) => codeLine(i) && lineTouched.has(i));
const coveredLines = codeLines.filter((l) => lineTouched.get(l) === true);
// top-level definitions (constants, maps, vars, trait lines) only run at deploy, which has no trace:
// report the executable body separately
const topLines = new Set([...nodes.values()].filter((n) => n.fn === "(top)" && n.line != null).map((n) => n.line));
const fnLines = codeLines.filter((l) => !topLines.has(l));
const fnCovered = fnLines.filter((l) => lineTouched.get(l) === true);
// ---- branches: if / match arms, and the pass / fail arms of every guard ----
// A guard (asserts!, try!, unwrap!, ...) that fails leaves an error result
// (EarlyReturn / Unwrap / Assertion) on its own trace node. The error also rides
// up through its parents, so a guard counts as having FAILED itself only when it
// carries more error results than its argument nodes together (an argument that
// errored propagates through the guard without the guard failing). It PASSED
// when it ran more times than it failed.
const GUARDS = ["asserts!", "try!", "unwrap!", "unwrap-err!", "unwrap-panic", "unwrap-err-panic"];
const errCnt = new Map();
for (const e of executed.errs || []) if (e.contract === NAME) errCnt.set(e.id, (errCnt.get(e.id) || 0) + 1);
const branches = [];
for (const [id, n] of nodes) {
  const l = n.list; if (!l) continue;
  const head = atomOf(l[0]); if (!["if", "match", ...GUARDS].includes(head)) continue;
  const line = n.line;
  const arms = head === "if" ? [l[2], l[3]] : head === "match" ? [l[3], l[5] ?? l[4]] : [l[1]];
  // an arm can be a bare atom or literal: the tracer does not record those as
  // nodes, so infer it from counts: the branch node ran more times than its
  // traced arms together means an untraced arm ran
  const cnt = (i) => (executed.counts?.get(`${NAME}:${i}`) || 0);
  const nodeHit = hitAll.has(id);
  const armHit = arms.map((a) => {
    if (!a || a.id == null) return null;
    if (listOf(a)) return hitAll.has(String(a.id));
    const others = arms.filter((o) => o && o !== a && listOf(o)).reduce((acc, o) => acc + cnt(o.id), 0);
    return nodeHit && cnt(id) > others;
  });
  if (GUARDS.includes(head)) {
    const ran = cnt(id), errs = errCnt.get(id) || 0;
    const argErrs = l.slice(1).filter((a) => a && a.id != null && listOf(a)).reduce((acc, a) => acc + (errCnt.get(String(a.id)) || 0), 0);
    const failed = errs > argErrs, passed = ran > errs;
    const gstate = !nodeHit ? "never reached" : passed && failed ? "both arms" : passed ? "one arm (pass only, fail never)" : failed ? "one arm (fail only, pass never)" : "arms not seen";
    branches.push({ id, line, fn: n.fn, head, state: gstate });
    continue;
  }
  const state = !nodeHit ? "never reached" : armHit.every((h) => h === true) ? "both arms" : armHit.some((h) => h === true) ? `one arm (${armHit[0] ? "then" : "else"} only)` : "arms not seen";
  branches.push({ id, line, fn: n.fn, head, state });
}
const partial = branches.filter((b) => b.state.startsWith("one arm") || b.state === "arms not seen");
const unreached = branches.filter((b) => b.state === "never reached");

// ---- uncovered lines grouped by function ----
const uncoveredByFn = {};
for (const [id, n] of nodes) { const l = n.line; if (!ran(id, n) && codeLine(l) && lineTouched.get(l) === false) (uncoveredByFn[n.fn] ||= new Set()).add(l); }

const out = [];
const L = (s) => out.push(s);
L(md ? `# Trace coverage: ${NAME}\n\nFrom \`simulations/trace-coverage.mjs\` on ${new Date().toISOString().slice(0, 10)}, source at ${SRC_LABEL}: ${sims.length} simulations, ${txs} transactions (${missing} without a trace), every evaluated expression read from the stxer debug traces.\n` : `${sims.length} sims, ${txs} txs (${missing} no trace)`);
L(md ? `| metric | value |\n|---|---|\n| expressions executed / total | ${hit.size} / ${total} (${((100 * hit.size) / total).toFixed(1)}%) |\n| code lines touched / total | ${coveredLines.length} / ${codeLines.length} (${((100 * coveredLines.length) / codeLines.length).toFixed(1)}%) |\n| function body lines touched / total (top-level definitions excluded) | ${fnCovered.length} / ${fnLines.length} (${((100 * fnCovered.length) / fnLines.length).toFixed(1)}%) |\n| branch nodes (if / match / asserts! / try! / unwrap! family; guard arms = pass and fail) | ${branches.length}: ${branches.length - partial.length - unreached.length} full, ${partial.length} partial, ${unreached.length} never reached |`
  : `expressions ${hit.size}/${total} (${((100 * hit.size) / total).toFixed(1)}%), lines ${coveredLines.length}/${codeLines.length} (${((100 * coveredLines.length) / codeLines.length).toFixed(1)}%), branches ${branches.length}: ${partial.length} partial, ${unreached.length} never reached`);
L(md ? `\n## Branches with one arm never taken (${partial.length})\n\n| line | function | kind | state |\n|---|---|---|---|` : `\n== partial branches (${partial.length})`);
for (const b of partial.sort((a, c) => a.line - c.line)) L(md ? `| ${b.line} | ${b.fn} | ${b.head} | ${b.state} |` : `L${b.line} ${b.fn} ${b.head}: ${b.state}`);
L(md ? `\n## Branch nodes never reached (${unreached.length})\n\n| line | function | kind |\n|---|---|---|` : `\n== never reached (${unreached.length})`);
for (const b of unreached.sort((a, c) => a.line - c.line)) L(md ? `| ${b.line} | ${b.fn} | ${b.head} |` : `L${b.line} ${b.fn} ${b.head}`);
L(md ? `\n## Uncovered code lines by function\n\n| function | lines |\n|---|---|` : `\n== uncovered lines by function`);
for (const [fn, set] of Object.entries(uncoveredByFn).sort((a, b) => b[1].size - a[1].size)) L(md ? `| ${fn} | ${[...set].sort((a, b) => a - b).join(", ")} |` : `${fn}: ${[...set].sort((a, b) => a - b).join(", ")}`);
{ const by = {}; for (const id of callIds) if (!hit.has(id)) { const f = nodes.get(id).fn; by[f] = (by[f] || 0) + 1; }
  L(md ? `\n## Expressions not executed, by function\n\n| function | expressions |\n|---|---|` : `\n== unexecuted expressions by function`);
  for (const [f, c] of Object.entries(by).sort((x, y) => y[1] - x[1])) L(md ? `| ${f} | ${c} |` : `${f}: ${c}`); }
if (md) { L(`\n## Per simulation (cumulative executed expressions of ${NAME})\n\n| sim | txs | before | after |\n|---|---|---|---|`); for (const [s, v] of Object.entries(perSim)) L(`| \`${s.slice(0, 8)}\` | ${v.txs} | ${v.before} | ${v.after} |`); }
if (BY_SOURCE) {
  L(md ? `\n## Provenance and trace diagnostics\n\nsource ${SRC_LABEL}, sha256 \`${SRC_HASH}\`. Only deployments with that exact code are counted.\n\n| item | count |\n|---|---|\n| transactions | ${txs} |\n| no trace returned by stxer | ${diag.noTrace} |\n| trace decode errors | ${diag.decodeErr} |\n| calls to a counted market instance | ${diag.marketCalls} |\n| ... of which without a trace | ${diag.marketNoTrace} |\n| ... of which decode errors | ${diag.marketDecodeErr} |`
    : `\n== provenance: sha256 ${SRC_HASH}; txs ${txs}, no trace ${diag.noTrace}, decode errors ${diag.decodeErr}; market calls ${diag.marketCalls}, market no trace ${diag.marketNoTrace}, market decode errors ${diag.marketDecodeErr}`);
  L(md ? `\n| sim | counted instances |\n|---|---|` : `== counted instances per sim`);
  for (const [s, names] of diag.instances) L(md ? `| \`${s.slice(0, 8)}\` | ${names.join(", ") || "none"} |` : `${s.slice(0, 8)}: ${names.join(" ") || "NONE"}`);
  L(md ? `\n| excluded deployment (name@hash) | sims |\n|---|---|` : `== excluded deployments (other code)`);
  for (const [k, n] of [...diag.excluded].sort()) L(md ? `| ${k} | ${n} |` : `${k} x${n}`);
}
console.log(out.join("\n"));
// --json <file>: every branch and every uncovered line with its source text, for annotated reports
if (arg("--json")) fs.writeFileSync(arg("--json"), JSON.stringify({ name: NAME, sha256: SRC_HASH, sims: sims.length, txs, missing, expressions: { hit: hit.size, total }, lines: { hit: coveredLines.length, total: codeLines.length }, fnLines: { hit: fnCovered.length, total: fnLines.length }, branches: branches.map((b) => ({ ...b, src: lines[b.line - 1]?.trim() })), uncovered: Object.fromEntries(Object.entries(uncoveredByFn).map(([f, set]) => [f, [...set].sort((a, b) => a - b).map((l) => ({ line: l, src: lines[l - 1]?.trim() }))])), perSim }, null, 1));
