const EBAY_API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Obvious non-comparable listings. These are intentionally conservative:
// we would rather flag a questionable listing for review than silently use it.
const EXCLUDE_PATTERNS = [
  /\b(for parts|parts only|part only|repair|broken|damaged|not working|faulty)\b/i,
  /\b(replacement|spare|shell|housing|case only|box only|empty box|empty case)\b/i,
  /\b(display|shelf display|store display|promo|promotional|advertising|poster|sign|card only)\b/i,
  /\b(manual only|artwork only|cover only|insert only|disc only|cartridge only|game only)\b/i
];

function exclusionReason(title = "") {
  const text = normalizeText(title);
  if (/\b(for parts|parts only|part only|repair|broken|damaged|not working|faulty)\b/.test(text)) return "Parts/repair/damaged listing";
  if (/\b(replacement|spare|shell|housing|case only|box only|empty box|empty case)\b/.test(text)) return "Replacement/accessory/box-only listing";
  if (/\b(display|shelf display|store display|promo|promotional|advertising|poster|sign|card only)\b/.test(text)) return "Display/promotional item";
  if (/\b(manual only|artwork only|cover only|insert only|disc only|cartridge only|game only)\b/.test(text)) return "Incomplete/item-only listing";
  return "Does not appear to be a complete comparable item";
}

async function getEbayToken() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("eBay credentials are not configured on the server.");

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: SCOPE
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "eBay authentication failed.");
  return data.access_token;
}

function mapListing(item) {
  return {
    title: item.title || "eBay listing",
    price: Number(item.price?.value),
    currency: item.price?.currency || "USD",
    condition: item.condition || "",
    conditionId: item.conditionId || "",
    imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || "",
    url: item.itemWebUrl || ""
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const upc = String(request.query.upc || "").replace(/\D/g, "");
  const compareCondition = String(request.query.condition || "new").toLowerCase();

  if (!upc) return response.status(400).json({ error: "UPC is required" });

  try {
    const token = await getEbayToken();
    const url = new URL(`${EBAY_API}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("gtin", upc);
    url.searchParams.set("limit", "50");

    // eBay supports broad NEW/USED condition filtering in Browse API.
    // Keep Any unfiltered so the text-based comparable filter can still operate.
    if (compareCondition === "new") {
      url.searchParams.set("filter", "conditions:{NEW}");
    } else if (compareCondition === "used") {
      url.searchParams.set("filter", "conditions:{USED}");
    }

    const ebayResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    });

    const data = await ebayResponse.json();
    if (!ebayResponse.ok) {
      const msg = data.errors?.[0]?.message || "eBay search failed.";
      return response.status(502).json({ error: msg });
    }

    const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
    const allListings = items
      .map(mapListing)
      .filter(item => Number.isFinite(item.price) && item.price > 0);

    const excluded = [];
    const comparableListings = [];

    for (const listing of allListings) {
      const reason = exclusionReason(listing.title);
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(listing.title))) {
        excluded.push({ ...listing, reason });
      } else {
        comparableListings.push(listing);
      }
    }

    comparableListings.sort((a, b) => a.price - b.price);
    excluded.sort((a, b) => a.price - b.price);

    const prices = comparableListings.map(item => item.price);
    const referencePrice = median(prices);

    const first = comparableListings[0] || allListings[0] || {};
    const title = first.title || `UPC ${upc}`;
    const category = items[0]?.categories?.[0]?.categoryName || "Product";

    const conditionLabel = compareCondition === "new"
      ? "New / Sealed"
      : compareCondition === "used"
        ? "Used"
        : "Any condition";

    return response.status(200).json({
      product: {
        title,
        category,
        upc
      },
      market: {
        referencePrice,
        sampleSize: comparableListings.length,
        rawSampleSize: allListings.length,
        excludedSampleSize: excluded.length,
        condition: compareCondition,
        conditionLabel,
        note: comparableListings.length
          ? `Median of ${comparableListings.length} comparable active eBay listings for ${conditionLabel}. Excluded listings are not used in the market calculation.`
          : "No comparable priced eBay listings were returned for this UPC and condition.",
        listings: comparableListings,
        excluded
      }
    });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Unexpected server error" });
  }
}
