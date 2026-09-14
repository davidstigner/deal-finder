export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({error:"Method not allowed"});
  const {items = []} = request.body || {};
  if (!Array.isArray(items) || !items.length) return response.status(400).json({error:"items is required"});
  if (items.length > 20) return response.status(400).json({error:"Maximum 20 items per batch"});
  const base = `${request.headers["x-forwarded-proto"] || "https"}://${request.headers.host}`;
  const out = new Array(items.length);
  let cursor = 0;
  async function worker(){
    while(true){
      const i = cursor++;
      if(i >= items.length) return;
      const item = items[i];
      const p = new URLSearchParams();
      if (item.upc) p.set("upc", String(item.upc));
      if (item.title) p.set("q", String(item.title));
      if (item.condition) p.set("condition", String(item.condition));
      try {
        const r = await fetch(`${base}/api/analyze?${p}`);
        out[i] = {input:item, result:await r.json(), ok:r.ok};
      } catch(e) { out[i] = {input:item, result:{error:e.message}, ok:false}; }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,items.length)},worker));
  return response.status(200).json({results:out});
}
