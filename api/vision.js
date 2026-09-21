function json(status, body){return {status, body}}
const SYSTEM = `You are ANLZD Recon, a meticulous video-game inventory vision system. Inspect the ENTIRE image, especially every visible game case/spine. Return one candidate per distinct physical game case you can identify. Do not invent titles. Read spine text exactly when possible. Determine platform from the spine/logo/case color. If a title is partially obscured, return your best reading only when multiple visual clues support it and lower confidence. Never confuse a platform logo or rating with a title. Never treat repeated copies as one item unless they are visibly the same physical copy repeated in the image. For each item provide title, platform, edition/variant, condition if visually apparent, UPC if actually readable, confidence, and normalized core title. Coordinates are normalized 0..1000 with x,y,width,height. Focus on games, not accessories, shelves, stickers, price tags, or unrelated objects.`;
const schema={type:'object',additionalProperties:false,properties:{items:{type:'array',items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},platform:{type:'string'},edition:{type:'string'},condition:{type:'string'},upc:{type:'string'},confidence:{type:'number'},coreTitle:{type:'string'},bbox:{type:'object',additionalProperties:false,properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height']}},required:['title','platform','edition','condition','upc','confidence','coreTitle','bbox']}}},required:['items']};
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key)return res.status(503).json({error:'Vision engine is not configured. Add OPENAI_API_KEY to enable AI shelf recognition.'});
  const body=req.body||{}; const image=String(body.image||'');
  if(!image.startsWith('data:image/'))return res.status(400).json({error:'image must be a data URL'});
  if(image.length>9000000)return res.status(413).json({error:'Image is too large. Recon will resize it before sending.'});
  const model=process.env.RECON_VISION_MODEL||'gpt-5.6-luna';
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'user',content:[{type:'input_text',text:SYSTEM+'\nReturn JSON only. Inspect all shelves and all visible spines. Aim for recall first, but do not hallucinate.'},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'recon_items',strict:true,schema}},max_output_tokens:12000})});
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{throw new Error(`Vision API returned HTTP ${r.status} without JSON.`)}
    if(!r.ok)throw new Error(data.error?.message||`Vision API failed (HTTP ${r.status}).`);
    const text=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||'';
    if(!text)throw new Error('Vision API returned no structured output.');
    const parsed=JSON.parse(text); return res.status(200).json({items:Array.isArray(parsed.items)?parsed.items:[],model});
  }catch(e){return res.status(502).json({error:e.message||'Vision recognition failed'})}
}
