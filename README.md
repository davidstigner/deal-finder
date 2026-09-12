# Deal Finder Backend V1

This version moves marketplace credentials and eBay calls to a server-side Vercel Function.

## Environment variables

Set these in Vercel Project Settings → Environment Variables:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

Use the eBay Production Application Keys for live eBay data. Never put the secret in `app.js`, `index.html`, or any public GitHub file.

The endpoint is:

`/api/analyze?upc=YOUR_UPC`

It searches eBay Browse API by GTIN and returns a median active-listing price reference.

Important: active listing prices are not sold-item prices. The next version should add stronger market methodology and, where legally/technically available, sold/transaction data.

## Deployment

Import this repository into Vercel. Vercel will deploy `index.html` as the site and `api/analyze.js` as a serverless function.

The frontend calls `/api/analyze`, so the frontend and backend stay on the same domain.
