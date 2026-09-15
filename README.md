# ANLZD v9

**Sourcing Intelligence | Powered by Area 51 Intelligence**

A mobile-first resale acquisition analyzer using eBay Browse API market references.

## v9 features
- Hunt: UPC/title analysis with up to 20 comparable listings.
- Comparable audit: obvious case-only, damaged, parts, digital-code and incomplete listings are excluded and reasons are shown.
- Dual confidence: identification confidence and market confidence.
- Deal engine: fees, shipping, estimated profit, ROI, target max-buy. ROI is N/A until acquisition cost is entered.
- Buy List: save targets, open full analysis, remove targets, record actual purchase price.
- I Paid: records actual acquisition cost and calculates actual ROI/profit.
- Purchase history stored locally in the browser.
- Catalog: CSV/XLSX/XLS upload, automatic common-column mapping, preview, in-app Top 25 ROI ranking, optional CSV export.
- Recon: up to 50 unique targets per session, barcode/OCR discovery, duplicate removal, average market price, suggested max purchase price, identification confidence, market confidence, tap-through to full Hunt analysis.
- Multi-photo Recon session: scan additional photos and merge unique targets up to 50.
- Crop & Retry: isolate a shelf/case/spine region and rerun Recon.
- Live barcode scanner.

## Environment variables
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_ZIP` optional, defaults to `95307`

## Important pricing note
The eBay Browse API data used here is active-listing data, not sold-item history. Market values are references for sourcing decisions, not guarantees of realized sale prices.

## Deploy
Deploy the repository to Vercel with the environment variables above.


## v9 additions
- ANLZD Score and true acquisition cost model
- Capital allocation / buying power
- Lot Analyzer
- Market Memory snapshots
- Local price alerts
- Actual purchase performance dashboard
- Marketplace planning foundation

Historical pricing is based on ANLZD snapshots. Active eBay listings are not represented as sold history.
