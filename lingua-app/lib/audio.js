import { LANG_CODE } from "../config/constants";

const TTS_OK=typeof window!=="undefined" && "speechSynthesis" in window;

let ttsMode=null;

let ttsFailStreak=0;

let activeHandle=null;

function browserSpeak(handle,text,lang,rate){
  if(!("speechSynthesis" in window)){ if(handle.onend)handle.onend(); return; }
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance((text||"").slice(0,4500)); u.lang=LANG_CODE[lang]||"en-US"; u.rate=rate;
  u.onend=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); };
  handle._synth=true; window.speechSynthesis.speak(u);
}

const audioMem = (typeof window!=="undefined") ? new Map() : null;

const IDB={
  open(){ return new Promise((res,rej)=>{ if(typeof indexedDB==="undefined") return rej(); const r=indexedDB.open("lingua-audio",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("clips"); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async get(k){ try{ const db=await this.open(); return await new Promise(res=>{ const q=db.transaction("clips","readonly").objectStore("clips").get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } },
  async put(k,blob){ try{ const db=await this.open(); db.transaction("clips","readwrite").objectStore("clips").put(blob,k); }catch(e){} },
};

function cacheKey(text,lang,rate,voiceRole){ return lang+"|"+rate+"|"+(voiceRole||"default")+"|"+(text||"").slice(0,4000); }

function playUrl(handle,url){ if(handle._cancelled) return; const a=new Audio(url); handle._audio=a;
  a.onloadedmetadata=()=>{ if(!handle._cancelled&&isFinite(a.duration)&&handle.onmeta)handle.onmeta(a.duration); };
  a.ontimeupdate=()=>{ if(!handle._cancelled&&handle.onprogress)handle.onprogress(a.currentTime,a.duration); };
  a.onended=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); }; a.play().catch(()=>{}); }

async function fetchTTSBlob(text,lang,rate,voiceRole,tries=2){
  for(let i=0;i<tries;i++){
    try{
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:(text||"").slice(0,4000),lang,rate,voiceRole})});
      if(res.ok && (res.headers.get("content-type")||"").includes("audio")) return await res.blob();
    }catch(e){ /* retry */ }
  }
  return null;
}

function speak(text,lang,rate=1,voiceRole){
  stopSpeak();
  const handle={_cancelled:false,onend:null};
  activeHandle=handle;
  // Only give up on the high-quality voice after several consecutive API failures,
  // so one transient hiccup on a long line never swaps the whole session to the
  // lower-quality browser voice (which is what made words and passages sound different).
  if(ttsMode==="browser"){ browserSpeak(handle,text,lang,rate); return handle; }
  const key=cacheKey(text,lang,rate,voiceRole);
  (async()=>{
    // 1) in-memory cache (this session) — free & instant
    let url=audioMem && audioMem.get(key);
    // 2) IndexedDB cache (persists across reloads) — free
    if(!url){ const blob=await IDB.get(key); if(blob){ url=URL.createObjectURL(blob); audioMem&&audioMem.set(key,url); } }
    if(url){ ttsMode="api"; ttsFailStreak=0; playUrl(handle,url); return; }
    // 3) not cached → call the API (the ONLY path that costs money)
    const blob=await fetchTTSBlob(text,lang,rate,voiceRole,2);
    if(handle._cancelled) return;
    if(blob){
      ttsMode="api"; ttsFailStreak=0;
      IDB.put(key,blob);                                   // save for next time
      const u2=URL.createObjectURL(blob); audioMem&&audioMem.set(key,u2);
      playUrl(handle,u2);
      return;
    }
    // This clip failed — use the browser voice just for this play. Latch to the
    // browser voice only if the API keeps failing (e.g. no key configured).
    if(++ttsFailStreak>=3) ttsMode="browser";
    if(!handle._cancelled) browserSpeak(handle,text,lang,rate);
  })();
  return handle;
}

function stopSpeak(){
  if(activeHandle){ activeHandle._cancelled=true; if(activeHandle._audio){ try{activeHandle._audio.pause();}catch(e){} } activeHandle=null; }
  if(typeof window!=="undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export { IDB, TTS_OK, activeHandle, audioMem, browserSpeak, cacheKey, fetchTTSBlob, playUrl, speak, stopSpeak, ttsFailStreak, ttsMode };
