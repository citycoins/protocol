// _sim-source.mjs
// Source provenance for stxer simulations. Every step carries the serialized
// transaction, so each deployment's code can be hashed: a deployed contract
// counts as an instance of the measured source only when its code is
// byte-identical (same sha256). Also classifies every tx (deploy, call and its
// target) so coverage tools can report which calls lack a trace.
import crypto from "node:crypto";
import { deserializeTransaction } from "@stacks/transactions";

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const str = (v) => (typeof v === "string" ? v : v?.content ?? v?.data ?? String(v));

// -> { steps, match: Set(name), others: [{ name, hash }], target: Map(txid -> contract name) }
export function classify(res, sourceHash) {
  const match = new Set();
  const others = [];
  const target = new Map();
  for (const s of res.steps) {
    if (!s.Transaction) continue;
    let tx;
    try { tx = deserializeTransaction(s.Transaction); } catch { continue; }
    const p = tx.payload;
    if (p.codeBody !== undefined) {
      const name = str(p.contractName);
      const hash = sha256(str(p.codeBody));
      if (hash === sourceHash) match.add(name); else others.push({ name, hash });
      if (s.TxId) target.set(s.TxId, name);
    } else if (p.contractName !== undefined && p.functionName !== undefined) {
      if (s.TxId) target.set(s.TxId, str(p.contractName));
    }
  }
  return { steps: res.steps, match, others, target };
}
