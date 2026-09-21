const EBAY_API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function money(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('eBay request timed out.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
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
  const response = await fetchWithTimeout(`${EBAY_API}/identity/v1/oauth2/token`, {
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
  const r = await fetchWithTimeout(url, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`eBay search returned HTTP ${r.status} instead of JSON.`); }
  if (!r.ok) throw new Error(data.errors?.[0]?.message || `eBay search failed (HTTP ${r.status}).`);
  return Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
}
export async function getItem(token, itemId) {
  if (!itemId) return null;
  const r = await fetchWithTimeout(`${EBAY_API}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {headers:{"Authorization":`Bearer ${token}`,"Accept":"application/json","X-EBAY-C-MARKETPLACE-ID":"EBAY_US","X-EBAY-C-ENDUSERCTX":`contextualLocation=country=US,zip=${process.env.EBAY_ZIP || "95307"}`}});
  if (!r.ok) return null;
  return await r.json();
}
export function isBadComparable(x) {
  const t = String(x.title || '').toLowerCase();
  return /(case only|replacement case|empty case|box only|cover only|manual only|artwork only|disc only|game only|digital code|download code|parts only|for parts|broken|damaged|repair|untested|no game|without game|replacement cover)/i.test(t);
}

const EDITION_MARKERS = [
  ['collector', /\bcollector(?:s)?(?:\s+edition)?\b|\bcollectors\s+edition\b/i],
  ['deluxe', /\bdeluxe\b/i],
  ['limited', /\blimited\b|\blimited\s+run\b/i],
  ['special', /\bspecial\s+edition\b|\bspecial\b/i],
  ['ultimate', /\bultimate\b/i],
  ['gold', /\bgold\s+edition\b/i],
  ['platinum', /\bplatinum\b/i],
  ['steelbook', /\bsteelbook\b|\bsteel\s*book\b/i],
  ['anniversary', /\banniversary\b/i],
  ['premium', /\bpremium\b/i],
  ['signature', /\bsignature\s+edition\b/i],
  ['legendary', /\blegendary\b/i],
  ['definitive', /\bdefinitive\b/i],
  ['complete', /\bcomplete\s+edition\b/i],
  ['goty', /\bgame\s+of\s+the\s+year\b|\bgoty\b/i],
  ['launch', /\blaunch\s+edition\b|\bday[- ]one\b/i],
  ['firstprint', /\bfirst\s+print\b|\bfirst\s+edition\b/i],
  ['remastered', /\bremaster(?:ed|s)?\b/i],
  ['director', /\bdirector(?:'s|s)?\s+cut\b/i],
  ['bundle', /\bbundle\b|\bpack\b|\bcollection\b/i]
];

const GRADED_RE = /\b(?:psa|cgc|bgs|beckett|wata|vga|sgc)\b|\bgraded\b|\bgem\s*mint\b|\b(?:9\.5|9\.8|10(?:\.0)?)\s*(?:gem|mint|grade|graded)\b/i;
const REGION_RE = /\b(?:japan(?:ese)?|jp|pal|europe(?:an)?|eu|uk|german|france|french|italian|spanish|korean|asia(?:n)?|australia(?:n)?|australian)\b/i;

function editionMarkers(title) {
  const t = String(title || '');
  return new Set(EDITION_MARKERS.filter(([,re]) => re.test(t)).map(([name]) => name));
}

function platformFamily(text) {
  const t = String(text || '').toLowerCase();
  if (/\bplaystation\s*5\b|\bps5\b|\bps5\b/.test(t)) return 'ps5';
  if (/\bplaystation\s*4\b|\bps4\b/.test(t)) return 'ps4';
  if (/\bplaystation\s*3\b|\bps3\b/.test(t)) return 'ps3';
  if (/\bplaystation\s*2\b|\bps2\b/.test(t)) return 'ps2';
  if (/\bpsp\b/.test(t)) return 'psp';
  if (/\bplaystation\s+vita\b|\bps vita\b|\bpsvita\b/.test(t)) return 'vita';
  if (/\bnintendo\s+switch\s*2\b|\bswitch\s*2\b|\bsw2\b/.test(t)) return 'switch2';
  if (/\bnintendo\s+switch\b|\bswitch\b|\bsw\b/.test(t)) return 'switch';
  if (/\bxbox\s+series\s+[sx]\b|\bseries\s+[sx]\b/.test(t)) return 'xboxseries';
  if (/\bxbox\s+one\b|\bxbox\s*one\s*\(?x\)?|\bxone\b|\bxb1\b/.test(t)) return 'xboxone';
  if (/\bxbox\s*360\b|\bx360\b/.test(t)) return 'xbox360';
  if (/\bxbox\b/.test(t)) return 'xbox';
  if (/\b3ds\b/.test(t)) return '3ds';
  if (/\bds\b|\bnintendo\s+ds\b/.test(t)) return 'ds';
  if (/\bwii\s*u\b/.test(t)) return 'wiiu';
  if (/\bwii\b/.test(t)) return 'wii';
  if (/\bps5\b/.test(t)) return 'ps5';
  return '';
}

function coreTitle(title) {
  return String(title || '').toLowerCase()
    .replace(/\b(?:new|brand\s*new|sealed|factory\s+sealed|mint|complete)\b/g, ' ')
    .replace(/\b(?:ps[2345]|playstation(?:\s+[2345])?|xbox(?:\s+(?:one|360|series\s+[sx]))?|nintendo\s+switch(?:\s*2)?|switch(?:\s*2)?)\b/g, ' ')
    .replace(/\b(?:collector(?:s)?|deluxe|limited|special|ultimate|gold|platinum|steelbook|anniversary|premium|signature|legendary|definitive|complete|game\s+of\s+the\s+year|goty|launch|day[- ]one|first\s+print|first\s+edition|remaster(?:ed|s)?|director(?:'s|s)?\s+cut|bundle|pack|edition)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function listingGtins(x) {
  const vals = [];
  const add = v => { if (v == null) return; if (Array.isArray(v)) v.forEach(add); else if (typeof v === 'object') { add(v.value); add(v.gtin); add(v.gtin13); add(v.gtin12); } else { const d = String(v).replace(/\D/g,''); if (d) vals.push(d); } };
  add(x?.gtin); add(x?.gtins); add(x?.product?.gtin); add(x?.product?.gtins);
  return [...new Set(vals)];
}

function tokenSimilarity(a,b) {
  const A = new Set(coreTitle(a).split(/\s+/).filter(Boolean));
  const B = new Set(coreTitle(b).split(/\s+/).filter(Boolean));
  if (!A.size || !B.size) return 0;
  let overlap = 0; for (const t of A) if (B.has(t)) overlap++;
  return overlap / Math.max(A.size, B.size);
}

export function comparableMismatch(x, target = {}) {
  const listingTitle = String(x.title || '');
  const targetTitle = String(target.title || target.query || '');
  if (GRADED_RE.test(listingTitle)) return 'Graded/encapsulated listing';

  const targetPlatform = platformFamily(`${target.sys || ''} ${targetTitle}`);
  const listingPlatform = platformFamily(listingTitle);
  if (targetPlatform && listingPlatform && targetPlatform !== listingPlatform) {
    return `Wrong platform (${listingPlatform.toUpperCase()} vs ${targetPlatform.toUpperCase()})`;
  }

  // A supplier row with no special-edition marker is treated as the standard/base edition.
  // Never let a premium variant become the market reference for a base product.
  const targetEditions = editionMarkers(targetTitle);
  const listingEditions = editionMarkers(listingTitle);
  const targetStandard = targetEditions.size === 0;
  const listingHasSpecialEdition = listingEditions.size > 0;
  if (targetStandard && listingHasSpecialEdition) return `Edition mismatch (${[...listingEditions].join(', ')})`;
  if (targetEditions.size === 0 && listingEditions.size > 0) {
    return `Edition mismatch (${[...listingEditions].join(', ')})`;
  }
  if (targetEditions.size > 0) {
    const shared = [...targetEditions].some(x => listingEditions.has(x));
    if (!shared) return `Edition mismatch (target: ${[...targetEditions].join(', ')})`;
    if (targetEditions.has('collector') && !listingEditions.has('collector')) return "Not the Collector's Edition";
    if (targetEditions.has('deluxe') && !listingEditions.has('deluxe')) return 'Not the Deluxe Edition';
    if (targetEditions.has('limited') && !listingEditions.has('limited')) return 'Not the Limited Edition';
  }

  const targetUpc = String(target.upc || target.gtin || '').replace(/\D/g,'');
  const listingUpc = listingGtins(x);
  const gtinEquivalent = (a,b) => a===b || (a.length===12 && b.length===13 && b.startsWith('0') && b.slice(1)===a) || (b.length===12 && a.length===13 && a.startsWith('0') && a.slice(1)===b);
  if (targetUpc && listingUpc.length && !listingUpc.some(v=>gtinEquivalent(targetUpc,v))) return 'UPC/GTIN mismatch';

  if (targetTitle) {
    const sim = tokenSimilarity(targetTitle, listingTitle);
    if (sim < 0.58) return `Title mismatch (${Math.round(sim * 100)}% core-title match)`;
  }

  if (REGION_RE.test(listingTitle) && !REGION_RE.test(targetTitle)) return 'Non-US/alternate-region listing';
  return '';
}

export function comparableFilter(items, max = 20, target = {}) {
  const seen = new Set(), out = [], excluded = [];
  for (const raw of items) {
    const x = normalize(raw);
    const key = x.itemId || `${x.title}|${x.price}|${x.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (x.price === null) { excluded.push({title:x.title, reason:"No price"}); continue; }
    if (isBadComparable(x)) { excluded.push({title:x.title, reason:"Likely incomplete/damaged/digital listing"}); continue; }
    const mismatch = comparableMismatch(x, target);
    if (mismatch) { excluded.push({title:x.title, reason:mismatch}); continue; }
    out.push(x); if (out.length >= max) break;
  }
  return {out, excluded};
}
