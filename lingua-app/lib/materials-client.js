"use client";

const TIMEOUT=15000;
async function request(path,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);try{const response=await fetch(path,{...options,signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"Could not update the material.");return data;}finally{clearTimeout(timer);}}
const authHeaders=token=>({"Content-Type":"application/json",Authorization:`Bearer ${token}`});
async function saveMaterialPlan(plan,token){return request("/api/materials",{method:"POST",headers:authHeaders(token),body:JSON.stringify(plan)});}
async function fetchMaterial(id,token){return request(`/api/materials/${encodeURIComponent(id)}`,{headers:authHeaders(token)});}
async function deleteMaterial(id,token){return request(`/api/materials/${encodeURIComponent(id)}`,{method:"DELETE",headers:authHeaders(token)});}
async function updateMaterialSegment(materialId,segmentId,status,token){return request(`/api/materials/${encodeURIComponent(materialId)}/segments/${encodeURIComponent(segmentId)}`,{method:"PATCH",headers:authHeaders(token),body:JSON.stringify({status})});}
const startMaterialSegment=(materialId,segmentId,token)=>updateMaterialSegment(materialId,segmentId,"in_progress",token);
const completeMaterialSegment=(materialId,segmentId,token)=>updateMaterialSegment(materialId,segmentId,"completed",token);
export { completeMaterialSegment, deleteMaterial, fetchMaterial, saveMaterialPlan, startMaterialSegment, updateMaterialSegment };
