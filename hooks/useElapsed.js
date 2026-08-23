"use client";

import { useEffect, useState } from "react";

function useElapsed(active){
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{ if(!active){ setElapsed(0); return; } const t=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(t); },[active]);
  return elapsed;
}

export { useElapsed };
