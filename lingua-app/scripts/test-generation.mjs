import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
const output=new URL('../test/.generation-build/',import.meta.url);
await mkdir(output,{recursive:true});
try {
 const browser=process.argv.includes('--browser');
 const file=new URL(browser?'generation-browser.mjs':'generation-api.test.mjs',output);
 await build({entryPoints:[new URL(browser?'../test/generation-browser.mjs':'../test/generation-api.test.mjs',import.meta.url).pathname],outfile:file.pathname,bundle:true,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,browser?[file.pathname]:['--test',new URL('../test/generation-sql.test.mjs',import.meta.url).pathname,file.pathname],{stdio:'inherit',env:process.env});
 process.exitCode=result.status??1;
} finally {await rm(output,{recursive:true,force:true});}
