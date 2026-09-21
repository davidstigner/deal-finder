# ANLZD v12

## Recon engine

ANLZD v12 uses three recognition layers:

1. Native browser `BarcodeDetector` when available.
2. ZXing browser fallback for browsers where the native detector is unavailable, including common iOS Safari cases.
3. AI shelf vision via `/api/vision`, with Tesseract OCR fallback.

A shelf photo is scanned as a whole image plus multiple high-resolution horizontal bands. AI vision returns structured title, platform, edition, UPC, confidence, and bounding box data. Barcode results always take precedence over visual guesses.

## Environment

Required for eBay analysis:
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_ZIP` (optional, defaults to 95307)

Required for AI shelf vision:
- `OPENAI_API_KEY`
- `RECON_VISION_MODEL` (optional, defaults to `gpt-5.6-luna`)

If `OPENAI_API_KEY` is not configured, Recon automatically falls back to barcode + OCR recognition.

## Matching safeguards

- Platform-aware matching
- Edition/variant filtering
- Graded-listing rejection
- Damaged/incomplete listing rejection
- UPC/GTIN matching with UPC/EAN equivalent handling
- Core-title similarity checks
- Region filtering
- Market calculations use only retained comparable listings
- Batch endpoint remains capped at 8 internally, while the UI automatically chunks larger Recon sessions
