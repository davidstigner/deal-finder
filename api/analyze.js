import { getEbayToken, ebaySearch, getItem, normalize, comparableFilter } from './ebay.js';
function average(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
export default async function handler(request,response){
  if(request.method!=="GET")return response.status(405).json({error:"Method not allowed"});
  const upc=String(request.query.upc||"").replace(/\D/g,""); const q=String(request.query.q||"").trim(); const condition=String(request.query.condition||"NEW").toUpperCase();
  if(!upc&&!q)return response.status(400).json({error:"UPC or search text is required"});
  try{
    const token=await getEbayToken(); let items=await ebaySearch(token,{upc,q,limit:50,condition}); if(!items.length&&upc)items=await ebaySearch(token,{q:upc,limit:50,condition});
    const filtered=comparableFilter(items,20), chosen=filtered.out, compact=String(request.query.compact||"")==="1";
    const details=compact?[]:await Promise.all(chosen.map(x=>getItem(token,x.itemId))); const listings=chosen.map((x,i)=>normalize(x,compact?null:details[i]));
    const totals=listings.map(x=>x.total).filter(Number.isFinite), prices=listings.map(x=>x.price).filter(Number.isFinite), series=totals.length?totals:prices;
    const referencePrice=median(series), averagePrice=average(series), minPrice=series.length?Math.min(...series):0, maxPrice=series.length?Math.max(...series):0, spreadRatio=averagePrice>0?(maxPrice-minPrice)/averagePrice:1, first=items[0]||{};
    const confidenceScore=Math.max(0,Math.min(100,Math.round(Math.min(listings.length,20)/20*55+Math.max(0,1-Math.min(spreadRatio,1))*30+(first.title||q||upc?15:0))));
    return response.status(200).json({product:{title:first.title||q||`UPC ${upc}`,category:first.categories?.[0]?.categoryName||"Product",upc,query:q},market:{referencePrice,averagePrice,minPrice,maxPrice,confidenceScore,marketConfidence:confidenceScore,sampleSize:listings.length,pricingBasis:totals.length===listings.length?"item + shipping":"item price",excludedComparables:filtered.excluded.slice(0,20),note:listings.length?`Based on ${listings.length} current active eBay listings. These are a market reference, not sold-item history.`:"No comparable eBay listings were returned.",listings}})
  }catch(error){return response.status(500).json({error:error.message||"Unexpected server error"})}
}
