# Margin Hunter v4

**Margin Hunter** is the reseller acquisition engine powered by **Area 51 Intelligence**.

## Brand
- Product: Margin Hunter
- Powered by: Area 51 Intelligence
- Core message: Find the margin before you buy.
- UI language: Target, Hunt, Recon, Mission Log, Acquisition Engine

## Included
- UPC/GTIN eBay Browse API lookup
- Search-text fallback
- New / Used condition selection
- Active eBay comparable listing cards with primary photos
- Seller, feedback, shipping, returns and eBay links when returned by eBay
- Median market reference
- Editable profit engine
- eBay fee, payment fee, fixed fee, outbound shipping, target ROI and minimum profit assumptions
- Estimated profit, ROI, max buy price and 0-100 deal score
- Strong Buy / Possible Buy / Pass decision
- Bulk supplier CSV analysis, ranked by decision
- CSV export
- Mobile-first camera barcode scanning
- Photo barcode recon
- OCR title-search fallback for shelf/spine photos
- Local mission history and acquisition statistics

## Environment variables
Keep the same eBay credentials from the existing deployment:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- Optional `EBAY_ZIP` (default `95307`)

## Deploy
Upload this entire folder as a Vercel project and keep the eBay environment variables. No eBay credentials are exposed to the browser.

## Important market-data note
The Browse API results used here are active listings. They are a current market reference, not sold-item history. The app intentionally labels them that way.
