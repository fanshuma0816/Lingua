import { build } from "esbuild";
build({
  entryPoints:["components/features/App.jsx"],
  bundle:true, write:false, format:"esm", jsx:"automatic",
  loader:{".js":"jsx",".jsx":"jsx",".mjs":"js"},
  external:["react","react-dom","react/jsx-runtime","next","next/navigation","posthog-js"],
  logLevel:"warning",
}).then(()=>console.log("BUNDLE OK")).catch(e=>{console.error("BUNDLE FAIL"); process.exit(1);});
