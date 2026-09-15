const EBAY_API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function money(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
function shippingFrom(item) {
  const opt = item?.shippingOptions?.[0];
  if (!opt) return null;
  const v = money(opt.shippingCost?.value ?? opt.shippingCost?.amount);
  if (v !== null) return v;
  if (opt.shippingCostType === "FREE") return 0;
  return null;
}
export function normalize(item, detail) {
  const x = detail || item || {};
  const price = money(x.price?.value ?? item?.price?.value);
  const shipping = shippingFrom(x) ?? shippingFrom(item);
  const total = price !== null && shipping !== null ? price + shipping : price;
  return {
    itemId: x.itemId || item?.itemId || "",
    title: x.title || item?.title || "eBay listing",
    price, shipping, total,
    currency: x.price?.currency || item?.price?.currency || "USD",
    condition: x.condition || item?.condition || "",
    imageUrl: x.image?.imageUrl || item?.image?.imageUrl || x.thumbnailImages?.[0]?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || "",
    url: x.itemWebUrl || item?.itemWebUrl || "",
    seller: x.seller?.username || item?.seller?.username || "",
    sellerFeedback: x.seller?.feedbackPercentage ?? item?.seller?.feedbackPercentage ?? null,
    sellerFeedbackScore: x.seller?.feedbackScore ?? item?.seller?.feedbackScore ?? null,
    returnsAccepted: x.returnTerms?.returnsAccepted ?? item?.returnTerms?.returnsAccepted ?? null,
    deliveryMin: x.shippingOptions?.[0]?.minEstimatedDeliveryDate || item?.shippingOptions?.[0]?.minEstimatedDeliveryDate || null,
    deliveryMax: x.shippingOptions?.[0]?.maxEstimatedDeliveryDate || item?.shippingOptions?.[0]?.maxEstimatedDeliveryDate || null
  };
}
export async function getEbayToken() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("eBay credentials are not configured on the server.");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {"Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({grant_type: "client_credentials", scope: SCOPE})
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`eBay authentication returned HTTP ${response.status}.`); }
  if (!response.ok) throw new Error(data.error_description || data.errors?.[0]?.message || "eBay authentication failed.");
  return data.access_token;
}
export async function ebaySearch(token, {upc, q, limit = 50, condition = "NEW"}) {
  const url = new URL(`${EBAY_API}/buy/browse/v1/item_summary/search`);
  if (upc) url.searchParams.set("gtin", upc); else url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", `buyingOptions:{FIXED_PRICE},conditions:{${condition}}`);
  const r = await fetch(url, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`eBay search returned HTTP ${r.status} instead of JSON.`); }
  if (!r.ok) throw new Error(data.errors?.[0]?.message || `eBay search failed (HTTP ${r.status}).`);
  return Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
}
export async function getItem(token, itemId) {
  if (!itemId) return null;
  const r = await fetch(`${EBAY_API}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  if (!r.ok) return null;
  return await r.json();
}
export function isBadComparable(x) {
  const t = String(x.title || '').toLowerCase();
  return /(case only|replacement case|empty case|box only|cover only|manual only|artwork only|disc only|game only|digital code|download code|parts only|for parts|broken|damaged|repair|untested|no game|without game|replacement cover)/i.test(t);
}
export function comparableFilter(items, max = 20) {
  const seen = new Set(), out = [], excluded = [];
  for (const raw of items) {
    const x = normalize(raw);
    const key = x.itemId || `${x.title}|${x.price}|${x.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (x.price === null) { excluded.push({title:x.title, reason:"No price"}); continue; }
    if (isBadComparable(x)) { excluded.push({title:x.title, reason:"Likely incomplete/damaged/digital listing"}); continue; }
    out.push(x); if (out.length >= max) break;
  }
  return {out, excluded};
}
