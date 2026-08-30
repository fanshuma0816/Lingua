import { transformSync } from "esbuild";
import { readFileSync } from "fs";
let ok=true;
for(const f of process.argv.slice(2)){
  try{ transformSync(readFileSync(f,"utf8"),{loader:"jsx",jsx:"automatic"}); console.log("OK:",f); }
  catch(e){ ok=false; console.error("ERR:",f,"\n",e.message); }
}
process.exit(ok?0:1);
