export const runtime="nodejs";

function env(){return {url:String(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),key:process.env.SUPABASE_SERVICE_ROLE_KEY||""};}
function headers(key,prefer){return {"Content-Type":"application/json",apikey:key,Authorization:`Bearer ${key}`,...(prefer?{Prefer:prefer}:{})};}
async function userFor(req,e){const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!token)return null;const r=await fetch(`${e.url}/auth/v1/user`,{headers:{apikey:e.key,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
async function write(e,path,options){const r=await fetch(`${e.url}${path}`,options);const body=await r.text();if(!r.ok)throw new Error(body||"Supabase write failed.");return body?JSON.parse(body):null;}
const short=(v,n=180)=>String(v||"").replace(/\s+/g," ").trim().slice(0,n)||null;

export async function POST(req){
  try{
    const e=env();if(!e.url||!e.key)return Response.json({error:"Materials are not configured."},{status:503});
    const user=await userFor(req,e);if(!user?.id)return Response.json({error:"Please sign in to save this material."},{status:401});
    const b=await req.json(),text=String(b.cleanedText||"");
    if(!text.trim()||text.length>200000)return Response.json({error:"Invalid material text."},{status:400});
    const segments=Array.isArray(b.segments)?b.segments:[];
    if(!segments.length||segments.length>200)return Response.json({error:"Invalid material plan."},{status:400});
    let lastEnd=0;
    for(const [i,s] of segments.entries()){
      const start=Number(s.start??s.startOffset),end=Number(s.end??s.endOffset);
      if(s.index!==i||!Number.isInteger(start)||!Number.isInteger(end)||start!==lastEnd||end<=start||end>text.length)return Response.json({error:"Invalid material segment boundaries."},{status:400});
      lastEnd=end;
    }
    if(lastEnd!==text.length)return Response.json({error:"Material segments do not cover the complete text."},{status:400});
    const materialRows=await write(e,"/rest/v1/user_materials",{method:"POST",headers:headers(e.key,"return=representation"),body:JSON.stringify({
      user_id:user.id,display_name:short(b.displayName)||"My material",source_type:short(b.sourceType,20)||"pasted",source_hash:short(b.sourceHash,160),
      language:"Dutch",learner_level:short(b.level,40)||"A2",learning_goal:short(b.goal,120),target_minutes:Number(b.targetMinutes)||30,
      cleaned_text:text,original_char_count:Number(b.originalCharCount)||text.length,cleaned_char_count:text.length,
      source_file_size:b.fileSize==null?null:(Number.isFinite(Number(b.fileSize))?Number(b.fileSize):null),source_page_count:b.pageCount==null?null:(Number.isFinite(Number(b.pageCount))?Number(b.pageCount):null),
      planning_version:Number(b.planningVersion)||1,updated_at:new Date().toISOString()
    })});
    const material=materialRows?.[0];if(!material?.id)throw new Error("Material was not created.");
    const rows=segments.map((s,index)=>({material_id:material.id,segment_index:index,title:short(s.title)||`Part ${index+1}`,text:String(s.text||""),
      start_offset:Number(s.start??s.startOffset),end_offset:Number(s.end??s.endOffset),source_page_start:Number(s.pageStart)||null,source_page_end:Number(s.pageEnd)||null,
      word_count:Number(s.wordCount)||0,estimated_minutes_min:Number(s.estimatedMinutesMin)||null,estimated_minutes_max:Number(s.estimatedMinutesMax)||null,
      material_level:short(s.materialLevel,10),difficulty_label:short(s.difficultyLabel,30),status:"pending"}));
    let savedSegments;
    try{savedSegments=await write(e,"/rest/v1/material_segments",{method:"POST",headers:headers(e.key,"return=representation"),body:JSON.stringify(rows)});}
    catch(error){await fetch(`${e.url}/rest/v1/user_materials?id=eq.${material.id}&user_id=eq.${user.id}`,{method:"DELETE",headers:headers(e.key)});throw error;}
    return Response.json({material:{...material,segments:savedSegments||[]}});
  }catch(error){return Response.json({error:error?.message||"Could not save material."},{status:502});}
}
