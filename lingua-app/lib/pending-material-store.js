"use client";

import { PENDING_MATERIAL_TTL_MS } from "../config/constants.js";

const DB_NAME="lingua-materials",STORE="pending",KEY="pending-material-plan";
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function useStore(mode,run){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let value;try{value=run(store);}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function savePendingMaterial(plan){return useStore("readwrite",store=>store.put({plan,expiresAt:Date.now()+PENDING_MATERIAL_TTL_MS},KEY));}
async function readPendingMaterial(){const db=await openDb();try{return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,"readonly").objectStore(STORE).get(KEY);req.onsuccess=()=>{const value=req.result;resolve(value&&value.expiresAt>Date.now()?value.plan:null);};req.onerror=()=>reject(req.error);});}finally{db.close();}}
async function removePendingMaterial(){return useStore("readwrite",store=>store.delete(KEY));}
async function clearExpiredPendingMaterials(){const plan=await readPendingMaterial();if(!plan)await removePendingMaterial();return plan;}

export { clearExpiredPendingMaterials, readPendingMaterial, removePendingMaterial, savePendingMaterial };
