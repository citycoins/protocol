// Signed BTC/STX updates via PYTH_API_KEY or the public Jing backend.
export const LAZER_FEED_X = 1n; // BTC/USD
export const LAZER_FEED_Y = 45n; // STX/USD
export async function fetchLazerUpdate(ids = [1, 45]) {
  const key = process.env.PYTH_API_KEY;
  if (!key) throw new Error("PYTH_API_KEY is required (Pyth Pro key from pythdata.app)");
  const r = await fetch("https://pyth-lazer.dourolabs.app/v1/latest_price", { method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ priceFeedIds: ids, properties: ["price", "exponent", "confidence", "publisherCount", "feedUpdateTimestamp"], formats: ["evm"], channel: "fixed_rate@1000ms", jsonBinaryEncoding: "hex" }) });
  if (!r.ok) throw new Error(`Lazer ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const f = Object.fromEntries(j.parsed.priceFeeds.map((e) => [e.priceFeedId, e]));
  const a = f[ids[0]], b = f[ids[1]];
  if (!a || !b || a.exponent !== b.exponent) throw new Error("Lazer parsed feeds missing or expo mismatch");
  // futX/futY: each feed's own feedUpdateTimestamp (micros). Equal to
  // timestampUs when the price was made in this update, older when Lazer
  // carried the last price forward. The market judges freshness on these.
  return { hex: j.evm.data, px: BigInt(a.price), py: BigInt(b.price), ts: Number(j.parsed.timestampUs) / 1e6, expo: a.exponent,
    futX: Number(a.feedUpdateTimestamp ?? 0), futY: Number(b.feedUpdateTimestamp ?? 0) };
}

// No PYTH_API_KEY on this machine: the faktory-dao backend fetches the same
// signed update with its own key (GET /api/auction/pyth-lazer-update, the
// route the jingswap front end uses). The x-api-key it wants is the public
// one shipped in the jingswap.com bundle (FAKTORY_API_KEY to override).
export async function fetchLazerUpdateAny(ids = [1, 45]) {
  if (process.env.PYTH_API_KEY) return fetchLazerUpdate(ids);
  const key = process.env.FAKTORY_API_KEY || "jc_e4d2e10396eef95215a7afd492f42d743a3325739d29200c2a28b256f778be01";
  const base = process.env.FAKTORY_API_URL || "https://faktory-dao-backend.vercel.app";
  const r = await fetch(`${base}/api/auction/pyth-lazer-update?pair=sbtc-stx`, { headers: { "x-api-key": key } });
  if (!r.ok) throw new Error(`backend lazer ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()).data;
  const ts = Number(d.timestampUs) / 1e6;
  return { hex: d.hex, px: BigInt(d.priceX), py: BigInt(d.priceY), ts, expo: d.exponent, futX: Number(d.timestampUs), futY: Number(d.timestampUs) };
}
