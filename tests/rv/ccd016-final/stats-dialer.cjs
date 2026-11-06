// RV ccd016-final post-dialer: tallies what really moved in successful calls
// (vault print notifications, STX into the book, sBTC out of the vault) and
// writes the totals to $RV_STATS (JSON) when the process exits. Evidence of
// non-vacuous coverage; it asserts nothing.
const { writeFileSync } = require("node:fs");
const { cvToJSON } = require("@stacks/transactions");
const out = process.env.RV_STATS;
const VAULT = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd016-swap-vault-mia-v2";
const BOOK = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.ccd015-redemption-book-mia-stx";
const stats = { calls: {}, notifications: {}, nonZeroSales: {}, stxToBook: 0n, sbtcOutOfVault: 0n, stxIntoVault: 0n };
function bump(map, key, n = 1) { map[key] = (map[key] || 0) + n; }
function pick(v, k) { return v && v.value && v.value[k] ? v.value[k] : undefined; }
async function postStats(ctx) {
  const name = ctx.selectedFunction.name;
  bump(stats.calls, name);
  for (const e of ctx.functionCall.events || []) {
    const d = e.data || {};
    if (e.event === "print_event" && d.contract_identifier === VAULT) {
      try {
        const j = cvToJSON(d.value);
        const n = pick(j, "notification");
        if (n) {
          bump(stats.notifications, n.value);
          const payload = pick(j, "payload");
          const outv = pick(payload, "out");
          if (outv && BigInt(outv.value) > 0n) bump(stats.nonZeroSales, n.value);
          const amt = pick(payload, "amount");
          if (n.value === "jing-reclaim" && amt && BigInt(amt.value) > 0n) bump(stats.nonZeroSales, "jing-reclaim(refund>0)");
        }
      } catch (_) {}
    }
    if (e.event === "stx_transfer_event") {
      if (d.recipient === BOOK) stats.stxToBook += BigInt(d.amount);
      if (d.recipient === VAULT) stats.stxIntoVault += BigInt(d.amount);
    }
    if (e.event === "ft_transfer_event" && d.sender === VAULT) stats.sbtcOutOfVault += BigInt(d.amount);
  }
}
process.on("exit", () => {
  if (!out) return;
  writeFileSync(out, JSON.stringify(stats, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");
});
module.exports = { postStats };
