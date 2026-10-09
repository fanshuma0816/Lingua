"use client";

import { MAX_PDF_BYTES, MAX_PDF_PAGES, PDF_PARSE_TIMEOUT_MS } from "../config/constants.js";

async function hasPdfSignature(file){
  const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
  return String.fromCharCode(...bytes)==="%PDF-";
}

async function validatePdfFile(file){
  if(!file)throw new Error("missing_file");
  if(file.size>MAX_PDF_BYTES)throw new Error("pdf_too_large");
  if(!/\.pdf$/i.test(file.name||"")||!(await hasPdfSignature(file)))throw new Error("invalid_pdf");
  return true;
}

function normalizePageItems(items){
  const rows=new Map();
  for(const item of items||[]){
    const value=String(item?.str||"").trim(); if(!value)continue;
    const y=Math.round(Number(item?.transform?.[5]||0)/3)*3;
    const x=Number(item?.transform?.[4]||0);
    if(!rows.has(y))rows.set(y,[]);
    rows.get(y).push({x,value});
  }
  return [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,row])=>row.sort((a,b)=>a.x-b.x).map(x=>x.value).join(" ").replace(/\s+/g," ").trim()).filter(Boolean);
}

function removeRepeatedMargins(pages){
  const frequency=new Map();
  for(const page of pages){
    const candidates=[...page.lines.slice(0,2),...page.lines.slice(-2)];
    for(const line of new Set(candidates)){const key=line.toLowerCase();frequency.set(key,(frequency.get(key)||0)+1);}
  }
  const threshold=Math.max(3,Math.ceil(pages.length*0.5));
  return pages.map(page=>({...page,lines:page.lines.filter((line,index)=>{
    if(/^\s*\d{1,4}\s*$/.test(line))return false;
    const atMargin=index<2||index>=page.lines.length-2;
    return !(atMargin&&(frequency.get(line.toLowerCase())||0)>=threshold);
  })}));
}

function joinLines(lines){
  let out="";
  for(const line of lines){
    if(!out){out=line;continue;}
    if(/-\s*$/.test(out)&&/^\p{Ll}/u.test(line)){out=out.replace(/-\s*$/,"")+line;continue;}
    const paragraphBreak=/[.!?][\"']?$/.test(out)&&/^\p{Lu}/u.test(line);
    out+=paragraphBreak?"\n":` ${line}`;
  }
  return out.trim();
}

async function extractPdfText(file,{onProgress}={}){
  await validatePdfFile(file);
  const task=(async()=>{
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
    const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
    let pdf;
    try{pdf=await loading.promise;}catch(error){throw new Error(error?.name==="PasswordException"?"pdf_encrypted":"invalid_pdf");}
    if(pdf.numPages>MAX_PDF_PAGES)throw new Error("pdf_too_many_pages");
    const pages=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();
      pages.push({pageNumber,lines:normalizePageItems(content.items)});
      onProgress?.({pageNumber,pageCount:pdf.numPages});
    }
    const cleaned=removeRepeatedMargins(pages);let text="";const pageMap=[];
    for(const page of cleaned){
      const pageText=joinLines(page.lines);if(!pageText)continue;
      if(text)text+="\n\n";
      const start=text.length;text+=pageText;pageMap.push({pageNumber:page.pageNumber,start,end:text.length});
    }
    if(!text.trim())throw new Error("pdf_no_text");
    return {text,pageCount:pdf.numPages,fileSize:file.size,pageMap};
  })();
  let timer;
  try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("pdf_timeout")),PDF_PARSE_TIMEOUT_MS);})]);}
  finally{clearTimeout(timer);}
}

export { extractPdfText, validatePdfFile };
