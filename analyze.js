const EBAY_API = "https://api.ebay.com";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

async function getEbayToken() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("eBay credentials are not configured on the server.");

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
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

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({error: "Method not allowed"});
  }

  const upc = String(request.query.upc || "").replace(/\D/g, "");
  if (!upc) return response.status(400).json({error: "UPC is required"});

  try {
    const token = await getEbayToken();
    const url = new URL(`${EBAY_API}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("gtin", upc);
    url.searchParams.set("limit", "50");

    const ebayResponse = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    });

    const data = await ebayResponse.json();
    if (!ebayResponse.ok) {
      const msg = data.errors?.[0]?.message || "eBay search failed.";
      return response.status(502).json({error: msg});
    }

    const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
    const prices = items
      .map(item => Number(item.price?.value))
      .filter(Number.isFinite)
      .filter(p => p > 0);

    const referencePrice = median(prices);

    const first = items[0] || {};
    const title = first.title || `UPC ${upc}`;
    const category = first.categories?.[0]?.categoryName || "Product";

    return response.status(200).json({
      product: {
        title,
        category,
        upc
      },
      market: {
        referencePrice,
        sampleSize: prices.length,
        note: prices.length
          ? `Median of ${prices.length} current eBay listing prices. This is an active-listing reference, not sold-item data.`
          : "No priced eBay listings were returned for this UPC."
      }
    });
  } catch (error) {
    return response.status(500).json({error: error.message || "Unexpected server error"});
  }
}
