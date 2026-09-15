import { getEbayToken, ebaySearch, comparableFilter } from './ebay.js';
function average(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:0}
function median(a){const x=a.filter(Number.isFinite).sort((u,v)=>u-v);if(!x.length)return 0;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
async function analyzeCompact(token,item){
  const upc=String(item.upc||"").replace(/\D/g,""); const q=String(item.title||"").trim(); const condition=String(item.condition||"NEW").toUpperCase();
  if(!upc&&!q)throw new Error("UPC or title is required");
  let raw=await ebaySearch(token,{upc,q,limit:50,condition}); if(!raw.length&&upc)raw=await ebaySearch(token,{q:upc,limit:50,condition});
  const filtered=comparableFilter(raw,20), listings=filtered.out, totals=listings.map(x=>x.total).filter(Number.isFinite), prices=listings.map(x=>x.price).filter(Number.isFinite), series=totals.length?totals:prices;
  const avg=average(series), ref=median(series), min=series.length?Math.min(...series):0, max=series.length?Math.max(...series):0, spread=avg>0?(max-min)/avg:1, first=raw[0]||{};
  const confidence=Math.max(0,Math.min(100,Math.round(Math.min(listings.length,20)/20*55+Math.max(0,1-Math.min(spread,1))*30+(first.title||q||upc?15:0))));
  return {product:{title:first.title||q||`UPC ${upc}`,category:first.categories?.[0]?.categoryName||"Product",upc,query:q},market:{referencePrice:ref,averagePrice:avg,minPrice:min,maxPrice:max,confidenceScore:confidence,marketConfidence:confidence,sampleSize:listings.length,pricingBasis:totals.length===listings.length?"item + shipping":"item price",excludedComparables:filtered.excluded.slice(0,20),note:listings.length?`Based on ${listings.length} current active eBay listings. These are a market reference, not sold-item history.`:"No comparable eBay listings were returned.",listings}};
}
export default async function handler(request,response){
  if(request.method!=="POST")return response.status(405).json({error:"Method not allowed"});
  const {items=[]}=request.body||{}; if(!Array.isArray(items)||!items.length)return response.status(400).json({error:"items is required"}); if(items.length>50)return response.status(400).json({error:"Maximum 50 items per batch"});
  try{
    const token=await getEbayToken(), out=new Array(items.length); let cursor=0;
    async function worker(){while(true){const i=cursor++;if(i>=items.length)return;try{out[i]={input:items[i],result:await analyzeCompact(token,items[i]),ok:true}}catch(e){out[i]={input:items[i],result:{error:e.message||"Analysis failed"},ok:false}}}}
    await Promise.all(Array.from({length:Math.min(8,items.length)},worker));
    return response.status(200).json({results:out});
  }catch(e){return response.status(500).json({error:e.message||"Catalog batch failed"})}
}
