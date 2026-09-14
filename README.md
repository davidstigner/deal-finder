# Deal Finder V3

Deal Finder now searches eBay by UPC/GTIN, filters obvious non-comparable listings, supports New/Sealed, Used, or Any condition comparisons, and shows the listing photos, titles, prices, conditions, and links used in the market calculation. Excluded listings are shown separately with an exclusion reason.

## V3 market logic
- Default comparison: New / Sealed.
- Used and Any condition are available from the UI.
- Obvious parts, repair, replacement, box-only, display/promotional, and item-only listings are excluded.
- Market reference is the median of remaining active eBay listing prices.
- Active listing pricing is a reference, not sold-item data.

## Vercel environment variables
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
