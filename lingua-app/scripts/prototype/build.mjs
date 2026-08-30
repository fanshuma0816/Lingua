import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "prototype.html");
const SEED = {
  "lingua:email":"demo@lingua.app",
  "lingua:draft":"Ik ga vandaag naar de markt om verse groenten en fruit te kopen. De verkoper is heel vriendelijk en hij vertelt mij welke appels het lekkerst zijn. Ik betaal met mijn pinpas en loop daarna rustig naar huis. Onderweg kom ik mijn buurvrouw tegen en we praten even over het weer.",
  "lingua:lang":"Dutch","lingua:level":"A2 — Elementary","lingua:goal":"General fluency","lingua:uiLang":"en","lingua:theme":"light",
};
const safe=(s)=>s.replace(/<\/(script|style)/gi,"<\\/$1");
const result=await esbuild.build({
  entryPoints:[path.join(__dirname,"entry.jsx")],
  bundle:true, format:"iife", minify:true, target:"es2018", jsx:"automatic",
  loader:{".js":"jsx"}, define:{"process.env.NODE_ENV":'"production"'},
  alias:{"next/navigation":path.join(__dirname,"shim-next.js")},
  write:false, logLevel:"warning",
});
const js=result.outputFiles[0].text;
const css=fs.readFileSync(path.join(ROOT,"app","globals.css"),"utf8");
const seedScript=`(function(){try{var s=${JSON.stringify(SEED)};for(var k in s){if(localStorage.getItem(k)==null)localStorage.setItem(k,JSON.stringify(s[k]));}}catch(e){}})();`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Lingua prototype</title><style>${safe(css)}</style></head><body><div id="root"></div><script>${seedScript}</script><script>${safe(js)}</script></body></html>`;
fs.writeFileSync(OUT,html);
console.log("wrote", OUT, Math.round(fs.statSync(OUT).size/1024)+"KB");
