const EBAY_API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function money(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
function shippingFrom(item) {
  const opt = item?.shippingOptions?.[0];
  if (!opt) return null;
  const v = money(opt.shippingCost?.value ?? opt.shippingCost?.amount);
  if (v !== null) return v;
  if (opt.shippingCostType === "FREE") return 0;
  return null;
}
function normalize(item, detail) {
  const x = detail || item || {};
  const price = money(x.price?.value ?? item?.price?.value);
  const shipping = shippingFrom(x) ?? shippingFrom(item);
  const total = price !== null && shipping !== null ? price + shipping : price;
  return {
    itemId: x.itemId || item?.itemId || "",
    title: x.title || item?.title || "eBay listing",
    price,
    shipping,
    total,
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
async function getEbayToken() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("eBay credentials are not configured on the server.");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {"Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({grant_type: "client_credentials", scope: SCOPE})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "eBay authentication failed.");
  return data.access_token;
}
async function ebaySearch(token, {upc, q, limit = 20, condition = "NEW"}) {
  const url = new URL(`${EBAY_API}/buy/browse/v1/item_summary/search`);
  if (upc) url.searchParams.set("gtin", upc);
  else url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", `buyingOptions:{FIXED_PRICE},conditions:{${condition}}`);
  const r = await fetch(url, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  const data = await r.json();
  if (!r.ok) throw new Error(data.errors?.[0]?.message || "eBay search failed.");
  return Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
}
async function getItem(token, itemId) {
  if (!itemId) return null;
  const r = await fetch(`${EBAY_API}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  if (!r.ok) return null;
  return await r.json();
}
function uniqueComparable(items, max = 20) {
  const seen = new Set();
  return items.map(x => normalize(x)).filter(x => {
    const key = x.itemId || `${x.title}|${x.price}|${x.url}`;
    if (seen.has(key) || x.price === null) return false;
    seen.add(key); return true;
  }).slice(0, max);
}
export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({error:"Method not allowed"});
  const upc = String(request.query.upc || "").replace(/\D/g, "");
  const q = String(request.query.q || "").trim();
  const condition = String(request.query.condition || "NEW").toUpperCase();
  if (!upc && !q) return response.status(400).json({error:"UPC or search text is required"});
  try {
    const token = await getEbayToken();
    let items = await ebaySearch(token, {upc, q, limit: 20, condition});
    if (!items.length && upc) items = await ebaySearch(token, {q: upc, limit: 20, condition});
    const chosen = uniqueComparable(items, 20);
    const details = await Promise.all(chosen.map(x => getItem(token, x.itemId)));
    const listings = chosen.map((x,i) => normalize(x, details[i]));
    const pricedTotals = listings.map(x => x.total).filter(Number.isFinite);
    const priced = listings.map(x => x.price).filter(Number.isFinite);
    const referencePrice = median(pricedTotals.length ? pricedTotals : priced);
    const first = items[0] || {};
    return response.status(200).json({
      product:{title:first.title || q || `UPC ${upc}`, category:first.categories?.[0]?.categoryName || "Product", upc, query:q},
      market:{referencePrice, sampleSize:listings.length, pricingBasis: pricedTotals.length === listings.length ? "item + shipping" : "item price", note:listings.length ? `Median of ${listings.length} current active eBay listings. Active listings are a market reference, not sold-item data.` : "No comparable eBay listings were returned.", listings}
    });
  } catch(error) { return response.status(500).json({error:error.message || "Unexpected server error"}); }
}
