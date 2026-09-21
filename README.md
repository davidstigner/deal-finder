# ANLZD v13 Complete

ANLZD v13 preserves the complete v9 acquisition app while incorporating the advanced Recon + barcode engine.

## Preserved app features
- ANLZD branding/logo
- Hunt / Catalog / Recon / History
- Choose Photo upload on mobile plus camera capture
- Crop & Retry
- Buy List and I PAID purchase tracking
- Dual identification/market confidence
- Comparable audit
- Catalog CSV/XLSX/XLS import, preview, Top 25 ROI and CSV export
- Engine settings, purchase history and local persistence

## Advanced barcode engine
- Native BarcodeDetector when available
- ZXing browser fallback
- Both engines are fused instead of one silently replacing the other
- Multi-region scanning, upscaling and contrast/binarization variants
- Rear camera, focus, zoom, torch and camera switching when supported
- UPC-A/E, EAN-8/13 and Code 128
- Deduplication and validation

## Advanced shelf Recon
- Barcode + AI vision + OCR fusion
- Full-frame AI vision plus four overlapping high-resolution shelf-band passes
- OCR full-frame plus 10-20 enhanced shelf bands
- Structured title/platform/edition/UPC/confidence/bounding-box extraction
- 50-target Recon session with automatic internal 8-target processing
- Multi-photo session merge and deduplication
- Strict platform/edition/region/graded/comparable filtering before market math

## Environment
- EBAY_CLIENT_ID
- EBAY_CLIENT_SECRET
- EBAY_ZIP (optional, defaults to 95307)
- OPENAI_API_KEY for AI shelf vision
- RECON_VISION_MODEL (optional)
